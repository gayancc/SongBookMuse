# Build and distribution

Use current stable Rust and Node.js 22.13 or newer. Install platform dependencies from the [Tauri setup guide](https://v2.tauri.app/start/prerequisites/) and then run `npm ci` from the repository root.

| Platform | Build command | Distribution prerequisites |
| --- | --- | --- |
| Windows | `npm run tauri -- build --bundles nsis` | MSVC and WebView2. Sign binaries and installer with an Authenticode certificate for distribution. |
| macOS | `npm run tauri -- build --bundles dmg` | macOS with Xcode. Developer ID, hardened runtime and notarization for a public DMG. |
| Linux | `npm run tauri -- build --bundles deb,appimage` | WebKitGTK 4.1 and ALSA development dependencies. Build against the intended minimum distribution. |
| Android | `npm run tauri -- android build --debug --apk --target aarch64` | Android SDK, NDK and Java. Set `ANDROID_HOME` and `NDK_HOME`. The checked-in Android project uses the generated Gradle wrapper. |
| Google Play | `npm run tauri -- android build --aab` | Distribution signing and keystore setup via the [Tauri Google Play guide](https://v2.tauri.app/distribute/google-play/). |
| iPhone and iPad | `npm run tauri -- ios init` then `npm run tauri -- ios build` on macOS | Xcode, team ID, provisioning, and microphone usage description for the tuner. See [Tauri App Store guide](https://v2.tauri.app/distribute/app-store/). |

The Windows x64 debug installer and Android ARM64 debug APK were built locally. Four Windows WebView2 tests passed. Android package signature and ABI were checked. Android device execution, macOS, Linux and iOS/iPadOS builds, release signing and hosted CI are **NOT EXECUTED**.

The Windows installer is at `target/debug/bundle/nsis/SongBookMuse_0.1.0_x64-setup.exe`. The Android package is at `src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`.

The Android build used JDK 17, NDK 28.2.13676358, and the SDK's platform 37 and build-tools 36. On this host the checkout and Cargo registry reside on different drives. Kotlin's incremental compiler could not relativize those paths. The successful rerun set the process environment property `ORG_GRADLE_PROJECT_kotlin.incremental=false`.

## Data and logs

Tauri resolves a per-user application data directory for package ID `com.songbookmuse.muse`. It holds `library.sqlite3` and SQLite WAL sidecars. Export a Muse backup for migration while the app manages the database. Debug builds log native startup failures to stderr. User-triggered command errors appear in the viewer or dialog.

## Device verification

Run physical MIDI playback and input loopback on each supported desktop backend. Confirm disconnection, explicit reconnect, ordered bank select and program change. On mobile, verify safe areas, document file providers, pen input, microphone permissions, audio interruptions, wake behavior and restoration from background. These device checks are **NOT EXECUTED**.
