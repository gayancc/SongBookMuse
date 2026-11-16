mod midi;

use muse_core::{
    Backup, BackupPreview, Library, Line, MidiBinding, RestoreMode, RestoreReport, Setlist,
    Settings, Song, SongSummary,
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
fn render(source: String, shift: i16, flats: bool) -> Command<Vec<Line>> {
    if source.len() > muse_core::MAX_SOURCE {
        return Err("Song text exceeds 1 MiB".into());
    }
    Ok(muse_core::render(&source, shift, flats))
}

#[tauri::command]
fn transpose(chord: String, shift: i16, flats: bool) -> String {
    muse_core::transpose(&chord, shift, flats)
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
async fn preview_backup(state: State<'_, AppState>, data: String) -> Command<Preview> {
    let (backup, details) = muse_core::read_backup(&decode(&data, muse_core::MAX_BACKUP)?)
        .map_err(|e| e.to_string())?;
    let token = uuid::Uuid::new_v4().to_string();
    *state
        .pending
        .lock()
        .map_err(|_| "Backup preview is unavailable")? = Some((token.clone(), backup));
    Ok(Preview { token, details })
}

#[tauri::command]
async fn restore_backup(
    state: State<'_, AppState>,
    token: String,
    mode: RestoreMode,
) -> Command<RestoreReport> {
    let mut pending = state
        .pending
        .lock()
        .map_err(|_| "Backup preview is unavailable")?;
    let Some((id, backup)) = pending.as_ref() else {
        return Err("Preview this backup again".into());
    };
    if *id != token {
        return Err("Preview this backup again".into());
    }
    let backup = backup.clone();
    let result = with_library(&state, |db| db.restore(backup, mode))?;
    *pending = None;
    Ok(result)
}

#[tauri::command]
async fn export_backup(state: State<'_, AppState>) -> Command<tauri::ipc::Response> {
    with_library(&state, |db| muse_core::write_backup(db)).map(tauri::ipc::Response::new)
}

#[tauri::command]
async fn save_export(app: tauri::AppHandle, name: String, data: String) -> Command<bool> {
    use tauri_plugin_dialog::DialogExt;
    use tauri_plugin_fs::FsExt;
    let bytes = decode(&data, muse_core::MAX_BACKUP)?;
    if name.is_empty()
        || name
            .chars()
            .any(|c| c == '/' || c == '\\' || c.is_control())
    {
        return Err("Invalid export filename".into());
    }
    let extension = name.rsplit_once('.').map_or("txt", |(_, ext)| ext);
    let Some(path) = app
        .dialog()
        .file()
        .set_file_name(&name)
        .add_filter(extension.to_uppercase(), &[extension])
        .blocking_save_file()
    else {
        return Ok(false);
    };
    match path {
        tauri_plugin_fs::FilePath::Path(path) => {
            let parent = path.parent().ok_or("Invalid destination")?;
            let mut file = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
            file.write_all(&bytes).map_err(|e| e.to_string())?;
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
            file.write_all(&bytes).map_err(|e| e.to_string())?;
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
            transpose,
            import_files,
            settings,
            save_settings,
            preview_backup,
            restore_backup,
            export_backup,
            save_export,
            midi_ports,
            midi_connect,
            midi_open_song,
            prepare_track,
            detect_pitch
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
