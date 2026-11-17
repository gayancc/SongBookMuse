# Functional behavior matrix

The columns describe the current Muse behavior or the unresolved implementation. Shared module metadata identifies the entry point, boundary and test family. Reference evidence is in the inventory. Runtime-specific side effects and exact errors remain unknown unless the evidence register indicates an executed check.

## A. Song library

Entry and navigation are **Library**. Implementation boundary is **muse-core store**. Required checks cover **Library CRUD and reopen**. See [platform differences](PLATFORM_DIFFERENCES.md), [storage and dependencies](DATA_MODEL.md), [workflow side effects](WORKFLOW_MAP.md), and [errors](EDGE_CASES.md).

| ID | Purpose | Inputs and settings | Output or state change | Evidence status |
| --- | --- | --- | --- | --- |
| A01 | Create song | Title, artist and source | Stores a new song with stable ID | DOCUMENTED |
| A02 | Edit song | Song metadata and source | Updates song by stable ID | DOCUMENTED |
| A03 | Delete song | Song ID | Deletes song and its entries with foreign keys | DOCUMENTED |
| A04 | Duplicate detection | Exact title and source | Reuses library match during import and merge | DOCUMENTED |
| A05 | Search | Title, artist, source and tags | Matches Unicode-lowercased substrings | VERIFIED |
| A06 | Filter and sort | Song list order options | Title, artist and Favorites in Muse | VERIFIED |
| A07 | Tags | Song classification | Editable tags and search | DOCUMENTED |
| A08 | Folders | Membership and folder management | Open | DOCUMENTED |
| A09 | Favorites | Equivalent workflow unknown | Starred song filter in Muse | UNKNOWN |
| A10 | Recently modified | Modification timestamp | Present in original backup, no UI view | INFERRED |
| A11 | Sharing | Song and format | Local export and print paths | DOCUMENTED |
| A12 | Batch import | Individual or multiple files | One batch transaction | DOCUMENTED |
| A13 | Move or copy between libraries | Source and destination | Group library workflows open | DOCUMENTED |

## B. Editor and content

Entry and navigation are **Song editor**. Implementation boundary is **muse-core music and SongEditor**. Required checks cover **Parser and metadata cases**. See [platform differences](PLATFORM_DIFFERENCES.md), [storage and dependencies](DATA_MODEL.md), [workflow side effects](WORKFLOW_MAP.md), and [errors](EDGE_CASES.md).

| ID | Purpose | Inputs and settings | Output or state change | Evidence status |
| --- | --- | --- | --- | --- |
| B01 | ChordPro source | Directive and chord syntax | Editable source with basic directives | DOCUMENTED |
| B02 | Chords over lyrics | Chord column and lyrics | Conservative recognition and inferred offsets | DOCUMENTED |
| B03 | Section markers | Verse, chorus, bridge and comments | Viewer headings | DOCUMENTED |
| B04 | Section ordering | Presentation sequence and reuse | Open | DOCUMENTED |
| B05 | Chord grids | Bar notation and chord tokens | Preserves source, structured rendering open | DOCUMENTED |
| B06 | Metadata | Title, subtitle, artist, key, tempo, meter, duration, capo and copyright | Common fields editable; composer and wider directives open | DOCUMENTED |
| B07 | Formatting directives | Source styling, grouping and alignment | Most remain verbatim in source | DOCUMENTED |
| B08 | Undo and redo | Editor history | Native textarea editing history | UNKNOWN |
| B09 | Preview | Source to viewer layout | Rust line model and live preview | DOCUMENTED |
| B10 | Representation conversion | Different song notations | Muse parses chord rows for display; conversion export open | DOCUMENTED |

## C. Chord engine

Entry and navigation are **Song details and display**. Implementation boundary is **muse-core music**. Required checks cover **Musical transposition cases**. See [platform differences](PLATFORM_DIFFERENCES.md), [storage and dependencies](DATA_MODEL.md), [workflow side effects](WORKFLOW_MAP.md), and [errors](EDGE_CASES.md).

| ID | Purpose | Inputs and settings | Output or state change | Evidence status |
| --- | --- | --- | --- | --- |
| C01 | Chord parsing | Root, quality, extensions and bass | Parses notes and supported modifiers | DOCUMENTED |
| C02 | Transpose | Signed semitones | Wraps pitches and shifts slash bass | DOCUMENTED |
| C03 | Capo | Fret and key adjustment | Separate global and set capo offsets | DOCUMENTED |
| C04 | Accidentals | Preferred spellings | Flats or sharps when shifting | DOCUMENTED |
| C05 | Alternate notation | Nashville, Latin and German notation | Open | DOCUMENTED |
| C06 | Chord diagrams | Tuning, instrument, fingering, handedness | Open | DOCUMENTED |
| C07 | Known chords and voicings | Hidden chords and per-song variants | Open | DOCUMENTED |

## D. Setlists

Entry and navigation are **Setlists**. Implementation boundary is **muse-core store and SetEditor**. Required checks cover **Order, duration and restore**. See [platform differences](PLATFORM_DIFFERENCES.md), [storage and dependencies](DATA_MODEL.md), [workflow side effects](WORKFLOW_MAP.md), and [errors](EDGE_CASES.md).

| ID | Purpose | Inputs and settings | Output or state change | Evidence status |
| --- | --- | --- | --- | --- |
| D01 | Set CRUD | Name and date | Persistent create, edit and delete | DOCUMENTED |
| D02 | Duplicate set | Existing ordered entries | Creates separate set and entry IDs | DOCUMENTED |
| D03 | Membership | Song ID and set ID | Add or remove songs, including repeat occurrences | DOCUMENTED |
| D04 | Reorder | Order position | Keyboard-accessible step buttons | DOCUMENTED |
| D05 | Pin and search | Set title and pin state | Pin priority and title query | DOCUMENTED |
| D06 | Grouping | Set library organization | Open | UNKNOWN |
| D07 | Duration | Song durations | Sum of known durations per entry | DOCUMENTED |
| D08 | Print overview | Set and heading | Printable ordered list | DOCUMENTED |
| D09 | Share and randomize | Set export and random order | Open | DOCUMENTED |
| D10 | Keep position | Set and current entry | In-session selection, persisted position open | UNKNOWN |
| D11 | Mixed formats | Text and fixed-page songs | Single song foreign key across formats | DOCUMENTED |
| D12 | Missing or deleted song | Set item source is removed | Muse live deletion cascades; original linked tombstones become archived songs | VERIFIED |
| D13 | Notes items | Text-only set item | Open; song notes are supported | DOCUMENTED |

## E. Performance

Entry and navigation are **Viewer and performance toolbar**. Implementation boundary is **React viewer and Tauri window**. Required checks cover **Native layout, touch and active session**. See [platform differences](PLATFORM_DIFFERENCES.md), [storage and dependencies](DATA_MODEL.md), [workflow side effects](WORKFLOW_MAP.md), and [errors](EDGE_CASES.md).

| ID | Purpose | Inputs and settings | Output or state change | Evidence status |
| --- | --- | --- | --- | --- |
| E01 | Fullscreen | Toolbar or gesture entry | Native request and app layout switch | DOCUMENTED |
| E02 | Page navigation | PDF page index and boundaries | Local on-demand PDF rendering with page controls | DOCUMENTED |
| E03 | Vertical scrolling | Song content and key actions | Viewport scroll, PageUp/PageDown and Space | DOCUMENTED |
| E04 | Columns | Display layout | Optional responsive two columns | DOCUMENTED |
| E05 | Auto layout and fit | Viewport and song size | Open | DOCUMENTED |
| E06 | Orientation | Landscape and portrait | Responsive grid and one-task phone view | DOCUMENTED |
| E07 | Pinch and reset | Zoom interactions | Slider zoom; pinch and reset controls open | DOCUMENTED |
| E08 | Swipe | Directional swipe | Song navigation in performance mode | DOCUMENTED |
| E09 | Touch regions | Custom actions and transposition | Open | DOCUMENTED |
| E10 | Screen wake lock | Fullscreen state | Best-effort WebView Screen Wake Lock API | DOCUMENTED |
| E11 | Keyboard and pedal | Page and song actions | Keyboard arrows and paging; hardware MIDI mapping open | DOCUMENTED |
| E12 | Stage contrast | High legibility and control positioning | Contrast theme and larger stage buttons; repositioning open | DOCUMENTED |

## F. Annotations

Entry and navigation are **Document and song details**. Implementation boundary is **DocumentView and store**. Required checks cover **Pointer stroke, persistence and page bindings**. See [platform differences](PLATFORM_DIFFERENCES.md), [storage and dependencies](DATA_MODEL.md), [workflow side effects](WORKFLOW_MAP.md), and [errors](EDGE_CASES.md).

| ID | Purpose | Inputs and settings | Output or state change | Evidence status |
| --- | --- | --- | --- | --- |
| F01 | Freehand and touch | Page-relative stroke | SVG ink overlay for fixed pages | DOCUMENTED |
| F02 | Stylus | Pen input and pressure | Pointer Events path; physical validation and pressure open | UNKNOWN |
| F03 | Brush and highlight | Stroke color, width, highlighter | Color choice; width and highlight open | DOCUMENTED |
| F04 | Erase, undo and redo | Stored or pending page strokes | Last-stroke undo and redo; eraser open | DOCUMENTED |
| F05 | Notes | Typed song notes | Persistent text notes | DOCUMENTED |
| F06 | Scaling | Page coordinates and zoom | Normalized coordinates for PDF or image | DOCUMENTED |
| F07 | Original annotation import | Encoded drawing data | Original bytes preserved; renderer and coordinate transform open | VERIFIED |
| F08 | Annotation export and sync | Ink, drawing and transport | Muse backups preserve ink; original-compatible export and sync open | UNKNOWN |

## G. Metronome, tuner and audio

Entry and navigation are **Performance tools**. Implementation boundary is **Web Audio and future native drivers**. Required checks cover **Audio output and hardware signal cases**. See [platform differences](PLATFORM_DIFFERENCES.md), [storage and dependencies](DATA_MODEL.md), [workflow side effects](WORKFLOW_MAP.md), and [errors](EDGE_CASES.md).

| ID | Purpose | Inputs and settings | Output or state change | Evidence status |
| --- | --- | --- | --- | --- |
| G01 | Metronome | Tempo and meter | Generated click and visual beat counter | DOCUMENTED |
| G02 | Chromatic tuner | Mono samples and a 440 Hz reference | Rust estimates the note, octave and tuning offset. Microphone capture requires device verification. | DOCUMENTED |
| G03 | Local backing tracks | WAV or MP3, song association and transport | Validates and stores the file, then opens a local player with the song. | DOCUMENTED |
| G04 | Online player and ambient pads | Provider and audio assets | Open | DOCUMENTED |
| G05 | Device and lifecycle | Audio devices, Bluetooth and interruptions | Open | UNKNOWN |

## H. MIDI and controllers

Entry and navigation are **Pedals and Controllers**. Implementation boundary is **Rust MIDI and native platform adapters**. Required checks cover **Encoder, mapping and physical loopback**. See [platform differences](PLATFORM_DIFFERENCES.md), [storage and dependencies](DATA_MODEL.md), [workflow side effects](WORKFLOW_MAP.md), and [errors](EDGE_CASES.md).

| ID | Purpose | Inputs and settings | Output or state change | Evidence status |
| --- | --- | --- | --- | --- |
| H01 | Device discovery | OS MIDI endpoint | Native desktop port enumeration through midir. | DOCUMENTED |
| H02 | Connection management | Input and output selection | Explicit connect/disconnect. Failed output send clears the connection and requests reconnect. | DOCUMENTED |
| H03 | Input mapping | Channel, number, CC or Note On | Maps to next/previous song or page up/down. | DOCUMENTED |
| H04 | Output messages | PC, CC, note, channels and bank select | Validates channel and 7-bit data before encoding. | DOCUMENTED |
| H05 | Ordered song trigger | Per-song event sequence | Sends in order on selection through the active desktop port. | DOCUMENTED |
| H06 | Foot pedals | Next, previous and page operations | Keyboard and desktop MIDI mappings. | DOCUMENTED |

## I. Import, export and documents

Entry and navigation are **Library import and song actions**. Implementation boundary is **Rust import and PDF.js**. Required checks cover **File, rendering and round-trip tests**. See [platform differences](PLATFORM_DIFFERENCES.md), [storage and dependencies](DATA_MODEL.md), [workflow side effects](WORKFLOW_MAP.md), and [errors](EDGE_CASES.md).

| ID | Purpose | Inputs and settings | Output or state change | Evidence status |
| --- | --- | --- | --- | --- |
| I01 | Text and ChordPro | TXT and common ChordPro extensions | UTF-8 and BOM UTF-16 with source retention | DOCUMENTED |
| I02 | PDF and image import | PDF, PNG, JPEG and WebP | File signature and byte bounds | DOCUMENTED |
| I03 | PDF view | Document page index | Local worker-backed canvas | DOCUMENTED |
| I04 | DOCX, SBP, OnSong and ZIP | External file types | Original-format support open | DOCUMENTED |
| I05 | Document replacement | New attachment and old page anchors | Open | DOCUMENTED |
| I06 | Song export | Text source or existing attachment | ChordPro export or original file bytes | DOCUMENTED |
| I07 | Set export and PDF print | Set and print settings | Set overview print path; rendered PDF generation open | DOCUMENTED |
| I08 | Camera and OCR | Photos and recognized source | Open | DOCUMENTED |

## J. Backup

Entry and navigation are **Settings and restore preview**. Implementation boundary is **muse-core backup and store**. Required checks cover **Fixture, corruption and transaction cases**. See [platform differences](PLATFORM_DIFFERENCES.md), [storage and dependencies](DATA_MODEL.md), [workflow side effects](WORKFLOW_MAP.md), and [errors](EDGE_CASES.md).

| ID | Purpose | Inputs and settings | Output or state change | Evidence status |
| --- | --- | --- | --- | --- |
| J01 | Original ZIP and checksum | SongbookPro version 1.0 archive | Bounded parser and MD5 check | VERIFIED |
| J02 | Song restore | Text source and selected metadata fields | Original fixture text records restored | VERIFIED |
| J03 | Set restore | Order, set and song IDs | Both fixture sets and all 41 entries restored | VERIFIED |
| J04 | Integrity limits | Large or malformed archive | Reject traversal, invalid checksum, excess bytes and invalid links | VERIFIED |
| J05 | Preview and modes | Validated file and restore mode | Shows counts; transactional merge and replace | DOCUMENTED |
| J06 | Duplicates | Exact title and source identity | First matching song reused in merge; all records in replace | DOCUMENTED |
| J07 | Settings | settings.hive | CRC-checked frames. Replace applies the compact library preference, and the archive retains the other values. | VERIFIED |
| J08 | Drawing data | Legacy page drawing blob | Retained opaque | VERIFIED |
| J09 | PDF, image and audio | Original attachments | Awaiting controlled fixture covering these types | BLOCKED |
| J10 | Own backup | Versioned snapshot | Native JSON round-trip including retained archive | UNKNOWN |
| J11 | Original-compatible export | Original format and restore result | Awaiting format coverage and controlled restore profile | BLOCKED |

## K. Sync and collaboration

Entry and navigation are **Settings and library switching**. Implementation boundary is **Rust sync protocol and backend**. Required checks cover **Offline changes, conflict and roles**. See [platform differences](PLATFORM_DIFFERENCES.md), [storage and dependencies](DATA_MODEL.md), [workflow side effects](WORKFLOW_MAP.md), and [errors](EDGE_CASES.md).

| ID | Purpose | Inputs and settings | Output or state change | Evidence status |
| --- | --- | --- | --- | --- |
| K01 | Offline library | Local song library | No account required | DOCUMENTED |
| K02 | Personal sync | Provider, devices, status and policy | Architecture candidate only | DOCUMENTED |
| K03 | Conflicts | Revisions, offline mutations and merge | Architecture candidate only | UNKNOWN |
| K04 | Groups | Membership, roles and organization | Open | DOCUMENTED |
| K05 | Shared publishing | Songs, sets and permission checks | Open | DOCUMENTED |
| K06 | Manager | Browser connection and editing | Open | DOCUMENTED |

## L. Settings

Entry and navigation are **Settings and song details**. Implementation boundary is **Rust Settings and SQLite**. Required checks cover **Persistence and UI controls**. See [platform differences](PLATFORM_DIFFERENCES.md), [storage and dependencies](DATA_MODEL.md), [workflow side effects](WORKFLOW_MAP.md), and [errors](EDGE_CASES.md).

| ID | Purpose | Inputs and settings | Output or state change | Evidence status |
| --- | --- | --- | --- | --- |
| L01 | Theme | Dark and light appearance | Dark, light and high contrast | VERIFIED |
| L02 | Song display | Font, color, size, long lines and layout | Zoom, columns and accidentals; full formatting open | DOCUMENTED |
| L03 | Interface behavior | Hide top bar, compact sidebar and set numbering | Set numbering shown; remaining options open | VERIFIED |
| L04 | Live buttons | Visibility, placement and order | Open | DOCUMENTED |
| L05 | Pedals, MIDI and audio | Device and action preferences | Open | DOCUMENTED |
| L06 | Chords | Diagram rules and instruments | Open | DOCUMENTED |
| L07 | Printing | Page size, color, charts and overview | Print stylesheet; configurable options open | DOCUMENTED |
| L08 | Backup and sync | Manual backup, auto schedule and accounts | Manual backup and restore; sync and scheduling open | VERIFIED |
| L09 | Accessibility | Keyboard, contrast and touch interactions | Semantic controls and high contrast; assistive device checks open | UNKNOWN |
