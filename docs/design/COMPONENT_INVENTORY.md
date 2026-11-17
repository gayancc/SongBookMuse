# Component inventory

| Component | File | Responsibility |
| --- | --- | --- |
| IconButton | `ui/components.tsx` | Named icon action with focus, disabled and pressed styles; its name feeds the hint bar |
| Stepper | `ui/components.tsx` | Channel-rack value strip: label, LCD readout and nudge buttons with bounds |
| Modal | `ui/components.tsx` | Native dialog with labelled heading, focus restoration and Escape handler |
| Prompt | `ui/Prompt.tsx` | One-field dialog for folder names and setlist note items |
| Transport + LCD | `ui/App.tsx` | Song navigation, perform toggle, LCD readouts, metronome LEDs, auto-scroll, tuner, settings |
| Browser | `ui/Browser.tsx` | Songs/setlists switch, search, collection tree (all, favorites, folders), key-coloured song rows, set steps and desktop drag reorder |
| Chart | `ui/Chart.tsx` | Rust-rendered lines grouped into pattern-coloured section blocks, tab/grid rows, lyrics-only filtering |
| Inspector | `ui/Inspector.tsx` | Pitch, Nashville toggle, zoom, scroll time, section order sequencer, annotation tools, folders, lock, details |
| DocumentView | `ui/DocumentView.tsx` | PDF/image render, optional PDF inversion and normalized ink surface with pen, highlighter and eraser |
| useAutoScroll | `ui/useAutoScroll.ts` | Delay-then-scroll over the song duration; respects manual scrolling |
| Metronome | `ui/Metronome.tsx` | Audio clock, beat LEDs with accented downbeat, 10 s auto-stop with optional resume on song change |
| Tempo box | `ui/TempoBox.tsx` | LCD tap pad (four or more taps), ±1 nudges and Save to song; opened by Set tempo, right-click or long press |
| SongEditor / SetEditor | `ui/SongEditor.tsx`, `ui/SetEditor.tsx` | Metadata, number, section order, source with live preview; set name, date, pin |
| ChordDiagram / ChordStrip | `ui/ChordDiagram.tsx` | SVG fretboard from Rust fingerings (nut or base fret, open/muted markers, amber dots and barre), mirrored when left-handed; strip of distinct song chords above the chart, click cycles voicings; inline popovers on chord names |
