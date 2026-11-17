//! Startup hand-off: the main window stays hidden while the library loads and a splash plays on
//! desktop. The front end calls `app_ready` once its first data load settles; the main window is
//! then shown and the splash dissolves and closes. Android keeps its system launch screen.

use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, Runtime};

/// Label of the hidden main window declared in `tauri.conf.json`.
const MAIN: &str = "main";
/// Label of the splash window created at startup on desktop.
#[cfg(desktop)]
const SPLASH: &str = "splash";
/// Lets the splash's intro (disc, bars, title) play this long after its first paint.
const MINIMUM: Duration = Duration::from_millis(1500);
/// Never holds a ready app back longer than this from launch, even if the splash is slow to paint.
const LONGEST_HOLD: Duration = Duration::from_millis(3500);
/// Event the splash page sends after its first frame.
#[cfg(desktop)]
const SHOWN_EVENT: &str = "splash-shown";
/// Length of the splash's dissolve animation (`splash.css`).
#[cfg(desktop)]
const DISSOLVE: Duration = Duration::from_millis(480);
/// Shows the main window even if the front end never reports ready.
const FALLBACK: Duration = Duration::from_secs(20);

pub struct Startup {
    started: Instant,
    /// When the splash first painted; `None` until it reports (and always on mobile).
    shown: Mutex<Option<Instant>>,
    revealed: AtomicBool,
}

impl Startup {
    /// How long a ready app should still wait so the splash intro is not cut short.
    fn hold(&self) -> Duration {
        let from_launch = LONGEST_HOLD.saturating_sub(self.started.elapsed());
        match self.shown.lock().ok().and_then(|shown| *shown) {
            Some(shown) => MINIMUM.saturating_sub(shown.elapsed()).min(from_launch),
            None if cfg!(desktop) => from_launch,
            None => Duration::ZERO,
        }
    }
}

/// Registers the startup state and, on desktop, opens the splash over the hidden main window.
pub fn begin<R: Runtime>(app: &tauri::App<R>) -> tauri::Result<()> {
    app.manage(Startup {
        started: Instant::now(),
        shown: Mutex::new(None),
        revealed: AtomicBool::new(false),
    });
    #[cfg(desktop)]
    open_splash(app)?;
    #[cfg(mobile)]
    reveal(app.handle());
    let handle = app.handle().clone();
    std::thread::spawn(move || {
        std::thread::sleep(FALLBACK);
        reveal(&handle);
    });
    Ok(())
}

#[cfg(desktop)]
fn open_splash<R: Runtime>(app: &tauri::App<R>) -> tauri::Result<()> {
    let builder =
        tauri::WebviewWindowBuilder::new(app, SPLASH, tauri::WebviewUrl::App("splash.html".into()))
            .title("SongBookMuse")
            .inner_size(360.0, 420.0)
            .resizable(false)
            .decorations(false)
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(false)
            .center();
    #[cfg(not(target_os = "macos"))]
    let builder = builder.transparent(true);
    builder.build()?;
    let handle = app.handle().clone();
    tauri::Listener::once(app, SHOWN_EVENT, move |_| {
        if let Ok(mut shown) = handle.state::<Startup>().shown.lock() {
            shown.get_or_insert_with(Instant::now);
        }
    });
    Ok(())
}

/// Shows the main window once, then lets the splash dissolve on top of it and closes it.
fn reveal<R: Runtime>(app: &AppHandle<R>) {
    if app.state::<Startup>().revealed.swap(true, Ordering::SeqCst) {
        return;
    }
    if let Some(main) = app.get_webview_window(MAIN) {
        let _ = main.show();
        let _ = main.set_focus();
    }
    #[cfg(desktop)]
    if let Some(splash) = app.get_webview_window(SPLASH) {
        use tauri::Emitter;
        let _ = app.emit_to(SPLASH, "splash-exit", ());
        std::thread::spawn(move || {
            std::thread::sleep(DISSOLVE);
            let _ = splash.close();
        });
    }
}

/// Called by the front end when its first library and settings load has settled.
#[tauri::command]
pub async fn app_ready<R: Runtime>(app: AppHandle<R>) {
    let _ = tauri::async_runtime::spawn_blocking(move || {
        // Re-check after each short wait: the splash may report its first paint meanwhile.
        loop {
            let wait = app.state::<Startup>().hold();
            if wait.is_zero() {
                break;
            }
            std::thread::sleep(wait.min(Duration::from_millis(100)));
        }
        reveal(&app);
    })
    .await;
}
