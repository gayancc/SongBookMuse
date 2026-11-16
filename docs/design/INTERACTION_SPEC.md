# Interaction specification

- Search filters the Rust library by normalized text. Navigation can proceed while the query is pending. Stale responses are ignored.
- Library row selection opens the selected song, resets the PDF page, and restores the top of the sheet. Set row selection also establishes set position and pitch overrides.
- The source editor previews supported syntax while the draft changes. Save commits. Cancel returns to the song.
- Stage mode uses native fullscreen when supported and always expands the application's sheet area. Left and right arrows step through a set. Page Up, Page Down and Space scroll the sheet. A horizontal swipe steps songs in stage mode.
- PDF page controls clamp the index. Freehand ink captures the primary pointer and saves only after pointer-up. Cancel discards the active stroke.
- Restore shows verified format and record counts before merge or replace. A preview token binds the action to the parsed file.
