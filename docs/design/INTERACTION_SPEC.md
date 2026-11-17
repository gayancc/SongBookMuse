# Interaction specification

- Search filters the Rust library by normalized text. Stale responses are ignored. Collection filters (All songs, Favorites, a folder) combine with search. Importing switches the browser to All songs so new songs are visible.
- Selecting a song row opens it, resets the PDF page and returns the sheet to the top. Selecting a set item establishes set position and pitch overrides; note items open as a large note sheet.
- Keyboard: Left/Right step through the set, Page Up/Page Down and Space turn the page, A toggles auto-scroll, Escape leaves performance. Keys are honoured when a button has focus (Space stays with the button); they are ignored in text fields and open dialogs.
- Auto-scroll waits the configured delay, then moves the chart using the song duration or the default scroll time in Settings. The initial default is 90 seconds. Press again during the delay to start immediately. The inspector saves a song's scroll time. Overscroll optionally extends the scroll layout by half the sheet viewport.
- ChordPro text color and fill directives style lyrics through the current section. An empty directive clears its style.
- Section order uses the inspector's section chips. Reset returns to source order. A setlist entry can override the base song's arrangement. Use song order clears the entry's override.
- Annotations: pen, highlighter (translucent, wider) and eraser (removes strokes under the pointer). Strokes save after pointer-up; eraser saves after each removal. Locked songs disable drawing, editing and deletion.
- Shuffle reorders the open setlist randomly and saves it. Use the desktop drag handle or the move buttons to reorder individual songs and notes.
- Invert PDF colors in Settings changes the rendered page colors. Ink keeps the colors selected by the player.
- Keyboard pedals in Settings learn a key and assign it to a page or song action. The assignment persists after restart.
- Stage mode uses native fullscreen, hides the browser and transport, and shows a large stage bar with previous, auto-scroll, position and next.
- Restore shows record counts before merge or replace. A preview token binds the action to the parsed file.
- Settings open on the last used tab. Changes save immediately; each panel's reset restores only that panel's fields and is disabled at defaults. Search filters every setting across tabs and labels results with their tab.
- Export writes one dated `.musebackup` through the native save dialog and records the time on this device. The Library LED is green within 7 days, amber when older and red when this device has never exported.
- Restore is one compact panel and never changes anything until its action button is pressed: it lists what the backup holds, the Merge/Replace switch states in one line what that mode will add, remove and do to preferences, and the Merge library / Replace library button runs it. Replace saves a safety backup first by default; turning that off requires an explicit acknowledgement. Cancelling the safety save cancels the restore.
- The song editor saves only with a title and a valid duration (m:ss or seconds); the footer names the problem. Ctrl+S saves. Closing with unsaved changes asks to keep editing or discard. Below 1100 px a Source/Preview switch shows one pane beside the properties rack; on phones the panes stack.
