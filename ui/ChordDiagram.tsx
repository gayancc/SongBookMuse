import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ChordDiagramData, Instrument, RenderOptions } from "./model";

const FRETS = 4;
const PAD_X = 9;
const TOP = 24;
const STRING_GAP = 10;
const FRET_GAP = 12;

interface DiagramProps {
  diagram: ChordDiagramData;
  variation?: number;
  leftHanded: boolean;
}

/** One fretboard diagram drawn from a Rust-computed fingering; mirrored for left-handed players. */
export function ChordDiagram({ diagram, variation = 0, leftHanded }: DiagramProps) {
  const fingering = diagram.fingerings[variation];
  const strings = diagram.strings.length;
  const width = PAD_X * 2 + (strings - 1) * STRING_GAP;
  const height = TOP + FRETS * FRET_GAP + 6;
  const x = (string: number) => PAD_X + (leftHanded ? strings - 1 - string : string) * STRING_GAP;
  const y = (fret: number) => TOP + (fret - (fingering?.base_fret ?? 1) + 0.5) * FRET_GAP;
  if (!fingering) {
    return <svg className="chord-diagram" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={diagram.chord + ": no fingering"}>
      <text className="diagram-name" x={width / 2} y={10}>{diagram.chord}</text>
      <text className="diagram-empty" x={width / 2} y={TOP + 20}>—</text>
    </svg>;
  }
  const barre = fingering.barre;
  // Frets are always announced from the lowest string so the label does not change with handedness.
  const describe = fingering.frets.map(f => f === null ? "x" : String(f)).join(" ");
  return <svg className="chord-diagram" viewBox={`0 0 ${width} ${height}`} role="img"
    aria-label={`${diagram.chord} on ${diagram.instrument}: ${describe}`} data-left-handed={leftHanded}>
    <text className="diagram-name" x={width / 2} y={9}>{diagram.chord}</text>
    {fingering.base_fret > 1 && <text className="diagram-base" x={leftHanded ? width - 1 : 1} y={TOP + FRET_GAP * 0.5 + 3}
      textAnchor={leftHanded ? "end" : "start"}>{fingering.base_fret}</text>}
    {fingering.base_fret === 1 && <line className="diagram-nut" x1={x(0)} x2={x(strings - 1)} y1={TOP} y2={TOP}/>}
    {Array.from({ length: FRETS + 1 }, (_, i) =>
      <line key={"f" + i} className="diagram-fret" x1={PAD_X} x2={width - PAD_X} y1={TOP + i * FRET_GAP} y2={TOP + i * FRET_GAP}/>)}
    {diagram.strings.map((_, s) =>
      <line key={"s" + s} className="diagram-string" x1={x(s)} x2={x(s)} y1={TOP} y2={TOP + FRETS * FRET_GAP}/>)}
    {barre && <rect className="diagram-barre" x={Math.min(x(barre.from), x(barre.to)) - 3.5} width={Math.abs(x(barre.to) - x(barre.from)) + 7}
      y={y(barre.fret) - 3.5} height={7} rx={3.5}/>}
    {fingering.frets.map((fret, s) => fret === null
      ? <text key={"m" + s} className="diagram-mute" x={x(s)} y={TOP - 4}>×</text>
      : fret === 0
        ? <circle key={"o" + s} className="diagram-open" cx={x(s)} cy={TOP - 6} r={2.6}/>
        : barre && fret === barre.fret && s >= barre.from && s <= barre.to ? null
          : <circle key={"d" + s} className="diagram-dot" cx={x(s)} cy={y(fret)} r={3.6}/>)}
  </svg>;
}

/** Fetches diagrams for a list of chords, keeping the previous result while a new one loads. */
export function useDiagrams(chords: string[], instrument: Instrument, enabled: boolean) {
  const [diagrams, setDiagrams] = useState<Map<string, ChordDiagramData>>(new Map());
  const key = chords.join("\u0000");
  useEffect(() => {
    if (!enabled) return;
    let obsolete = false;
    void Promise.all(chords.map(chord => invoke<ChordDiagramData>("chord_diagram", { chord, instrument })
      .then(d => [chord, d] as const, () => null)))
      .then(entries => {
        if (!obsolete) setDiagrams(new Map(entries.filter(e => e !== null)));
      });
    return () => { obsolete = true; };
  }, [key, instrument, enabled]);
  return diagrams;
}

/** Distinct letter-name chords of the song as the chart displays them (after transpose and capo). */
export function useSongChords(source: string, options: RenderOptions, enabled: boolean) {
  const [chords, setChords] = useState<string[]>([]);
  const { shift, flats, key, key_spelling, section_order } = options;
  useEffect(() => {
    if (!enabled) return;
    let obsolete = false;
    const timer = setTimeout(() => {
      void invoke<string[]>("song_chords", { source, options: { shift, flats, key, nashville: false, key_spelling, section_order } })
        .then(list => { if (!obsolete) setChords(list); }, () => { if (!obsolete) setChords([]); });
    }, 45);
    return () => { obsolete = true; clearTimeout(timer); };
  }, [source, shift, flats, key, key_spelling, section_order, enabled]);
  return chords;
}

interface StripProps {
  chords: string[];
  diagrams: Map<string, ChordDiagramData>;
  leftHanded: boolean;
}

/** The strip of the song's distinct chords shown above the chart. Clicking a cell cycles voicings. */
export function ChordStrip({ chords, diagrams, leftHanded }: StripProps) {
  const [variations, setVariations] = useState<Record<string, number>>({});
  const shown = chords.filter(c => diagrams.has(c));
  if (shown.length === 0) return null;
  return <div className="diagram-strip" role="region" aria-label="Chord diagrams" data-left-handed={leftHanded}>
    {shown.map(chord => {
      const diagram = diagrams.get(chord)!;
      const count = diagram.fingerings.length;
      const current = (variations[chord] ?? 0) % Math.max(count, 1);
      return <button key={chord} type="button" className="diagram-cell" disabled={count < 2}
        title={count > 1 ? `${chord}: voicing ${current + 1} of ${count}, click for the next` : chord}
        onClick={() => setVariations(v => ({ ...v, [chord]: (current + 1) % count }))}>
        <ChordDiagram diagram={diagram} variation={current} leftHanded={leftHanded}/>
      </button>;
    })}
  </div>;
}
