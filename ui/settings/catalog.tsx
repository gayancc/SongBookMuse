import type { ReactNode } from "react";
import { Archive, Gauge, Guitar, Monitor, Music2, Usb, type LucideIcon } from "lucide-react";
import { PedalSettings } from "../PedalSettings";
import { MidiSettings } from "../MidiSettings";
import type { Settings } from "../model";
import { RangeField, Segmented, Switch, type Choice } from "./controls";
import { ChordsPreview, DiagramsPreview, ThemeCards } from "./previews";

export type Category = "display" | "chords" | "diagrams" | "performance" | "controllers" | "library";

export interface SettingsContext {
  settings: Settings;
  change: (patch: Partial<Settings>) => void;
  report: (cause: unknown) => void;
  /** The Library page, rendered by the window because it needs library state. */
  library: ReactNode;
}

export interface SettingEntry {
  id: string;
  category: Category;
  /** Panel the setting sits in; see `groups`. */
  group: string;
  label: string;
  hint?: string;
  /** Extra search words; the label and hint are searched too. */
  keywords?: string;
  /** Fields that "Reset section" restores. */
  keys: (keyof Settings)[];
  /** Panels that carry their own heading and layout instead of a row. */
  block?: boolean;
  wide?: boolean;
  render: (ctx: SettingsContext) => ReactNode;
}

export interface Group {
  id: string;
  category: Category;
  title: string;
  /** Spans both columns of the panel grid. */
  wide?: boolean;
  /** Renders without a panel frame because the content draws its own panels. */
  bare?: boolean;
  /** Live preview shown in place of setting rows. */
  preview?: (settings: Settings) => ReactNode;
}

/** Panels in display order. Each category lays its panels out on a two-column grid. */
export const groups: Group[] = [
  { id: "theme", category: "display", title: "Theme", wide: true },
  { id: "view", category: "display", title: "Song view" },
  { id: "browser", category: "display", title: "Browser and documents" },
  { id: "notation", category: "chords", title: "Notation", wide: true },
  { id: "transpose", category: "chords", title: "Transposition" },
  { id: "chord-preview", category: "chords", title: "Preview", preview: s => <ChordsPreview settings={s}/> },
  { id: "instrument", category: "diagrams", title: "Instrument", wide: true },
  { id: "placement", category: "diagrams", title: "Placement" },
  { id: "diagram-preview", category: "diagrams", title: "Preview", preview: s => <DiagramsPreview settings={s}/> },
  { id: "autoscroll", category: "performance", title: "Auto-scroll" },
  { id: "metronome", category: "performance", title: "Metronome" },
  { id: "pedals", category: "controllers", title: "Keyboard pedals" },
  { id: "midi", category: "controllers", title: "MIDI controllers" },
  { id: "backup", category: "library", title: "Backup and restore", wide: true, bare: true },
];

export const categories: { id: Category; title: string; icon: LucideIcon; blurb: string }[] = [
  { id: "display", title: "Display", icon: Monitor, blurb: "Theme, layout, text size and PDFs" },
  { id: "chords", title: "Chords", icon: Music2, blurb: "Notation and how transposed chords are spelled" },
  { id: "diagrams", title: "Diagrams", icon: Guitar, blurb: "Instrument, placement and handedness" },
  { id: "performance", title: "Performance", icon: Gauge, blurb: "Auto-scroll and metronome on stage" },
  { id: "controllers", title: "Controllers", icon: Usb, blurb: "Keyboard pedals and MIDI devices" },
  { id: "library", title: "Library", icon: Archive, blurb: "Back up and restore everything" },
];

const notations: Choice<Settings["notation"]>[] = [
  { value: "standard", label: "Letters", detail: "C  F#m  Bb" },
  { value: "nashville", label: "Nashville", detail: "1  6m  4" },
  { value: "german", label: "German", detail: "C  H7  B" },
  { value: "latin", label: "Latin", detail: "Do  Re  Mi" },
];

const instruments: Choice<Settings["instrument"]>[] = [
  { value: "guitar", label: "Guitar", detail: "E A D G B E" },
  { value: "ukulele", label: "Ukulele", detail: "G C E A" },
  { value: "mandolin", label: "Mandolin", detail: "G D A E" },
  { value: "banjo", label: "Banjo", detail: "Open G" },
];

export const clock = (seconds: number) => Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");

export const entries: SettingEntry[] = [
  { id: "theme", category: "display", group: "theme", label: "Theme", hint: "Stage high contrast is easiest to read under bright lights.",
    keywords: "dark light colour color appearance", keys: ["theme"], wide: true,
    render: ({ settings, change }) => <ThemeCards value={settings.theme} onChange={theme => change({ theme })}/> },
  { id: "layout", category: "display", group: "view", label: "Song layout", hint: "Fit sizes each song to the screen.",
    keywords: "fit scroll columns page", keys: ["layout", "columns"],
    render: ({ settings, change }) => <Segmented label="Song layout" value={settings.layout} onChange={layout => change({ layout })}
      choices={[{ value: "fit", label: "Fit to screen" }, { value: "scroll", label: "Scroll" }]}/> },
  { id: "scale", category: "display", group: "view", label: "Text size", hint: "Scroll layout and notes. Fit picks its own size.",
    keywords: "zoom font scale bigger smaller", keys: ["scale"],
    render: ({ settings, change }) => <RangeField label="Text size (%)" value={settings.scale} min={65} max={200} step={5}
      unit="%" onChange={scale => change({ scale })}/> },
  { id: "compact", category: "display", group: "browser", label: "Compact browser rows", hint: "Hides artist and key lines to fit more songs.",
    keywords: "sidebar compact dense list", keys: ["compact_sidebar"],
    render: ({ settings, change }) => <Switch compact label="Compact browser rows" checked={settings.compact_sidebar} onChange={compact_sidebar => change({ compact_sidebar })}/> },
  { id: "invert", category: "display", group: "browser", label: "Invert PDF pages", hint: "Turns white pages dark. Your ink keeps its colours.",
    keywords: "pdf invert dark night document", keys: ["invert_pdf"],
    render: ({ settings, change }) => <Switch compact label="Invert PDF colors" checked={settings.invert_pdf} onChange={invert_pdf => change({ invert_pdf })}/> },

  { id: "notation", category: "chords", group: "notation", label: "Chord notation", hint: "Diagrams always look chords up by letter name.",
    keywords: "nashville numbers german latin solfege do re mi h", keys: ["notation"], wide: true,
    render: ({ settings, change }) => <Segmented cards label="Chord notation" value={settings.notation} choices={notations} onChange={notation => change({ notation })}/> },
  { id: "spelling", category: "chords", group: "transpose", label: "Spell from the new key", hint: "Transposing to F writes Bb, to E writes G#.",
    keywords: "sharps flats transpose accidentals", keys: ["key_spelling"],
    render: ({ settings, change }) => <Switch compact label="Spell transposed chords from the new key" checked={settings.key_spelling} onChange={key_spelling => change({ key_spelling })}/> },
  { id: "flats", category: "chords", group: "transpose", label: "Prefer flats", hint: "When the song has no key or the key is ambiguous.",
    keywords: "sharps flats accidentals", keys: ["flats"],
    render: ({ settings, change }) => <Switch compact label="Prefer flats when the key is unknown or ambiguous" checked={settings.flats} onChange={flats => change({ flats })}/> },

  { id: "location", category: "diagrams", group: "placement", label: "Show diagrams", hint: "On chords shows a diagram when you hover or focus a chord.",
    keywords: "off top strip inline popover show hide", keys: ["diagram_location"],
    render: ({ settings, change }) => <Segmented label="Chord diagram location" value={settings.diagram_location} onChange={diagram_location => change({ diagram_location })}
      choices={[{ value: "off", label: "Off" }, { value: "top", label: "Strip" }, { value: "inline", label: "On chords" }]}/> },
  { id: "instrument", category: "diagrams", group: "instrument", label: "Instrument", keywords: "guitar ukulele mandolin banjo tuning frets",
    keys: ["instrument"], wide: true,
    render: ({ settings, change }) => <Segmented cards label="Instrument" value={settings.instrument} choices={instruments} onChange={instrument => change({ instrument })}/> },
  { id: "handed", category: "diagrams", group: "instrument", label: "Left handed", hint: "Mirrors diagrams so the low string is on the right.",
    keywords: "left handed mirror", keys: ["left_handed"],
    render: ({ settings, change }) => <Switch compact label="Left handed chord charts" checked={settings.left_handed} onChange={left_handed => change({ left_handed })}/> },

  { id: "scroll-time", category: "performance", group: "autoscroll", label: "Default scroll time", hint: "For songs without their own duration. Up to 30 minutes.",
    keywords: "auto-scroll autoscroll duration speed seconds", keys: ["autoscroll_duration"],
    render: ({ settings, change }) => <RangeField label="Default scroll time (seconds)" value={settings.autoscroll_duration} min={15} max={1800} sliderMax={600} step={5}
      format={clock} onChange={autoscroll_duration => change({ autoscroll_duration })}/> },
  { id: "scroll-delay", category: "performance", group: "autoscroll", label: "Scroll delay", hint: "Count-in before the page moves. Press again to skip.",
    keywords: "auto-scroll autoscroll wait countdown seconds", keys: ["autoscroll_delay"],
    render: ({ settings, change }) => <RangeField label="Delay before scrolling (seconds)" value={settings.autoscroll_delay} min={0} max={600} sliderMax={60}
      unit="s" onChange={autoscroll_delay => change({ autoscroll_delay })}/> },
  { id: "overscroll", category: "performance", group: "autoscroll", label: "Overscroll", hint: "Lets the last lines scroll up to mid-screen.",
    keywords: "auto-scroll end bottom", keys: ["autoscroll_overscroll"],
    render: ({ settings, change }) => <Switch compact label="Overscroll by half a screen" checked={settings.autoscroll_overscroll} onChange={autoscroll_overscroll => change({ autoscroll_overscroll })}/> },
  { id: "metronome", category: "performance", group: "metronome", label: "Stop metronome", hint: "Use 10 s as a count-in that does not play through.",
    keywords: "metronome click timeout auto stop tempo", keys: ["metronome_timeout"],
    render: ({ settings, change }) => <Segmented label="Stop metronome" value={settings.metronome_timeout} onChange={metronome_timeout => change({ metronome_timeout })}
      choices={[{ value: "never", label: "Never" }, { value: "10s", label: "After 10 s" }, { value: "10s_resume", label: "10 s, again per song" }]}/> },

  { id: "pedals", category: "controllers", group: "pedals", label: "Keyboard pedals", keywords: "bluetooth page turner foot pedal key shortcut",
    keys: ["keyboard_pedals"], block: true,
    render: ({ settings, change }) => <PedalSettings bindings={settings.keyboard_pedals} change={keyboard_pedals => change({ keyboard_pedals })}/> },
  { id: "midi", category: "controllers", group: "midi", label: "MIDI controllers", keywords: "midi usb ports cc note program", keys: [], block: true,
    render: ({ report }) => <MidiSettings onError={report}/> },

  { id: "backup", category: "library", group: "backup", label: "Backup and restore", keywords: "export import restore merge replace sbpbackup musebackup songbook pro",
    keys: [], block: true, render: ({ library }) => library },
];

export function matches(entry: SettingEntry, query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = [entry.label, entry.hint, entry.keywords, categories.find(c => c.id === entry.category)?.title].join(" ").toLowerCase();
  return words.every(word => text.includes(word));
}
