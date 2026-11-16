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
}

export interface Stroke {
  page: number;
  color: string;
  width: number;
  points: [number, number][];
}

export type MidiMessage =
  | { kind: "program"; channel: number; program: number }
  | { kind: "control"; channel: number; controller: number; value: number }
  | { kind: "note_on" | "note_off"; channel: number; note: number; velocity: number };

export interface Track { name: string; mime: string; bytes: string; }

export interface Song extends Omit<SongSummary, "kind"> {
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
  | { kind: "lyric"; parts: { chord: string | null; text: string }[] }
  | { kind: "heading"; text: string }
  | { kind: "space" };

export function blankSong(): Song {
  return {
    id: nil, title: "", artist: "", subtitle: "", key: "", tempo: 0, duration: 0, capo: 0,
    transpose: 0, time_signature: "", copyright: "", source: "", notes: "", tags: [],
    favorite: false, archived: false, document: null, ink: [], midi: [], track: null,
  };
}

export const defaultSettings: Settings = { theme: "dark", scale: 100, columns: false, flats: false, compact_sidebar: false };

export function duration(seconds: number) {
  return seconds > 0 ? String(Math.floor(seconds / 60)) + ":" + String(seconds % 60).padStart(2,"0") : "—";
}
