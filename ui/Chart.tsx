import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ChartLine, RenderOptions } from "./model";

interface Block {
  section: string;
  heading: string | null;
  lines: ChartLine[];
}

interface Segment { block: number; start: number; end: number; }

export interface FitLayout {
  scale: number;
  columns: number;
  column_width: number;
  pages: Segment[][][];
  wrapped_lines: number;
  overflow: boolean;
}

const sectionKinds = new Set(["verse", "chorus", "bridge", "intro", "outro", "pre-chorus", "tag", "tab", "grid"]);
/** Font size of the chart at scale 1; must match `.chart` in styles.css. */
const BASE_PX = 18;
const PAGE_PAD_X = 28;
const PAGE_PAD_Y = 18;
const COLUMN_GAP = 40;
const WIDTH_SAFETY = 1.03;

/** Groups rendered lines into section blocks so each can carry a pattern colour. */
function group(lines: ChartLine[]): Block[] {
  const blocks: Block[] = [{ section: "none", heading: null, lines: [] }];
  for (const line of lines) {
    if (line.kind === "heading" && sectionKinds.has(line.section)) {
      blocks.push({ section: line.section, heading: line.text, lines: [] });
    } else blocks[blocks.length - 1].lines.push(line);
  }
  return blocks
    .map(b => ({ ...b, lines: trimSpaces(b.lines) }))
    .filter(b => b.heading || b.lines.length);
}

/** Leading and trailing blank rows only waste vertical space inside a section. */
function trimSpaces(lines: ChartLine[]): ChartLine[] {
  let start = 0, end = lines.length;
  while (start < end && lines[start].kind === "space") start++;
  while (end > start && lines[end - 1].kind === "space") end--;
  return lines.slice(start, end);
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
    {line.parts.map((part, j) => {
      const bare = Boolean(part.chord) && !part.text.trim();
      // A chord with no lyric under it keeps its place on the chord row and gets breathing room.
      return <span className={bare ? "chart-part chord-only" : "chart-part"} key={j}>
        {chords && <strong>{part.chord || " "}</strong>}
        {part.text ? <span>{part.text}</span> : chords && <span aria-hidden="true">{" "}</span>}
      </span>;
    })}
  </div>;
}

/** Rows of a block as rendered: an optional heading row followed by its lines. */
function blockRows(block: Block, lyricsOnly: boolean, start = 0, end = Infinity): ReactNode[] {
  const rows: ReactNode[] = [];
  const offset = block.heading ? 1 : 0;
  if (block.heading && start === 0) rows.push(<h3 className="chart-heading" key="h">{block.heading}</h3>);
  const from = Math.max(0, start - offset);
  const to = Math.min(block.lines.length, end - offset);
  for (let i = from; i < to; i++) rows.push(<Row key={i} line={block.lines[i]} lyricsOnly={lyricsOnly}/>);
  return rows;
}

function useRenderedLines(source: string, options: RenderOptions): [ChartLine[], string] {
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
  return [lines, error];
}

interface ChartProps {
  source: string;
  options: RenderOptions;
  lyricsOnly?: boolean;
}

/** Flowing chart used by the editor preview and the fixed-zoom scroll layout. */
export function Chart({ source, options, lyricsOnly = false }: ChartProps) {
  const [lines, error] = useRenderedLines(source, options);
  const blocks = useMemo(() => group(lyricsOnly ? lines.filter(hasLyrics) : lines), [lines, lyricsOnly]);
  if (error) return <p role="alert">{error}</p>;
  return <div className="chart">
    {blocks.map((block, i) => <section key={i} className="chart-block" data-section={block.section}>
      {blockRows(block, lyricsOnly)}
    </section>)}
  </div>;
}

interface FitChartProps extends ChartProps {
  /** Scroll container whose client box is the screen to fill. */
  viewport: RefObject<HTMLElement | null>;
  header: ReactNode;
  footer: ReactNode;
  onLayout: (layout: FitLayout | null) => void;
}

interface Size { width: number; height: number; }

interface Fitted {
  layout: FitLayout;
  blocks: Block[];
  measured: Measurement;
  size: Size;
  reserve: number;
}

interface Measurement {
  header: number;
  blocks: { lines: { width: number; height: number; nowrap: boolean }[]; overhead: number; indent: number; heading: boolean }[];
}

/** Reads natural row sizes at scale 1 from the hidden measuring copy. */
function measure(root: HTMLElement): Measurement {
  const header = root.querySelector<HTMLElement>("[data-measure-header]")?.getBoundingClientRect().height ?? 0;
  const blocks = Array.from(root.querySelectorAll<HTMLElement>("[data-measure-block]")).map(element => {
    const rows = Array.from(element.children) as HTMLElement[];
    const style = getComputedStyle(element);
    const lines = rows.map(row => {
      const rect = row.getBoundingClientRect();
      const margins = parseFloat(getComputedStyle(row).marginTop) + parseFloat(getComputedStyle(row).marginBottom);
      // Glyph widths are not perfectly linear across font sizes (hinting, rounding), so a row measured
      // right at the column edge could still wrap; a small safety margin keeps "fits" honest.
      const width = Math.max(rect.width, row.scrollWidth);
      return { width: Math.ceil(width * WIDTH_SAFETY) + 2, height: rect.height + margins, nowrap: row.tagName === "PRE" };
    });
    const total = element.getBoundingClientRect().height + parseFloat(style.marginBottom);
    const overhead = Math.max(0, total - lines.reduce((sum, l) => sum + l.height, 0));
    const indent = parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingRight);
    return { lines, overhead, indent, heading: element.dataset.heading === "true" };
  });
  return { header, blocks };
}

/**
 * Fit-to-screen chart. Sizes and columns are chosen by the Rust layout engine (`fit_layout`) so the
 * whole song shows at the largest readable size, or splits into the fewest screen-sized pages.
 */
export function FitChart({ source, options, lyricsOnly = false, viewport, header, footer, onLayout }: FitChartProps) {
  const [lines, error] = useRenderedLines(source, options);
  const blocks = useMemo(() => group(lyricsOnly ? lines.filter(hasLyrics) : lines), [lines, lyricsOnly]);
  const probe = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<Measurement | null>(null);
  const [measuredBlocks, setMeasuredBlocks] = useState<Block[]>([]);
  const [size, setSize] = useState<Size | null>(null);
  const [failed, setFailed] = useState(false);
  // A layout remembers the content, measurement and screen it was computed for, so a stale result is
  // never trusted. `reserve` is extra height held back after a rendered column overflowed.
  const [fitted, setFitted] = useState<Fitted | null>(null);
  const [reserve, setReserve] = useState({ px: 0, tries: 0, measured: null as Measurement | null, size: null as Size | null });

  // Viewport size, tracked through resizes, orientation changes and panel toggles.
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // Children commit before a parent's ref is attached, so resolve the scroller from our own node.
    const element = root.current?.closest<HTMLElement>(".sheet-scroll") ?? viewport.current;
    if (!element) return;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [viewport]);

  // Measure once per content change, after web fonts are ready so widths are final.
  useLayoutEffect(() => {
    let obsolete = false;
    const root = probe.current;
    if (!root) return;
    const snapshot = blocks;
    void document.fonts.ready.then(() => {
      if (!obsolete) { setMeasured(measure(root)); setMeasuredBlocks(snapshot); }
    });
    return () => { obsolete = true; };
  }, [blocks, header, lyricsOnly, size?.width]);

  // Reserve only applies to the measurement and size it was learned for.
  const reservePx = reserve.measured === measured && reserve.size === size ? reserve.px : 0;
  const current = fitted && fitted.measured === measured && fitted.size === size && fitted.reserve === reservePx;

  // Verify the rendered, current result: if a column overflows (font metrics, rounding), re-fit with less height.
  useLayoutEffect(() => {
    const element = root.current;
    if (!fitted || !current || !element) return;
    const tries = reserve.measured === measured && reserve.size === size ? reserve.tries : 0;
    if (tries >= 3) return;
    const overflow = Math.max(0, ...Array.from(element.querySelectorAll<HTMLElement>(".fit-page .fit-column"))
      .map(column => column.scrollHeight - (column.parentElement?.clientHeight ?? column.scrollHeight)));
    if (overflow > 1) setReserve({ px: reservePx + Math.ceil(overflow) + 2, tries: tries + 1, measured, size });
  }, [fitted, current, measured, size, reserve, reservePx]);

  useEffect(() => {
    if (!measured || !size || size.width < 50 || size.height < 50) return;
    let obsolete = false;
    const timer = setTimeout(() => {
      const request = {
        blocks: measured.blocks,
        header: measured.header,
        width: size.width - PAGE_PAD_X * 2,
        // A few pixels of slack absorb sub-pixel rounding between measurement and layout.
        height: size.height - PAGE_PAD_Y * 2 - 6 - reservePx,
        gap: COLUMN_GAP,
        min_scale: 0.78,
        max_scale: 2.6,
        comfort_scale: 1,
        min_column_width: 300,
        max_columns: 4,
      };
      void invoke<FitLayout>("fit_layout", { request }).then(result => {
        if (!obsolete) { setFitted({ layout: result, blocks: measuredBlocks, measured, size, reserve: reservePx }); onLayout(result); }
      }, () => { if (!obsolete) { setFitted(null); setFailed(true); onLayout(null); } });
    }, 60);
    return () => { obsolete = true; clearTimeout(timer); };
  }, [measured, measuredBlocks, size, onLayout, reservePx]);

  useEffect(() => () => onLayout(null), [onLayout]);

  if (error) return <p role="alert">{error}</p>;
  if (failed) return <div className="fit-fallback">{header}<Chart source={source} options={options} lyricsOnly={lyricsOnly}/>{footer}</div>;
  return <div className="fit-chart" ref={root}>
    <div className="fit-probe chart" ref={probe} aria-hidden="true">
      <div data-measure-header="" style={{ width: size ? size.width - PAGE_PAD_X * 2 : undefined }}>{header}</div>
      {blocks.map((block, i) => <section key={i} className="chart-block" data-section={block.section}
        data-measure-block="" data-heading={Boolean(block.heading)}>{blockRows(block, lyricsOnly)}</section>)}
    </div>
    {fitted && size && fitted.blocks === blocks ? fitted.layout.pages.map((page, p, pages) => <div className="fit-page" key={p}
      style={{ height: size.height, padding: PAGE_PAD_Y + "px " + PAGE_PAD_X + "px" }}
      aria-label={pages.length > 1 ? "Page " + (p + 1) + " of " + pages.length : undefined}>
      {p === 0 && header}
      <div className="fit-columns chart" style={{ fontSize: BASE_PX * fitted.layout.scale, columnGap: COLUMN_GAP,
        gridTemplateColumns: "repeat(" + fitted.layout.columns + ", minmax(0, 1fr))" }}>
        {page.map((column, c) => <div className="fit-column" key={c}>
          {column.map(segment => <section key={segment.block + ":" + segment.start} className="chart-block"
            data-section={fitted.blocks[segment.block]?.section} data-continued={segment.start > 0}>
            {fitted.blocks[segment.block] && blockRows(fitted.blocks[segment.block], lyricsOnly, segment.start, segment.end)}
          </section>)}
        </div>)}
      </div>
    </div>) : <div className="fit-page" style={{ padding: PAGE_PAD_Y + "px " + PAGE_PAD_X + "px" }}>{header}</div>}
    {footer && <div className="fit-footer">{footer}</div>}
  </div>;
}
