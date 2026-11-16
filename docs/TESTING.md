# Verification

| Suite | Reproduction command | Coverage |
| --- | --- | --- |
| Rust unit and integration | `cargo test --locked -p muse-core` | Chord recognition, slash bass, transposition, text alignment, title/artist/body search, repeated set entries, cascade, settings, local document, annotation and audio persistence, invalid signatures, unsafe ZIPs and checksums, transactional rollback, MIDI encoding and input mapping, synthetic chromatic pitch. |
| Private original fixture | `cargo test --locked -p muse-core restores_untouched_original_fixture -- --ignored --exact` | Original SHA-256, 6,630 records, metadata counts, both set order digests, archive provenance, corruption, duplicate reuse, ordered foreign keys and repeated merge. |
| Windows WebView2 | After `npm run tauri -- build --debug --no-bundle`, run `npm run test:ui` | Normal application entry point, editor and live preview, persistent Rust database commands, pitch controls, set selection, desktop/tablet/phone viewports, backup preview and merge, canvas pixels, ink save and reopen, WAV metadata, tuner UI, native MIDI enumeration command. |
| Dependency audit | `npm audit` | JavaScript lockfile advisories. |

Private backup testing covers the supplied text-only sample and its compact-sidebar preference. Native backup tests include simulated small attachments. Original PDF, image and audio carriers, additional settings and drawing restoration need controlled examples. Export into an original installation is **NOT EXECUTED**.

The MIDI byte tests use defined input packets and check message order. They do not instantiate a physical MIDI device. USB/BLE connection recovery, audible audio, physical microphone, stylus, background/wake-lock, screen readers, native print dialogs and signed installer execution are **NOT EXECUTED**. Tests on emulated DOM viewport widths exercise application layouts inside Windows WebView2. Those runs do not substitute for a phone, tablet or platform compositor.

The original fixture exercises a large record import. Measurements for huge PDFs, prolonged stage use, memory and startup budgets, large audio archives and real-time transport remain pending. Sync and collaboration tests require an implementation.
