# Gap analysis

Updated November 16, 2026 after the REA re-analysis of the installed Windows 26.0.2.0 build (E16, E17).

## Closed in this pass

| Area | Evidence | Muse change | Verification |
| --- | --- | --- | --- |
| Folders | E16 `tables/folder.dart`, `sidebar/folders/*`; E17 `Folders` DDL, `Songs._folders` | Folder CRUD, song membership, browser filter, backup and restore | Rust `folders_assign_and_delete_without_losing_songs`; Windows UI folder flow |
| Set note items | E16 `objects/setNotes.dart`, `SetNoteRenderer`; E17 `SetItems.ItemType`, `Content`, "Add Note" | Note entries (schema v2): add, edit, move, remove, note sheet, print | Rust `note_items_round_trip_through_sets_and_native_backups`; UI note flow |
| Section order | E16 `dialogs/section_order.dart`; E17 `SectionOrder` columns | Per-song order with repeats; inspector sequencer; `{chorus}` recall | Rust section-order and chorus tests; UI reorder flow |
| Nashville notation | E17 "Nashville Notation" | Degrees relative to the song key, including slash bass and borrowed chords | Rust `nashville_numbers_are_relative_to_the_song_key`; UI toggle |
| Key-aware accidentals | INFERRED musical convention | Transposed chords spelled from the target key (Bb, not A#, in F) | Rust spelling and display-key tests; UI asserts `Bbm` |
| Tab and grid blocks | ChordPro standard (E03) | `{sot}` and `{sog}` render preformatted without chord parsing | Rust tab test |
| Auto-scroll | E16 `live_action_buttons/autoScroll.dart`; E17 duration and delay strings | Delay plus duration-based scroll, adjustable time, keyboard A, stage button | Build only; manual check pending |
| Highlighter and eraser | E17 "Highlighter", "Eraser" | Translucent highlighter, stroke eraser, width | Build only; pointer tests cover the pen |
| Song lock and number | E17 `Songs.locked`, `SongNumber` | Lock disables edit, delete and ink; number shown and sortable | Build only |
| Shuffle | E17 "Random", "Random Toggle" | Setlist shuffle | Build only |

- **Chord diagrams** (E16 instrument models and `ChordBuilder`, E17 strings "Left handed chord charts", "Chord diagram location"): `muse-core::diagrams` spells chords into intervals and returns fingerings (frets per string, barre, base fret) from a hand-entered table of common shapes plus a generator constrained by stretch, finger count, muting and bass rules. Instruments: guitar, ukulele, mandolin, banjo (open G, drone string open or muted). Settings `instrument`, `left_handed`, `diagram_location` (off/top/inline) are validated in `validate_settings`. Tauri commands `chord_diagram` and `song_chords`; React `ChordDiagram` SVG strip with a toolbar toggle. Tests: `crates/muse-core/tests/diagrams.rs` checks every fingering for 12 roots × 18 qualities × 4 instruments (only chord tones sound, root and required tones present, guitar bass correct), plus the Windows UI test for the strip, left-handed mirroring and instrument switch. No reference voicing data was copied.

## Bugs fixed

- Keyboard paging and set navigation were ignored after clicking any button because focus stayed on the button. Covered by the Windows UI test that clicks Perform and then presses ArrowLeft.
- Lyrics-only mode left blank rows for chord-only lines.
- Transposition spelled chords from the global flat preference only, producing A# in F major.
- Imports while a folder or favorites filter was active reported success but showed nothing.
- Opening a song briefly rendered an empty chart (render debounce applied to the first render).

## Still open

- **Original migration**: folders, note items, section order, lock and song numbers are not yet read from `.sbpbackup`; the reader still rejects non-song set items. Needs a controlled fixture with these features.
- **Content**: song variants (`ParentId`), templates, per-section lyric formatting (`LyricFormat2`), custom chord definitions (`Chords`), set timers. Fit-to-screen is implemented (E18, docs/design/FIT_LAYOUT.md).
- **Chord diagrams**: a separate diagram-size setting, user-defined known-chord lists and custom chord definitions (`Chords`) remain open; the reference's own voicing choices are not evidenced, so Muse voicings may differ (E16, E17).
- **Performance**: configurable touch regions (`TouchEventEditor`), live-button layout, pinch zoom, next-page indicators.
- **Hardware and services**: physical MIDI and pedal checks, keyboard pedal mapping (`Pedals`), cloud sync providers (Dropbox, Google Drive, OneDrive, WebDAV), groups.
- **Distribution**: unchanged; Windows x64 and Android ARM64 debug packages only.
