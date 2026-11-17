# Data model

## Reference fixture

`songs.Id` is the in-file song join key. `sets.details.Id` is the set join key. Each `sets.contents` record carries its own ID, set ID, song ID, order, tombstone flag, entry type and per-entry presentation fields. One song can occur in multiple positions and sets. Tombstones can still be referenced by the set data. The role of repeated song `SyncId` values is unresolved. E12 contains 3,337 unique song SyncIds across 6,630 records.

## SongBookMuse

- **Song** owns stable UUID, text source, edit metadata, play settings, notes, tags, favorite state, optional fixed document bytes and optional page-relative ink. Referenced source tombstones are imported as archived songs.
- **Setlist** owns UUID, name, date string, pin state and ordered entries. **SetEntry** owns its own UUID, song FK, position and optional pitch/capo override.
- **SongSummary** is separately indexed with a lowercase searchable field. The shell queries summaries and loads full source or attachment bytes when a song opens.
- **Settings** is a single versionable preferences record for theme, zoom, columns and accidental preference.
- **MigrationSource** owns original archive bytes keyed by SHA-256. The retained original is carried in native backups. Migration fixture content is excluded from source control.
- **Folder** owns UUID and name; songs list folder memberships (`Song.folders`). Deleting a folder removes memberships, never songs.
- **SetEntry.note** marks a note item (no song). Entries hold either a song FK or note text, enforced by a CHECK constraint.
- **Song** additionally carries `section_order`, `locked` and `number`; strokes carry `highlight`.
- **Schema v1** is applied under an immediate SQLite write transaction. **Schema v2** rebuilds `entries` with a nullable song FK and `note`, adds `folders`, and refreshes summaries in the same transaction. FK constraints are enabled on every database connection.

## Reference schema (shipped artifact, E17)

The Windows 26.0.2.0 snapshot embeds SQLite DDL for `Songs` (incl. `_folders`, `SectionOrder`, `SongNumber`, `locked`, `Zoom`, `ParentId`/`HasChildren`, `Chords`, `LinkedAudio`, `midiOnLoad`, `NotesDraw`), `SetItems` (`ItemType`, `Content`, `NotesText`, `NotesDraw`, `SectionOrder`), `Sets` (`pinned`), `Folders`, `Templates`, `Pedals`, `LyricFormat2`, `PdfCache` and `groups_*` tables. These are DDL observations only; column semantics not listed in the gap analysis remain INFERRED or UNKNOWN.
