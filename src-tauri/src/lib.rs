mod midi;
mod startup;

use muse_core::{
    Backup, BackupPreview, FitLayout, FitRequest, Folder, Library, Line, MidiBinding,
    RenderOptions, RestoreMode, RestoreReport, Setlist, Settings, Song, SongSummary,
};
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};

struct AppState {
    library: Mutex<Library>,
    pending: Mutex<Option<(String, Backup)>>,
    midi: Mutex<midi::Midi>,
}

type Command<T> = Result<T, String>;

fn with_library<T>(
    state: &AppState,
    operation: impl FnOnce(&mut Library) -> muse_core::Result<T>,
) -> Command<T> {
    let mut library = state.library.lock().map_err(|_| "Library is unavailable")?;
    operation(&mut library).map_err(|e| e.to_string())
}

#[tauri::command]
async fn songs(state: State<'_, AppState>, query: String) -> Command<Vec<SongSummary>> {
    with_library(&state, |db| db.songs(&query))
}

#[tauri::command]
async fn song(state: State<'_, AppState>, id: String) -> Command<Song> {
    with_library(&state, |db| db.song(&id))
}

#[tauri::command]
async fn save_song(state: State<'_, AppState>, song: Song) -> Command<SongSummary> {
    with_library(&state, |db| db.save_song(song))
}

#[tauri::command]
async fn delete_song(state: State<'_, AppState>, id: String) -> Command<()> {
    with_library(&state, |db| db.delete_song(&id))
}

#[tauri::command]
async fn sets(state: State<'_, AppState>) -> Command<Vec<Setlist>> {
    with_library(&state, |db| db.sets())
}

#[tauri::command]
async fn save_set(state: State<'_, AppState>, set: Setlist) -> Command<Setlist> {
    with_library(&state, |db| db.save_set(set))
}

#[tauri::command]
async fn delete_set(state: State<'_, AppState>, id: String) -> Command<()> {
    with_library(&state, |db| db.delete_set(&id))
}

#[tauri::command]
fn render(source: String, options: RenderOptions) -> Command<Vec<Line>> {
    if source.len() > muse_core::MAX_SOURCE {
        return Err("Song text exceeds 1 MiB".into());
    }
    if options.section_order.len() > 4096 || options.key.len() > 50 {
        return Err("Section order or key exceeds the supported length".into());
    }
    Ok(muse_core::render_with(&source, &options))
}

#[tauri::command]
fn fit_layout(request: FitRequest) -> Command<FitLayout> {
    let lines: usize = request.blocks.iter().map(|b| b.lines.len()).sum();
    let numbers = [
        request.width,
        request.height,
        request.header,
        request.gap,
        request.min_scale,
        request.max_scale,
        request.comfort_scale,
        request.min_column_width,
    ];
    let measured = request.blocks.iter().flat_map(|b| {
        [b.overhead, b.indent]
            .into_iter()
            .chain(b.lines.iter().flat_map(|l| [l.width, l.height]))
    });
    if request.blocks.len() > 5_000
        || lines > 50_000
        || request.max_columns > 8
        || numbers
            .into_iter()
            .chain(measured)
            .any(|v| !v.is_finite() || v < 0.0)
    {
        return Err("Invalid chart measurements".into());
    }
    Ok(muse_core::fit_layout(&request))
}

#[tauri::command]
fn section_labels(source: String) -> Command<Vec<String>> {
    if source.len() > muse_core::MAX_SOURCE {
        return Err("Song text exceeds 1 MiB".into());
    }
    Ok(muse_core::section_labels(&source))
}

#[tauri::command]
fn chord_diagram(chord: String, instrument: String) -> Command<muse_core::ChordDiagram> {
    let instrument = muse_core::Instrument::parse(&instrument)
        .ok_or_else(|| format!("Unknown instrument: {instrument}"))?;
    muse_core::chord_diagram(&chord, instrument).map_err(|e| e.to_string())
}

#[tauri::command]
fn song_chords(source: String, options: RenderOptions) -> Command<Vec<String>> {
    if source.len() > muse_core::MAX_SOURCE {
        return Err("Song text exceeds 1 MiB".into());
    }
    if options.section_order.len() > 4096 || options.key.len() > 50 {
        return Err("Section order or key exceeds the supported length".into());
    }
    Ok(muse_core::song_chords(&source, &options))
}

#[tauri::command]
fn tap_tempo(taps: Vec<f64>) -> Option<u16> {
    // The UI keeps 16 taps; anything far larger is not a tempo box.
    (taps.len() <= 64)
        .then(|| muse_core::tap_tempo(&taps))
        .flatten()
}

#[tauri::command]
fn transpose(chord: String, shift: i16, flats: bool, key_spelling: Option<bool>) -> String {
    if chord.len() > 64 {
        return chord;
    }
    muse_core::display_key(&chord, shift, flats, key_spelling.unwrap_or(true))
}

#[tauri::command]
async fn folders(state: State<'_, AppState>) -> Command<Vec<Folder>> {
    with_library(&state, |db| db.folders())
}

#[tauri::command]
async fn save_folder(state: State<'_, AppState>, folder: Folder) -> Command<Folder> {
    with_library(&state, |db| db.save_folder(folder))
}

#[tauri::command]
async fn delete_folder(state: State<'_, AppState>, id: String) -> Command<()> {
    with_library(&state, |db| db.delete_folder(&id))
}

#[derive(Deserialize)]
struct ImportFile {
    name: String,
    data: String,
}

fn decode(data: &str, cap: usize) -> Command<Vec<u8>> {
    use base64::{Engine, engine::general_purpose::STANDARD};
    if data.len() > cap.div_ceil(3) * 4 {
        return Err("File exceeds the allowed size".into());
    }
    let bytes = STANDARD
        .decode(data)
        .map_err(|_| "Invalid file transport encoding")?;
    if bytes.len() > cap {
        return Err("File exceeds the allowed size".into());
    }
    Ok(bytes)
}

#[tauri::command]
async fn import_files(state: State<'_, AppState>, files: Vec<ImportFile>) -> Command<usize> {
    if files.len() > 200
        || files.iter().map(|f| f.data.len()).sum::<usize>() > muse_core::MAX_BACKUP.div_ceil(3) * 4
    {
        return Err("Import batch exceeds the file count or size limit".into());
    }
    let items = files
        .into_iter()
        .map(|f| {
            let bytes = decode(&f.data, muse_core::MAX_DOCUMENT)?;
            muse_core::import_song(&f.name, &bytes).map_err(|e| format!("{}: {e}", f.name))
        })
        .collect::<Command<Vec<_>>>()?;
    with_library(&state, |db| db.import_songs(&items))
}

#[tauri::command]
async fn settings(state: State<'_, AppState>) -> Command<Settings> {
    with_library(&state, |db| db.settings())
}

#[tauri::command]
async fn save_settings(state: State<'_, AppState>, settings: Settings) -> Command<()> {
    with_library(&state, |db| db.save_settings(&settings))
}

#[derive(Serialize)]
struct Preview {
    token: String,
    details: BackupPreview,
}

#[tauri::command]
async fn preview_backup(app: tauri::AppHandle, data: String) -> Command<Preview> {
    tauri::async_runtime::spawn_blocking(move || {
        let (backup, details) = muse_core::read_backup(&decode(&data, muse_core::MAX_BACKUP)?)
            .map_err(|e| e.to_string())?;
        let token = uuid::Uuid::new_v4().to_string();
        *app.state::<AppState>()
            .pending
            .lock()
            .map_err(|_| "Backup preview is unavailable")? = Some((token.clone(), backup));
        Ok(Preview { token, details })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn restore_backup(
    app: tauri::AppHandle,
    token: String,
    mode: RestoreMode,
) -> Command<RestoreReport> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let mut pending = state
            .pending
            .lock()
            .map_err(|_| "Backup preview is unavailable")?;
        let backup = match pending.as_ref() {
            Some((id, backup)) if *id == token => backup.clone(),
            _ => return Err("Preview this backup again".into()),
        };
        // The preview stays available after a failed restore so it can be retried.
        let result = with_library(&state, |db| db.restore(backup, mode))?;
        *pending = None;
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn export_backup(state: State<'_, AppState>) -> Command<tauri::ipc::Response> {
    with_library(&state, |db| muse_core::write_backup(db)).map(tauri::ipc::Response::new)
}

#[tauri::command]
async fn save_export(app: tauri::AppHandle, name: String, data: String) -> Command<bool> {
    let bytes = decode(&data, muse_core::MAX_BACKUP)?;
    save_bytes(&app, &name, &bytes)
}

/// Writes a backup straight to the chosen file, without sending it through the WebView twice.
#[tauri::command]
async fn save_backup(app: tauri::AppHandle, name: String) -> Command<bool> {
    // Serializing a large library and writing it is blocking work; keep it off the async workers
    // that serve every other command.
    tauri::async_runtime::spawn_blocking(move || {
        let bytes = with_library(&app.state::<AppState>(), |db| muse_core::write_backup(db))?;
        save_bytes(&app, &name, &bytes)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Asks for a destination with the native save dialog; returns false when it is cancelled.
fn save_bytes(app: &tauri::AppHandle, name: &str, bytes: &[u8]) -> Command<bool> {
    use tauri_plugin_dialog::DialogExt;
    use tauri_plugin_fs::FsExt;
    if name.is_empty()
        || name
            .chars()
            .any(|c| c == '/' || c == '\\' || c.is_control())
    {
        return Err("Invalid export filename".into());
    }
    // UI tests cannot drive the native save dialog; debug builds may write to a test folder instead.
    #[cfg(debug_assertions)]
    if let Some(dir) = std::env::var_os("MUSE_TEST_EXPORT_DIR") {
        std::fs::write(std::path::Path::new(&dir).join(name), bytes).map_err(|e| e.to_string())?;
        return Ok(true);
    }
    let extension = name.rsplit_once('.').map_or("txt", |(_, ext)| ext);
    let Some(path) = app
        .dialog()
        .file()
        .set_file_name(name)
        .add_filter(extension.to_uppercase(), &[extension])
        .blocking_save_file()
    else {
        return Ok(false);
    };
    match path {
        tauri_plugin_fs::FilePath::Path(path) => {
            let parent = path.parent().ok_or("Invalid destination")?;
            let mut file = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
            file.write_all(bytes).map_err(|e| e.to_string())?;
            file.as_file().sync_all().map_err(|e| e.to_string())?;
            file.persist(path).map_err(|e| e.to_string())?;
        }
        uri => {
            let options = tauri_plugin_fs::OpenOptions::new()
                .write(true)
                .create(true)
                .truncate(true)
                .to_owned();
            let mut file = app.fs().open(uri, options).map_err(|e| e.to_string())?;
            file.write_all(bytes).map_err(|e| e.to_string())?;
        }
    }
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    run_app();
}

#[tauri::command]
async fn midi_ports() -> Command<midi::Ports> {
    midi::Midi::ports()
}

#[tauri::command]
async fn midi_connect(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    input: Option<String>,
    output: Option<String>,
    bindings: Vec<MidiBinding>,
) -> Command<()> {
    state
        .midi
        .lock()
        .map_err(|_| "MIDI is unavailable")?
        .connect(input, output, bindings, move |action| {
            let _ = app.emit("midi-action", action);
        })
}

#[tauri::command]
async fn midi_open_song(state: State<'_, AppState>, id: String) -> Command<()> {
    let messages = with_library(&state, |db| db.song(&id).map(|song| song.midi))?;
    state
        .midi
        .lock()
        .map_err(|_| "MIDI is unavailable")?
        .send(&messages)
}

fn run_app() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            #[cfg(debug_assertions)]
            let dir = std::env::var_os("MUSE_TEST_DATA_DIR")
                .map(std::path::PathBuf::from)
                .filter(|p| p.is_absolute())
                .unwrap_or(dir);
            std::fs::create_dir_all(&dir)?;
            let library = Library::open(dir.join("library.sqlite3"))?;
            app.manage(AppState {
                library: Mutex::new(library),
                pending: Mutex::new(None),
                midi: Mutex::new(midi::Midi::default()),
            });
            startup::begin(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            songs,
            song,
            save_song,
            delete_song,
            sets,
            save_set,
            delete_set,
            render,
            section_labels,
            fit_layout,
            transpose,
            tap_tempo,
            chord_diagram,
            song_chords,
            folders,
            save_folder,
            delete_folder,
            import_files,
            settings,
            save_settings,
            preview_backup,
            restore_backup,
            export_backup,
            save_backup,
            save_export,
            midi_ports,
            midi_connect,
            midi_open_song,
            prepare_track,
            detect_pitch,
            startup::app_ready
        ])
        .run(tauri::generate_context!())
        .expect("SongBookMuse could not start");
}

#[tauri::command]
fn prepare_track(name: String, data: String) -> Command<muse_core::Track> {
    muse_core::Track::from_file(name, &decode(&data, muse_core::MAX_AUDIO)?)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn detect_pitch(frame: Vec<f32>, rate: usize) -> Option<muse_core::Pitch> {
    thread_local! {
        static TUNER: std::cell::RefCell<muse_core::Tuner> = std::cell::RefCell::default();
    }
    TUNER.with_borrow_mut(|tuner| tuner.detect(&frame, rate))
}
