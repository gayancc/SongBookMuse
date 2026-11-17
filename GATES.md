# Gates: SongBookMuse
OWNS: Cargo.toml, Cargo.lock, crates/**, src-tauri/**, ui/**, docs/**, .github/**, README.md, package.json, package-lock.json, .gitignore, index.html, vite.config.ts, tsconfig.json

Scope: Independently build and verify an offline-capable Rust songbook and track reference parity.

- [x] G1: Identify the reference release and observe authorized Windows navigation.
  EVIDENCE: Official 26.0 release notes, installed 26.0.2.0, REA PE resource evidence and UI observations in docs/rea/EVIDENCE_REGISTER.md.
- [ ] G2: Public and observed workflows are mapped exhaustively to the requested modules.
  EVIDENCE: 108 indexed functions with public and local evidence. Recursive runtime verification remains open.
- [x] G3: Core workflows pass reproducible Rust integration tests.
  CHECK: cargo test -p muse-core
  EXPECT: 0 failed
  EVIDENCE: automatic-evidence=v1; definition-sha256=65a40792e313a0115b4046d8e533bf12040359d942abc116ba3168680a286693; exit=0; EXPECT=matched; output-sha256=7c5811c7b9ceb91b488c869d661070a74530cee512579fbe5c1056f969c42293; output-bytes=1291; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\Codes\SongBookMuse; path=c8a4f6aa405f/77 entries
- [x] G4: The application produces a Windows binary and exercises the normal desktop entry point.
  EVIDENCE: Debug x64 NSIS bundle built and four Playwright tests passed using the native WebView2 binary.
- [x] G5: Responsive workflows are exercised at desktop, tablet and phone viewport sizes.
  EVIDENCE: Windows Playwright suite verified 1360, 900 and 390 CSS-pixel viewport workflows.
- [ ] G6: An original backup restores with all verified records and relationships.
  EVIDENCE: The supplied text records, sets, linked tombstones and compact preference passed. Legacy drawing rendering, additional settings and external attachment types remain open.
- [ ] G7: Performance, annotation, audio, MIDI, sync and collaboration parity are demonstrated.
  EVIDENCE: pending
- [ ] G8: Native packages pass on every target family.
  EVIDENCE: Windows x64 NSIS and Android ARM64 APK debug packaging verified. Other hosts, production signing and physical-device checks are pending.
- [x] G9: The supplied original text library migrates safely with both non-destructive merge and explicit replacement.
  EVIDENCE: Untouched SHA-256-checked fixture passed original Rust and Windows tests. Both set order digests, 41 entries, 9 linked tombstones, compact preference and repeated merge were checked.

- [x] G10: Active main is synchronized with its upstream and the divergent Claude worktree is preserved.
  EVIDENCE: Fetch succeeded, main and origin/main were both ee68a56, rev-list returned 0/0, and the separate clean worktree at cc68504 diverges after ed71d64.
- [x] G11: The continued implementation records each module, its evidence, and unresolved feature-level gaps.
  EVIDENCE: docs/COMPLETION_MATRIX.md links reference evidence, tests and outcome boundaries.
- [x] G12: Chord diagrams work in both scroll and fit layouts, preserving current layout and stored preferences.
  EVIDENCE: Eight diagram integration tests plus four internal unit cases passed. Windows exercised fit and scroll diagrams, instrument and handedness changes and inline focus.
- [x] G13: Chords-over-lyrics annotations and supported SongbookPro tag directives survive import, rendering, and transposition where applicable.
  EVIDENCE: Four reference_chart tests passed for comments, chord alignment, ordinary lyrics and tag search after import.
- [x] G14: Restore preserves data integrity and the original fixtures keep their source hashes.
  EVIDENCE: Ten other workflow tests and the original fixture passed, including duplicate ZIP rejection, original folder memberships and aggregate provenance rollback. Both genuine file SHA-256 values match R2 and R3.
- [x] G15: The current Windows build passes the application workflows and original fixture restore.
  EVIDENCE: Fresh Windows debug build and all 11 Playwright tests passed. The same source passed all 56 Rust tests, including the original fixture.
- [x] G16: Windows persists entry-specific section arrangements and desktop drag reorder.
  EVIDENCE: Both dedicated Windows workflows passed with reload. Rust v1/v2 migrations, note constraint and arrange/merge cases passed.
- [x] G17: Chart auto-scroll, PDF color inversion and keyboard pedal mappings work through the existing Windows controls.
  EVIDENCE: Three Windows workflows and controlled REA scenarios passed. Physical pedal and fixed-page auto-scroll remain outside these checks.
- [x] G18: The current ARM64 debug APK contains the native Rust shell and has a valid APK signature.
  EVIDENCE: Android build succeeded with installed JDK 17 and NDK 28.2.13676358. apksigner verified APK Signature Scheme v2 and archive inspection found lib/arm64-v8a/libmuse_shell.so. REA inventory ev_2bbfed48ec6f744b0f62ccbd86dd058568778843d79f3968787f1f1d5616b81c.
- [x] G19: Text color and highlighting apply only to the intended lyrics and survive section arrangement.
  EVIDENCE: Rust checked reset, chorus recall and reordered sections. Windows checked editor and fit viewer CSS. REA captured the styled lyric in Muse.
- [x] G20: Default chart scroll time and half-viewport overscroll persist and work from Studio settings.
  EVIDENCE: Windows measured the extra half viewport and reloaded the setting. Rust verified native backup round trip. REA recorded the enabled scroll layout and configured default.
