# SongBookMuse

An offline-first digital songbook built on Rust, SQLite and Tauri 2. Use it to organize a song library, edit and transpose ChordPro charts, prepare setlists, and annotate PDFs and images. The desktop build also includes backing-track playback, a metronome, a chromatic tuner and MIDI configuration.

## Run on Windows

Double-click [Run-SongBookMuse.bat](Run-SongBookMuse.bat). It opens an existing build or builds the app on first launch.

Use current stable Rust with MSVC, Node.js 22.13 or newer, and WebView2. Install any remaining Windows dependencies from the [Tauri setup guide](https://v2.tauri.app/start/prerequisites/).

```powershell
npm ci
npm run tauri -- dev
```

Windows x64 and Android ARM64 debug packages have been built. Windows UI tests passed, and Android device testing remains open. See the [build instructions](docs/BUILD.md) for package commands and platform status.

## Restore a backup

Open **Settings → Restore backup**, select a backup file, and review the counts. **Merge** reuses exact title/body matches and preserves current preferences. **Replace** replaces the current library and preserves separate records from the backup. The app validates the file before either action.

You can create a native backup from **Settings → Export backup**.

## Verify

```powershell
cargo test -p muse-core
cargo test -p muse-core restores_untouched_original_fixture -- --ignored --exact
npm run tauri -- build --debug --no-bundle
npm run test:ui
```

The private fixture is excluded from source control. Run its test when you have access to the original sample. The test checks its exact SHA-256. Set `MUSE_SBP_FIXTURE` if the sample is stored outside `fixtures/private`. The Windows UI suite uses a temporary SQLite library and a separate WebView2 profile.

See [build and distribution](docs/BUILD.md) and [testing](docs/TESTING.md) for platform support and verification.
