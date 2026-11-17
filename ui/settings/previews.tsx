import { Chart } from "../Chart";
import { ChordDiagram, useDiagrams } from "../ChordDiagram";
import { notationOptions, type Settings } from "../model";

/** Swatches mirror the theme tokens in styles.css so each card shows its own theme. */
const themes: { value: Settings["theme"]; label: string; detail: string; swatch: Record<string, string> }[] = [
  { value: "dark", label: "Studio dark", detail: "Low glare for dim rooms",
    swatch: { chassis: "#2e353b", well: "#1e2327", paper: "#22282d", ink: "#e9edf0", chord: "#ffb54a", lcd: "#191510", accent: "#f5a03a" } },
  { value: "light", label: "Daylight", detail: "Paper look for rehearsal",
    swatch: { chassis: "#d9dee1", well: "#e9ecee", paper: "#fffdf8", ink: "#1d2124", chord: "#b0560a", lcd: "#22200f", accent: "#c76a0a" } },
  { value: "contrast", label: "Stage high contrast", detail: "Maximum contrast under lights",
    swatch: { chassis: "#0a0a0a", well: "#000", paper: "#000", ink: "#fff", chord: "#ffd400", lcd: "#000", accent: "#ffd400" } },
];

export function ThemeCards({ value, onChange }: { value: Settings["theme"]; onChange: (theme: Settings["theme"]) => void }) {
  return <div role="radiogroup" aria-label="Theme" className="theme-cards">
    {themes.map(theme => <label key={theme.value} className="theme-card" data-checked={theme.value === value}>
      <input type="radio" name="settings-theme" value={theme.value} checked={theme.value === value} onChange={() => onChange(theme.value)}/>
      <span className="theme-mock" aria-hidden="true" style={Object.fromEntries(Object.entries(theme.swatch).map(([k, v]) => ["--m-" + k, v]))}>
        <i className="mock-bar"><b/><b/><b/></i>
        <i className="mock-rail"/>
        <i className="mock-sheet"><em/><span/><em/><span/></i>
      </span>
      <span className="segment-label">{theme.label}</span>
      <small>{theme.detail}</small>
    </label>)}
  </div>;
}

const SAMPLE = "[G]Lights come [D/F#]up a[Em7]gain to[C]night, [Bb]now";

/** The same line as written and transposed up three semitones, rendered by the real chart engine. */
export function ChordsPreview({ settings }: { settings: Settings }) {
  const base = { flats: settings.flats, key: "G", key_spelling: settings.key_spelling, section_order: "", ...notationOptions(settings.notation) };
  return <div role="figure" aria-label="Chord preview" className="preview-sheet">
    <span className="preview-tag">As written · key of G</span>
    <Chart source={SAMPLE} options={{ ...base, shift: 0 }}/>
    <span className="preview-tag">Transposed +3 · key of B♭</span>
    <Chart source={SAMPLE} options={{ ...base, shift: 3 }}/>
  </div>;
}

const DIAGRAM_SAMPLE = ["C", "G", "Am", "F"];

export function DiagramsPreview({ settings }: { settings: Settings }) {
  const diagrams = useDiagrams(DIAGRAM_SAMPLE, settings.instrument, true);
  return <div role="figure" aria-label="Diagram preview" className="preview-diagram-wrap">
    <span className="preview-tag">{settings.left_handed ? "Left handed" : "Right handed"} · tap a chord on stage for more voicings</span>
    <div className="preview-diagrams" data-off={settings.diagram_location === "off"}>
      {DIAGRAM_SAMPLE.map(chord => {
        const diagram = diagrams.get(chord);
        return <span key={chord} className="diagram-cell">
          {diagram ? <ChordDiagram diagram={diagram} leftHanded={settings.left_handed}/> : <b>{chord}</b>}
        </span>;
      })}
    </div>
    {settings.diagram_location === "off" && <p className="setting-hint">Diagrams are off. Pick a placement to show them on songs.</p>}
  </div>;
}
