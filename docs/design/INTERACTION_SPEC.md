# Interaction specification

- Search filters the Rust library by normalized text. Stale responses are ignored. Collection filters (All songs, Favorites, a folder) combine with search. Importing switches the browser to All songs so new songs are visible.
- Selecting a song row opens it, resets the PDF page and returns the sheet to the top. Selecting a set item establishes set position and pitch overrides; note items open as a large note sheet.
- Keyboard: Left/Right step through the set, Page Up/Page Down and Space turn the page, A toggles auto-scroll, Escape leaves performance. Keys are honoured when a button has focus (Space stays with the button); they are ignored in text fields and open dialogs.
- Auto-scroll waits the configured delay, then moves the remaining sheet over the song duration (3:00 when unknown). Scroll time is adjustable in the inspector. Manual scrolling is respected. It stops at the end of the sheet and on song change.
- Section order: the inspector lists detected section labels; each click appends a pattern chip. Chips can be removed; Reset returns to source order. Rendering repeats sections and skips unknown labels.
- Annotations: pen, highlighter (translucent, wider) and eraser (removes strokes under the pointer). Strokes save after pointer-up; eraser saves after each removal. Locked songs disable drawing, editing and deletion.
- Shuffle reorders the open setlist randomly and saves it. Note items can be added, edited, moved and removed like songs.
- Stage mode uses native fullscreen, hides the browser and transport, and shows a large stage bar with previous, auto-scroll, position and next.
- Restore shows record counts before merge or replace. A preview token binds the action to the parsed file.
