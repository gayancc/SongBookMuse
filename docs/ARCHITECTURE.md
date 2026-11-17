# Architecture

## Framework evaluation

Evaluated on November 16, 2026. Slint 1.19.0 and Tauri 2.12.6 were the versions located for evaluation. Both have desktop and mobile development paths. Only the Windows Tauri path has been exercised in this workspace.

| Area | Slint 1.19 | Tauri 2 | Implication |
| --- | --- | --- | --- |
| Desktop and mobile | Native declarative UI on Windows, macOS, Linux, Android and iOS. Mobile builds use the Android activity integration and Xcode on iOS. | System webviews on Windows, macOS, Linux, Android and iOS with Android Studio and Xcode build paths. | Both qualify for target coverage on paper. |
| Distribution and licensing | GPLv3, royalty-free license with attribution obligations, or commercial terms where applicable. | Core dual-licensed MIT or Apache 2.0. Native bundler and supported mobile store packaging paths. | Product dependency licenses still require review before public distribution. |
| Touch and responsive layout | Mobile safe areas, gesture and inertial scrolling support. Canvas primitives make custom music UI possible. | CSS grid, native browser selection and scrolling, and Pointer Events for mouse, touch and pen. | Tauri can use the same responsive markup from phone to desktop. |
| PDF and annotation | Requires a Rust or native PDF renderer and native pixel/page integration. | PDF.js renders locally in a worker and an SVG layer uses page-relative coordinates. | Tauri provides a direct PDF and ink path with independent rendering. |
| Accessibility and tests | Desktop accessibility APIs and Slint automation exist. Mobile assistive-technology behavior needs platform checks. | Semantic HTML, focus management, reduced motion and WebView2 CDP tests. Assistive technology still needs platform checks. | The HTML path covers ordinary controls and can be tested through the running Windows app. |
| Native integration | Rust FFI or platform glue for MIDI, BLE, audio, camera, dialogs and native background tasks. | Rust native adapters on desktop, Kotlin and Swift plugins on mobile. Dialog plugin is available. | Native adapters own hardware and app-lifecycle behavior in either framework. |
| Performance | Native rendering avoids a system browser process. PDF and dense glyph layout still need measurement. | Reuses OS webview, costs a renderer process, and can offload PDF decoding into a worker. | Treat memory and latency as measurements. Only fixture restore runtime is measured so far. |
| Maintenance | One UI language and Rust domain. More custom PDF and platform code across the project. | Rust domain plus typed React presentation. System webview differences need explicit validation. | Chosen for the existing PDF, responsive UI, accessibility and desktop verification workflows. |

Sources are the [Slint 1.19 release](https://slint.dev/blog/slint-1.19-released), [Slint platform guides](https://docs.slint.dev/latest/docs/slint/guide/platforms/), [Slint license options](https://slint.dev/pricing), [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/), [Tauri mobile plugin guide](https://v2.tauri.app/develop/plugins/develop-mobile/), and [Tauri crate release](https://docs.rs/crate/tauri/2.12.6).

## Boundaries

- **muse-core** owns ChordPro and chords-over-lyrics parsing, note spelling and transpose, import validation, record definitions, SQLite, backup compatibility, and transaction rules.
- **Tauri shell** owns local directories, command transport, file dialogs and app lifecycle. The webview cannot provide a filesystem path to the export command. The platform file dialog supplies the target.
- **React presentation** owns navigation, focus, layouts and interactions. PDF.js loads only for PDF viewing. Pointer coordinates are transformed to page-relative values before Rust persistence.
- **SQLite** stores song payloads and compact library summaries separately. Set entries use foreign keys and explicit positions. The initial migration is transactional. Backup application uses an immediate transaction. Original migration artifacts are held in a separate provenance table.
- **Device integrations** use midir on Windows, macOS and Linux. Port types and UI actions are separated from Rust message encoding and matching. USB and BLE exposure depend on the OS backend. Mobile MIDI, camera OCR and background wake behavior require platform-specific work. The tuner obtains microphone samples from the WebView and estimates monophonic pitch in Rust.
- **Sync design candidate** uses authenticated, scoped library IDs and a server-issued monotonic change cursor. Clients submit idempotent mutations with expected record revisions. Each mutation identifies an actor, library, base revision and unique mutation ID. The server returns conflicts as separate revisions for the client to resolve and stores binary blobs by digest. Delete tombstones travel in the same feed. Membership and publish permissions are enforced at the server against the destination library. This protocol has no deployed implementation.
