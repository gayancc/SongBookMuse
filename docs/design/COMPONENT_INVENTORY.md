# Component inventory

| Component | File | Responsibility |
| --- | --- | --- |
| IconButton | `ui/components.tsx` | Named icon action with focus, disabled and pressed styles; its name feeds the hint bar |
| Stepper | `ui/components.tsx` | Channel-rack value strip: label, LCD readout and nudge buttons with bounds |
| Modal | `ui/components.tsx` | Native dialog with labelled heading, focus restoration and Escape handler |
| SettingsWindow | `ui/settings/SettingsWindow.tsx` | Toolbar of category tabs (summary in each tooltip) and search; two-column grid of titled panels with per-panel reset; status strip with save LED and the active page summary |
| Settings catalog | `ui/settings/catalog.tsx` | Single declaration of every setting: category, panel group, search keywords and the fields its reset restores |
| Panel / SettingRow / Switch / Segmented / RangeField | `ui/settings/controls.tsx` | Titled group box; name-hint-control row; LED switch with ON/OFF readout; hardware segment buttons or LCD option cards; slider with LCD number field that commits on blur or Enter |
| Settings previews | `ui/settings/previews.tsx` | Theme cards drawn in each theme's colours; chord line as written and transposed +3 through the real renderer; sample diagrams for the chosen instrument and hand |
| LibraryPanel | `ui/backup/LibraryPanel.tsx` | LCD strip of library counts and backup age; Export and Restore panels side by side |
| RestoreWizard | `ui/backup/RestoreWizard.tsx` | One compact panel: file line, one-line contents readout, warnings, Merge/Replace segment with a one-line computed consequence, safety-backup switch for Replace, one action button, one-line result |
| Prompt | `ui/Prompt.tsx` | One-field dialog for folder names and setlist note items |
| Transport + LCD | `ui/App.tsx` | Song navigation, perform toggle, LCD readouts, metronome LEDs, auto-scroll, tuner, settings |
| Browser | `ui/Browser.tsx` | Songs/setlists switch, search, collection tree (all, favorites, folders), key-coloured song rows, set steps and desktop drag reorder |
| Chart | `ui/Chart.tsx` | Rust-rendered lines grouped into pattern-coloured section blocks, tab/grid rows, lyrics-only filtering |
| Inspector | `ui/Inspector.tsx` | Pitch, Nashville toggle, zoom, scroll time, section order sequencer, annotation tools, folders, lock, details |
| DocumentView | `ui/DocumentView.tsx` | PDF/image render, optional PDF inversion and normalized ink surface with pen, highlighter and eraser |
| useAutoScroll | `ui/useAutoScroll.ts` | Delay-then-scroll over the song duration; respects manual scrolling |
| Metronome | `ui/Metronome.tsx` | Audio clock, beat LEDs with accented downbeat, 10 s auto-stop with optional resume on song change |
| Tempo box | `ui/TempoBox.tsx` | LCD tap pad (four or more taps), ±1 nudges and Save to song; opened by Set tempo, right-click or long press |
| SongEditor | `ui/SongEditor.tsx` | Editor window: identity strip (title, artist, subtitle, number); properties rack (Music with key and meter suggestions, tempo, m:ss duration, capo and transpose steppers; Details with copyright and tag chips; Media with backing track and MIDI on open; Notes); Source and live Preview panels with section chips that build the order; status footer with unsaved LED, validation, discard prompt and Ctrl+S |
| SourceEditor | `ui/editor/SourceEditor.tsx` | Monospace ChordPro source with an insert toolbar (chord, verse, chorus, bridge, comment, tab) that wraps the selection, and line/chord counts |
| SetEditor | `ui/SetEditor.tsx` | Set name, date, pin |
| ChordDiagram / ChordStrip | `ui/ChordDiagram.tsx` | SVG fretboard from Rust fingerings (nut or base fret, open/muted markers, amber dots and barre), mirrored when left-handed; strip of distinct song chords above the chart, click cycles voicings; inline popovers on chord names |
