# Design system — Studio

**Visual thesis.** A DAW-inspired studio console (FL Studio is the stated direction): beveled graphite chassis panels, an amber LCD transport display, and song sections drawn as colour-coded "patterns". All artwork, layout and names are original; no third-party assets or branding are used.

**Content plan.** The transport bar carries song navigation, the LCD (title, key with capo, BPM, meter, set position), the metronome beat LEDs, auto-scroll, tuner and settings. The browser on the left holds songs, folders and setlists. The sheet in the centre is the visual anchor. The channel-rack inspector on the right holds pitch, view, section order, annotations, folders and details. A hint bar at the bottom shows hover hints, notices and errors.

**Interaction thesis.** Controls press into their wells (inset shadow) and pressed toggles glow amber. Only the menu, dialogs and inspector reveal with a short transition. The hint bar answers hover, so icon-only controls are always explained. Reduced-motion users receive immediate transitions.

## Tokens

| Token | Studio dark | Daylight | Stage high contrast |
| --- | --- | --- | --- |
| `--ground` | `#171b1e` | `#c9ced2` | `#000` |
| `--chassis` / `--chassis-hi` | `#2e353b` / `#39424a` | `#d9dee1` / `#e6eaec` | `#0a0a0a` / `#161616` |
| `--well` | `#1e2327` | `#e9ecee` | `#000` |
| `--accent` | `#f5a03a` amber | `#c76a0a` | `#ffd400` |
| `--lcd-bg` / `--lcd-fg` | `#191510` / `#ffb54a` | `#22200f` / `#ffc35e` | `#000` / `#ffd400` |
| `--paper` / `--ink-text` / `--chord` | `#22282d` / `#e9edf0` / `#ffb54a` | `#fffdf8` / `#1d2124` / `#b0560a` | `#000` / `#fff` / `#ffd400` |

Section pattern colours: verse `--verse` blue, chorus `--chorus` orange (also tinted background), bridge `--bridge` violet, intro/outro/tag/pre-chorus `--intro` teal, tab/grid `--tab` grey.

| Role | Choice |
| --- | --- |
| UI text | DM Sans Variable, locally packaged, 12–13 px chrome |
| Readouts | System monospace inside LCD cells, steppers, tuner and stage counters only |
| Chart | DM Sans; chords bold in `--chord`; headings as filled pattern labels |
| Radius | 3 px everywhere (hardware feel), 50% only for colour swatches and LEDs |
| Controls | Gradient chassis buttons with inset press state; 44 px phone targets |
| Icons | Lucide with accessible names; names surface in the hint bar on hover |
