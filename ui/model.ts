export const nil = "00000000-0000-0000-0000-000000000000";

export interface SongSummary {
  id: string;
  title: string;
  artist: string;
  key: string;
  tempo: number;
  duration: number;
  favorite: boolean;
  archived: boolean;
  kind: string;
  folders: string[];
  number: number;
  locked: boolean;
}

export interface Stroke {
  page: number;
  color: string;
  width: number;
  points: [number, number][];
  highlight?: boolean;
}

export interface Folder { id: string; name: string; }

export type MidiMessage =
  | { kind: "program"; channel: number; program: number }
  | { kind: "control"; channel: number; controller: number; value: number }
  | { kind: "note_on" | "note_off"; channel: number; note: number; velocity: number };

export interface Track { name: string; mime: string; bytes: string; }

export interface Song extends Omit<SongSummary, "kind"> {
  section_order: string;
  subtitle: string;
  capo: number;
  transpose: number;
  time_signature: string;
  copyright: string;
  source: string;
  notes: string;
  tags: string[];
  document: { mime: string; bytes: string } | null;
  ink: Stroke[];
  midi: MidiMessage[];
  track: Track | null;
}

export interface SetEntry {
  id: string;
  song_id: string;
  transpose: number | null;
  capo: number | null;
  note?: string | null;
  section_order?: string | null;
}

export interface Setlist {
  id: string;
  title: string;
  date: string;
  pinned: boolean;
  entries: SetEntry[];
}

export interface Settings {
  theme: "dark" | "light" | "contrast";
  scale: number;
  columns: boolean;
  flats: boolean;
  compact_sidebar: boolean;
  invert_pdf: boolean;
  keyboard_pedals: Record<string, NavigationAction>;
  notation: Notation;
  metronome_timeout: MetronomeTimeout;
  autoscroll_delay: number;
  autoscroll_duration: number;
  autoscroll_overscroll: boolean;
  key_spelling: boolean;
  layout: "fit" | "scroll";
  instrument: Instrument;
  left_handed: boolean;
  diagram_location: DiagramLocation;
}

export type Instrument = "guitar" | "ukulele" | "mandolin" | "banjo";
export type DiagramLocation = "off" | "top" | "inline";

export const navigationActions = {
  previous_song: "Previous song", next_song: "Next song", page_up: "Page up", page_down: "Page down",
};
export type NavigationAction = keyof typeof navigationActions;

/** Mirrors `muse_core::ChordDiagram`; frets run from the lowest string, `null` = muted. */
export interface ChordDiagramData {
  chord: string;
  instrument: Instrument;
  strings: string[];
  fingerings: {
    frets: (number | null)[];
    base_fret: number;
    barre: { fret: number; from: number; to: number } | null;
    fingers: number;
  }[];
}

export interface Preview {
  token: string;
  details: {
    format: string;
    songs: number;
    archived: number;
    sets: number;
    entries: number;
    settings: boolean;
    warnings: string[];
  };
}

export type ChartLine =
  | { kind: "lyric"; parts: { chord: string | null; text: string }[];
      style?: { color: string | null; fill: string | null } }
  | { kind: "heading"; text: string; section: string }
  | { kind: "pre"; text: string }
  | { kind: "space" };

export interface RenderOptions {
  shift: number;
  flats: boolean;
  key: string;
  nashville: boolean;
  key_spelling: boolean;
  section_order: string;
  /** Note naming for letter chords; Nashville numbers ignore it. */
  naming: Naming;
}

export type MetronomeTimeout = "never" | "10s" | "10s_resume";

/** Mirrors `muse_core::{TEMPO_MIN, TEMPO_MAX, TAP_MIN}`. */
export const TEMPO_MIN = 25;
export const TEMPO_MAX = 300;
export const TAP_MIN = 4;

export type Notation = "standard" | "nashville" | "german" | "latin";
export type Naming = "letter" | "german" | "latin";

/** Splits the notation setting into the renderer's Nashville flag and note naming. */
export function notationOptions(notation: Notation): { nashville: boolean; naming: Naming } {
  return {
    nashville: notation === "nashville",
    naming: notation === "german" || notation === "latin" ? notation : "letter",
  };
}

export function blankSong(): Song {
  return {
    id: nil, title: "", artist: "", subtitle: "", key: "", tempo: 0, duration: 0, capo: 0,
    transpose: 0, time_signature: "", copyright: "", source: "", notes: "", tags: [],
    favorite: false, archived: false, document: null, ink: [], midi: [], track: null,
    folders: [], number: 0, locked: false, section_order: "",
  };
}

export const defaultSettings: Settings = {
  theme: "dark", scale: 100, columns: false, flats: false, compact_sidebar: false, invert_pdf: false, keyboard_pedals: {},
  notation: "standard", autoscroll_delay: 10, autoscroll_duration: 90, autoscroll_overscroll: false, key_spelling: true, layout: "fit",
  instrument: "guitar", left_handed: false, diagram_location: "off", metronome_timeout: "never",
};

export const nilEntry = (song_id: string): SetEntry => ({ id: nil, song_id, transpose: null, capo: null, note: null });
export const noteEntry = (note: string): SetEntry => ({ id: nil, song_id: nil, transpose: null, capo: null, note });

export function duration(seconds: number): string {
  return seconds > 0 ? String(Math.floor(seconds / 60)) + ":" + String(seconds % 60).padStart(2,"0") : "—";
}
