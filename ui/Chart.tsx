import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ChartLine, RenderOptions } from "./model";

interface ChartProps {
  source: string;
  options: RenderOptions;
  lyricsOnly?: boolean;
}

interface Block {
  section: string;
  heading: string | null;
  lines: ChartLine[];
}

const sectionKinds = new Set(["verse", "chorus", "bridge", "intro", "outro", "pre-chorus", "tag", "tab", "grid"]);

/** Groups rendered lines into section blocks so each can carry a pattern colour. */
function group(lines: ChartLine[]): Block[] {
  const blocks: Block[] = [{ section: "none", heading: null, lines: [] }];
  for (const line of lines) {
    if (line.kind === "heading" && sectionKinds.has(line.section)) {
      blocks.push({ section: line.section, heading: line.text, lines: [] });
    } else blocks[blocks.length - 1].lines.push(line);
  }
  return blocks.filter(b => b.heading || b.lines.some(l => l.kind !== "space"));
}

function hasLyrics(line: ChartLine): boolean {
  return line.kind !== "lyric" || line.parts.some(p => p.text.trim());
}

function Row({ line, lyricsOnly }: { line: ChartLine; lyricsOnly: boolean }) {
  if (line.kind === "space") return <div className="chart-space"/>;
  if (line.kind === "heading") return <p className="chart-comment">{line.text}</p>;
  if (line.kind === "pre") return <pre className="chart-pre">{line.text || " "}</pre>;
  const chords = !lyricsOnly && line.parts.some(p => p.chord);
  return <div className="chart-line">
    {line.parts.map((part, j) => <span className="chart-part" key={j}>
      {chords && <strong>{part.chord || " "}</strong>}
      {part.text && <span>{part.text}</span>}
    </span>)}
  </div>;
}

export function Chart({ source, options, lyricsOnly = false }: ChartProps) {
  const [lines, setLines] = useState<ChartLine[]>([]);
  const [error, setError] = useState("");
  const { shift, flats, key, nashville, key_spelling, section_order } = options;
  const mounted = useRef(false);
  useEffect(() => {
    let obsolete = false;
    // Render at once when a song opens; debounce only follow-up edits such as typing in the editor.
    const delay = mounted.current ? 45 : 0;
    mounted.current = true;
    const timer = setTimeout(() => {
      void invoke<ChartLine[]>("render", { source, options: { shift, flats, key, nashville, key_spelling, section_order } })
        .then(data => { if (!obsolete) { setLines(data); setError(""); } },
          e => { if (!obsolete) setError(String(e)); });
    }, delay);
    return () => { obsolete = true; clearTimeout(timer); };
  }, [source, shift, flats, key, nashville, key_spelling, section_order]);

  const blocks = useMemo(() => group(lyricsOnly ? lines.filter(hasLyrics) : lines), [lines, lyricsOnly]);
  if (error) return <p role="alert">{error}</p>;
  return <div className="chart">
    {blocks.map((block, i) => <section key={i} className="chart-block" data-section={block.section}>
      {block.heading && <h3 className="chart-heading">{block.heading}</h3>}
      {block.lines.map((line, j) => <Row key={j} line={line} lyricsOnly={lyricsOnly}/>)}
    </section>)}
  </div>;
}
