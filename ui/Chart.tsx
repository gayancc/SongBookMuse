import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ChartLine } from "./model";

export function Chart({ source, shift, flats, lyricsOnly = false }:
  { source: string; shift: number; flats: boolean; lyricsOnly?: boolean }) {
  const [lines, setLines] = useState<ChartLine[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let obsolete = false;
    const timer = setTimeout(() => {
      void invoke<ChartLine[]>("render", { source, shift, flats }).then(data => {
        if (!obsolete) { setLines(data); setError(""); }
      }, e => { if (!obsolete) setError(String(e)); });
    }, 45);
    return () => { obsolete = true; clearTimeout(timer); };
  }, [source, shift, flats]);

  if (error) return <p role="alert">{error}</p>;
  return <div className="chart">
    {lines.map((line, i) => line.kind === "space" ? <div key={i} className="chart-space"/> :
      line.kind === "heading" ? <h3 className="chart-heading" key={i}>{line.text}</h3> :
        <div className="chart-line" key={i}>
          {line.parts.map((part,j) => <span className="chart-part" key={j}>
            {!lyricsOnly && line.parts.some(p => p.chord) && <strong>{part.chord || "\u00a0"}</strong>}
            {part.text && <span>{part.text}</span>}
          </span>)}
        </div>)}
  </div>;
}
