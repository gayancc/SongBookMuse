# Feature parity matrix

TESTED indicates a bounded Muse automated test. It does not establish full parity with the reference. PARTIAL scope is explained in the implementation column. Platform runs and original fixtures are reported independently.

## A. Song library

Reference evidence E02, E10. Test scope **Library CRUD and reopen**. See [evidence register](rea/EVIDENCE_REGISTER.md) and [platform runs](rea/PLATFORM_DIFFERENCES.md).

| ID | Reference area | Muse implementation and limitation | Status |
| --- | --- | --- | --- |
| A01 | Create song | Stores a new song with stable ID | TESTED |
| A02 | Edit song | Updates song by stable ID | IMPLEMENTED |
| A03 | Delete song | Deletes song and its entries with foreign keys | TESTED |
| A04 | Duplicate detection | Reuses library match during import and merge | TESTED |
| A05 | Search | Matches Unicode-lowercased substrings | TESTED |
| A06 | Filter and sort | Title, artist, number and key sort; All, Favorites and folder filters | IMPLEMENTED |
| A07 | Tags | Editable tags and search | IMPLEMENTED |
| A08 | Folders | Folder CRUD, membership, browser filter, native backup | TESTED |
| A09 | Favorites | Starred song filter in Muse | IMPLEMENTED |
| A10 | Recently modified | Present in original backup, no UI view | INVESTIGATING |
| A11 | Sharing | Local export and print paths | IMPLEMENTED |
| A12 | Batch import | One batch transaction | TESTED |
| A14 | Song lock (E17 `locked`) | Lock blocks edit, delete and ink | IMPLEMENTED |
| A15 | Song number (E17 `SongNumber`) | Editable, shown in rows and sheet, sortable | IMPLEMENTED |
| A13 | Move or copy between libraries | Group library workflows open | SPECIFIED |

## B. Editor and content

Reference evidence E03. Test scope **Parser and metadata cases**. See [evidence register](rea/EVIDENCE_REGISTER.md) and [platform runs](rea/PLATFORM_DIFFERENCES.md).

| ID | Reference area | Muse implementation and limitation | Status |
| --- | --- | --- | --- |
| B01 | ChordPro source | Editable source with basic directives | TESTED |
| B02 | Chords over lyrics | Conservative recognition and inferred offsets | TESTED |
| B03 | Section markers | Viewer headings | TESTED |
| B04 | Section ordering | Per-song section order with repeats and `{chorus}` recall | TESTED |
| B05 | Chord grids | Preserves source, structured rendering open | SPECIFIED |
| B06 | Metadata | Common fields editable; composer and wider directives open | TESTED |
| B07 | Formatting directives | Comments, tab and grid blocks render; other formatting stays in source | TESTED |
| B08 | Undo and redo | Native textarea editing history | IMPLEMENTED |
| B09 | Preview | Rust line model and live preview | IMPLEMENTED |
| B10 | Representation conversion | Muse parses chord rows for display; conversion export open | SPECIFIED |

## C. Chord engine

Reference evidence E03, E05, E09. Test scope **Musical transposition cases**. See [evidence register](rea/EVIDENCE_REGISTER.md) and [platform runs](rea/PLATFORM_DIFFERENCES.md).

| ID | Reference area | Muse implementation and limitation | Status |
| --- | --- | --- | --- |
| C01 | Chord parsing | Parses notes and supported modifiers | TESTED |
| C02 | Transpose | Wraps pitches and shifts slash bass | TESTED |
| C03 | Capo | Separate global and set capo offsets | IMPLEMENTED |
| C04 | Accidentals | Key-aware spelling from the target key; preference for ambiguous keys | TESTED |
| C05 | Alternate notation | Nashville numbers; German and Latin not evidenced | TESTED |
| C06 | Chord diagrams | Rust fingerings for guitar (EADGBE), ukulele (GCEA), mandolin (GDAE) and banjo (open G); SVG strip of the song's distinct chords above the chart or on chord names, mirrored for left-handed players; diagram size follows zoom only (separate size setting open); Nashville view falls back to the strip | TESTED |
| C07 | Known chords and voicings | Independently entered open/barre shapes for common chords plus a generator for any parseable chord, up to three voicings at distinct neck positions (click to cycle); user-defined known chords and custom chord definitions (`Chords`) open | PARTIAL |

## D. Setlists

Reference evidence E04, E09, E12. Test scope **Order, duration and restore**. See [evidence register](rea/EVIDENCE_REGISTER.md) and [platform runs](rea/PLATFORM_DIFFERENCES.md).

| ID | Reference area | Muse implementation and limitation | Status |
| --- | --- | --- | --- |
| D01 | Set CRUD | Persistent create, edit and delete | TESTED |
| D02 | Duplicate set | Creates separate set and entry IDs | IMPLEMENTED |
| D03 | Membership | Add or remove songs, including repeat occurrences | TESTED |
| D04 | Reorder | Keyboard-accessible step buttons | IMPLEMENTED |
| D05 | Pin and search | Pin priority and title query | IMPLEMENTED |
| D06 | Grouping | Open | NOT INVESTIGATED |
| D07 | Duration | Sum of known durations per entry | IMPLEMENTED |
| D08 | Print overview | Printable ordered list | IMPLEMENTED |
| D09 | Share and randomize | Shuffle implemented; sharing open | IMPLEMENTED |
| D10 | Keep position | In-session selection, persisted position open | IMPLEMENTED |
| D11 | Mixed formats | Single song foreign key across formats | TESTED |
| D12 | Missing or deleted song | Muse live deletion cascades; original linked tombstones become archived songs | TESTED |
| D13 | Notes items | Note items with add, edit, order, print and backup | TESTED |

## E. Performance

Reference evidence E02, E05, E09. Test scope **Native layout, touch and active session**. See [evidence register](rea/EVIDENCE_REGISTER.md) and [platform runs](rea/PLATFORM_DIFFERENCES.md).

| ID | Reference area | Muse implementation and limitation | Status |
| --- | --- | --- | --- |
| E01 | Fullscreen | Native request and app layout switch | IMPLEMENTED |
| E02 | Page navigation | Local on-demand PDF rendering with page controls | IMPLEMENTED |
| E03 | Vertical scrolling | Viewport scroll, PageUp/PageDown and Space | IMPLEMENTED |
| E04 | Columns | Optional responsive two columns | IMPLEMENTED |
| E05 | Auto layout and fit | Fit to screen: Rust column/scale/page optimizer with render verification; auto-scroll with delay | TESTED |
| E06 | Orientation | Responsive grid and one-task phone view | IMPLEMENTED |
| E07 | Pinch and reset | Slider zoom; pinch and reset controls open | SPECIFIED |
| E08 | Swipe | Song navigation in performance mode | IMPLEMENTED |
| E09 | Touch regions | Open | SPECIFIED |
| E10 | Screen wake lock | Best-effort WebView Screen Wake Lock API | IMPLEMENTED |
| E11 | Keyboard and pedal | Keyboard paging works with button focus; A toggles auto-scroll | TESTED |
| E12 | Stage contrast | Contrast theme and larger stage buttons; repositioning open | IMPLEMENTED |

## F. Annotations

Reference evidence E05, E12. Test scope **Pointer stroke, persistence and page bindings**. See [evidence register](rea/EVIDENCE_REGISTER.md) and [platform runs](rea/PLATFORM_DIFFERENCES.md).

| ID | Reference area | Muse implementation and limitation | Status |
| --- | --- | --- | --- |
| F01 | Freehand and touch | SVG ink overlay for fixed pages. Windows pointer and persistence tested. | TESTED |
| F02 | Stylus | Pointer Events path; physical validation and pressure open | IMPLEMENTED |
| F03 | Brush and highlight | Pen, translucent highlighter, colour swatches and width | IMPLEMENTED |
| F04 | Erase, undo and redo | Stroke eraser plus undo and redo | IMPLEMENTED |
| F05 | Notes | Persistent text notes | TESTED |
| F06 | Scaling | Normalized coordinates for PDF or image | TESTED |
| F07 | Original annotation import | Original bytes preserved; renderer and coordinate transform open | SPECIFIED |
| F08 | Annotation export and sync | Muse backups preserve ink; original-compatible export and sync open | TESTED |

## G. Metronome, tuner and audio

Reference evidence E05. Test scope **Audio output and hardware signal cases**. See [evidence register](rea/EVIDENCE_REGISTER.md) and [platform runs](rea/PLATFORM_DIFFERENCES.md).

| ID | Reference area | Muse implementation and limitation | Status |
| --- | --- | --- | --- |
| G01 | Metronome | Generated click and visual beat counter | IMPLEMENTED |
| G02 | Chromatic tuner | Rust pitch estimation and microphone UI. Physical capture remains untested. | TESTED |
| G03 | Local backing tracks | Local WAV and MP3 player with per-song association. | TESTED |
| G04 | Online player and ambient pads | Open | SPECIFIED |
| G05 | Device and lifecycle | Open | NOT INVESTIGATED |

## H. MIDI and controllers

Reference evidence E06. Test scope **Encoder, mapping and physical loopback**. See [evidence register](rea/EVIDENCE_REGISTER.md) and [platform runs](rea/PLATFORM_DIFFERENCES.md).

| ID | Reference area | Muse implementation and limitation | Status |
| --- | --- | --- | --- |
| H01 | Device discovery | Native desktop port scan. Physical USB/BLE checks and mobile access remain open. | TESTED |
| H02 | Connection management | Explicit apply/disconnect and output send error handling. Automatic recovery remains open. | IMPLEMENTED |
| H03 | Input mapping | CC and Note On map to page or song actions. Packet matching tests cover channels and release messages. | TESTED |
| H04 | Output messages | Program, control, note on/off and bank-select controller numbers. Encoder tested. | TESTED |
| H05 | Ordered song trigger | Stored events sent through the native port on song selection. Hardware delivery remains untested. | IMPLEMENTED |
| H06 | Foot pedals | Keyboard and desktop MIDI mapping. Physical pedal tests remain open. | IMPLEMENTED |

## I. Import, export and documents

Reference evidence E02, E03, E15. Test scope **File, rendering and round-trip tests**. See [evidence register](rea/EVIDENCE_REGISTER.md) and [platform runs](rea/PLATFORM_DIFFERENCES.md).

| ID | Reference area | Muse implementation and limitation | Status |
| --- | --- | --- | --- |
| I01 | Text and ChordPro | UTF-8 and BOM UTF-16 with source retention | TESTED |
| I02 | PDF and image import | File signature and byte bounds | TESTED |
| I03 | PDF view | Local worker-backed canvas with Windows pixel assertion. | TESTED |
| I04 | DOCX, SBP, OnSong and ZIP | Original-format support open | SPECIFIED |
| I05 | Document replacement | Open | SPECIFIED |
| I06 | Song export | ChordPro export or original file bytes | IMPLEMENTED |
| I07 | Set export and PDF print | Set overview print path; rendered PDF generation open | IMPLEMENTED |
| I08 | Camera and OCR | Open | SPECIFIED |

## J. Backup

Reference evidence E07, E10, E12, E13. Test scope **Fixture, corruption and transaction cases**. See [evidence register](rea/EVIDENCE_REGISTER.md) and [platform runs](rea/PLATFORM_DIFFERENCES.md).

| ID | Reference area | Muse implementation and limitation | Status |
| --- | --- | --- | --- |
| J01 | Original ZIP and checksum | Bounded parser and MD5 check | TESTED |
| J02 | Song restore | Original fixture text records restored | TESTED |
| J03 | Set restore | Both fixture sets and all 41 entries restored | TESTED |
| J04 | Integrity limits | Reject traversal, invalid checksum, excess bytes and invalid links | TESTED |
| J05 | Preview and modes | Shows counts; transactional merge and replace | TESTED |
| J06 | Duplicates | First matching song reused in merge; all records in replace | TESTED |
| J07 | Settings | Verified Hive frames. Replace applies compact library rows. Additional values retained in the source archive. | TESTED |
| J08 | Drawing data | Retained opaque | SPECIFIED |
| J09 | PDF, image and audio | Awaiting controlled fixture covering these types | BLOCKED |
| J10 | Own backup | Native JSON round-trip including retained archive | TESTED |
| J11 | Original-compatible export | Awaiting format coverage and controlled restore profile | BLOCKED |

## K. Sync and collaboration

Reference evidence E07, E08, E14. Test scope **Offline changes, conflict and roles**. See [evidence register](rea/EVIDENCE_REGISTER.md) and [platform runs](rea/PLATFORM_DIFFERENCES.md).

| ID | Reference area | Muse implementation and limitation | Status |
| --- | --- | --- | --- |
| K01 | Offline library | No account required | TESTED |
| K02 | Personal sync | Architecture candidate only | SPECIFIED |
| K03 | Conflicts | Architecture candidate only | SPECIFIED |
| K04 | Groups | Open | SPECIFIED |
| K05 | Shared publishing | Open | SPECIFIED |
| K06 | Manager | Open | SPECIFIED |

## L. Settings

Reference evidence E09, E10. Test scope **Persistence and UI controls**. See [evidence register](rea/EVIDENCE_REGISTER.md) and [platform runs](rea/PLATFORM_DIFFERENCES.md).

| ID | Reference area | Muse implementation and limitation | Status |
| --- | --- | --- | --- |
| L01 | Theme | Dark, light and high contrast | TESTED |
| L02 | Song display | Zoom, columns and accidentals; full formatting open | IMPLEMENTED |
| L03 | Interface behavior | Set numbering shown; remaining options open | IMPLEMENTED |
| L04 | Live buttons | Open | SPECIFIED |
| L05 | Pedals, MIDI and audio | Open | SPECIFIED |
| L06 | Chords | Notation and key-spelling preferences; instrument, left-handed charts and diagram location (off, top, inline) validated and persisted; diagram size open | TESTED |
| L07 | Printing | Print stylesheet; configurable options open | SPECIFIED |
| L08 | Backup and sync | Manual backup and restore; sync and scheduling open | TESTED |
| L09 | Accessibility | Semantic controls and high contrast; assistive device checks open | IMPLEMENTED |
