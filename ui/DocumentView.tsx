import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "./components";
import { decode } from "./commands";
import type { Song, Stroke } from "./model";
import type { PDFDocumentProxy } from "pdfjs-dist";

export function DocumentView({ song, page, setPage, setPageCount, draw, brush, changeInk, onError }:
  { song: Song; page: number; setPage: (n: number) => void; setPageCount: (n: number) => void; draw: boolean; brush: string;
    changeInk: (ink: Stroke[]) => void; onError: (message: string) => void }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [image, setImage] = useState("");
  const [pending, setPending] = useState<Stroke | null>(null);
  const active = useRef<Stroke | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const doc = song.document;
    if (!doc) return;
    let canceled = false;
    let cleanup = () => {};
    if (doc.mime === "application/pdf") {
      void Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")])
        .then(async ([api, worker]) => {
          if (canceled) return;
          api.GlobalWorkerOptions.workerSrc = worker.default;
          const task = api.getDocument({ data: decode(doc.bytes), maxImageSize: 32_000_000 });
          cleanup = () => { void task.destroy().catch(() => {}); };
          const document = await task.promise;
          if (!canceled) { setPdf(document); setPageCount(document.numPages); }
        }).catch(e => { if (!canceled) onError(String(e)); });
    } else {
      const url = URL.createObjectURL(new Blob([decode(doc.bytes)], { type: doc.mime }));
      setImage(url);
      cleanup = () => URL.revokeObjectURL(url);
    }
    return () => { canceled = true; cleanup(); };
  }, [song.document, onError, setPageCount]);

  useEffect(() => {
    if (!pdf) return;
    let canceled = false;
    let cancel = () => {};
    void pdf.getPage(page).then(async documentPage => {
      const element = canvas.current;
      if (!element || canceled) return;
      const original = documentPage.getViewport({ scale: 1 });
      const viewport = documentPage.getViewport({ scale: Math.min(2, 2200 / Math.max(original.width, original.height)) });
      element.width = Math.ceil(viewport.width);
      element.height = Math.ceil(viewport.height);
      const task = documentPage.render({ canvas: element, viewport });
      cancel = () => task.cancel();
      await task.promise;
    }).catch(e => { if (!canceled) onError(String(e)); });
    return () => { canceled = true; cancel(); };
  }, [pdf, page, onError]);

  function point(event: PointerEvent<SVGSVGElement>): [number, number] {
    const r = event.currentTarget.getBoundingClientRect();
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    return [clamp((event.clientX - r.left) / r.width), clamp((event.clientY - r.top) / r.height)];
  }
  const strokes = song.ink.filter(stroke => stroke.page === page);
  if (pending) strokes.push(pending);
  return <>
    {pdf && <nav className="page-controls" aria-label="PDF pages">
      <IconButton label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={18}/></IconButton>
      <span>{page} / {pdf.numPages}</span>
      <IconButton label="Next page" disabled={page >= pdf.numPages} onClick={() => setPage(page + 1)}><ChevronRight size={18}/></IconButton>
    </nav>}
    <div className="document">
      {song.document?.mime === "application/pdf" ? <canvas ref={canvas} aria-label={"PDF page " + page}/> :
        image && <img src={image} alt={song.title} onError={() => onError("This image could not be decoded")}/>}
      <svg className={draw ? "ink enabled" : "ink"} aria-hidden="true" viewBox="0 0 1000 1000" preserveAspectRatio="none"
        onPointerDown={event => {
          if (!event.isPrimary || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          active.current = { page, width: 0.004, color: brush, points: [point(event)] };
          setPending(active.current);
        }}
        onPointerMove={event => {
          if (!event.isPrimary || !active.current) return;
          if (active.current.points.length >= 4000) return;
          active.current.points.push(point(event));
          setPending({ ...active.current });
        }}
        onPointerUp={event => {
          if (!event.isPrimary || !active.current) return;
          const stroke = active.current;
          active.current = null;
          setPending(null);
          changeInk([...song.ink, stroke]);
        }}
        onPointerCancel={() => { active.current = null; setPending(null); }}>
        {strokes.map((stroke, i) => stroke.points.length === 1
          ? <circle key={i} cx={stroke.points[0][0]*1000} cy={stroke.points[0][1]*1000} r={stroke.width*500} fill={stroke.color}/>
          : <polyline key={i} points={stroke.points.map(([x,y]) => [x*1000,y*1000].join(",")).join(" ")}
              stroke={stroke.color} strokeWidth={stroke.width*1000} strokeLinecap="round" strokeLinejoin="round" fill="none"/>)}
      </svg>
    </div>
  </>;
}
