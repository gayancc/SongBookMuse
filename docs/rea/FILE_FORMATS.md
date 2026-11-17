# File formats

| Format | Evidence and coverage |
| --- | --- |
| ChordPro | E02–E03. Muse accepts common extensions and bracket chords, lyric lines, basic headings and selected standard metadata. Source remains editable and exportable. |
| Plain text | Muse accepts UTF-8 and BOM-marked UTF-16 and recognizes chord rows under a conservative all-chord-token rule. Chords above lyrics use character offsets. |
| PDF | Reference supports import and fixed-page viewing. Muse imports bytes up to 24 MiB and renders visible pages with PDF.js. It exports original PDF bytes separately from Muse annotations. |
| PNG, JPEG, WebP | Muse validates type signatures, imports as fixed-page songs and retains the bytes. Camera acquisition and OCR are open. |
| DOCX, SBP, OnSong, generic ZIP | DOCX and archive needs remain open. E02 documents SongbookPro and OnSong import; individual binary format compatibility needs original fixtures. |
| Muse backup | ASCII signature `SongBookMuse backup 1\n` followed by UTF-8 JSON with songs, sets, settings and retained migration archives. Limits apply before or during parsing. |
| SongbookPro backup | Original fixture E12 is the test oracle. Supported case below. |

## E12 original backup

- 3,498,891 bytes. Local-file header starts `50 4b 03 04`. Root members use ZIP method 8 (Deflate).
- `dataFile.txt` expands to 11,656,721 bytes and starts with ASCII `1.0\r\n`. The remainder is UTF-8 JSON with `songs`, `sets` and `folders`.
- `dataFile.hash` is 32 ASCII hexadecimal characters matching MD5 of the entire expanded `dataFile.txt`, including version and CRLF. This is a corruption check. It provides no authorship authentication.
- `settings.hive` is a 1,998-byte stream of 59 Hive frames. Each observed frame starts with a little-endian inclusive length, contains a type-tagged key and value, and ends with a matching CRC-32 of the preceding frame bytes. The setting named `currentVersion` stores `25.1.13`. The observed latest `smallSideBarItems` payload is a Hive Boolean with value true, mapped to compact library rows on replacement. Other settings stay in the source archive.
- **INFERRED** legacy key indexes 0–11 represent the chromatic major scale starting at A. Indexes 12–23 represent the chromatic minor scale starting at F♯ minor. Every index was compared with the most frequent first and last bracket-chord pitch in E12. Muse uses the inferred spelling when a chart has no explicit key directive. Original numeric values remain in the archived data.
- Songs have numeric `Id`, `type`, `key`, `KeyShift`, `Capo`, `TempoInt`, `Duration` and `Duration2`. Text fields include `name`, `author`, `subTitle`, `content`, `timeSig`, `Copyright` and `NotesText`. Additional fields include `SyncId`, `ModifiedDateTime`, `Deleted`, `_tags`, `_folders`, `SectionOrder`, `LinkedAudio`, `midiOnLoad`, `drawingPathsBackup` and per-song presentation state. Unknown and duplicate metadata remains recoverable from the retained bytes.
- The 6,630 song records are all `type=1`. There are 6,621 active rows and 9 deleted rows, each linked from a set. Active rows contain 3,329 distinct exact title/source pairs.
- Sets contain a `details` object and a `contents` array. Entry `SetId` joins to the set detail ID. Entry `SongId` joins to the song numeric ID. `Order` gives position. All 41 E12 entries are song records of `ItemType=1`. The two sets have 24 and 17 entries.
- `drawingPathsBackup` occurs as one nonempty set-entry string. It is Base64 representing 14 bytes, consistent with a compact binary message containing two fixed-width floats. Shape, rendering semantics and coordinate calibration remain unknown.
- The sample has zero folders, PDF/image attachments or linked audio. It supplies no evidence about their byte carriers or schema revisions.
- Restore accepts this observed version and text record type. An unknown active record type fails preview before applying changes. Preview preserves the supplied archive as provenance. Replace keeps separate records. Merge reuses exact name/source matches and remaps every set entry, keeping referenced archived songs outside the active library.
- ZIP members are never extracted to the filesystem. The parser bounds the archive and expanded payload, rejects unsafe paths and symlink entries, validates the checksum, and verifies record identifiers and set foreign keys. Library replacement occurs only within a transaction.
