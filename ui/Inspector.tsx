import { Eraser, Highlighter, Lock, LockOpen, PenLine, Pencil, Redo2, Undo2, X } from "lucide-react";
import { IconButton, Stepper } from "./components";
import type { InkTool } from "./DocumentView";
import { duration, type Folder, type Settings, type Song } from "./model";
import type { AutoScroll } from "./useAutoScroll";

interface InspectorProps {
  song: Song;
  kind: string;
  shift: number;
  capo: number;
  inSet: boolean;
  changePitch: (property: "transpose" | "capo", value: number) => void;
  settings: Settings;
  changeSettings: (settings: Settings) => void;
  folders: Folder[];
  toggleFolder: (id: string) => void;
  toggleLock: () => void;
  autoScroll: AutoScroll;
  sectionLabels: string[];
  changeSectionOrder: (order: string) => void;
  tool: InkTool;
  setTool: (tool: InkTool) => void;
  brush: string;
  setBrush: (color: string) => void;
  width: number;
  setWidth: (width: number) => void;
  undo: (() => void) | null;
  redo: (() => void) | null;
  edit: () => void;
  close: () => void;
}

const swatches = ["#e8453c", "#f5a03a", "#f2d24b", "#4fb89a", "#5f93d8", "#a77ad8", "#1d1d1d"];

function SectionOrder({ labels, order, change, disabled }: { labels: string[]; order: string; change: (order: string) => void; disabled: boolean }) {
  const items = order.split(",").map(s => s.trim()).filter(Boolean);
  const write = (next: string[]) => change(next.join(", "));
  if (!labels.length) return <p className="muted">Add section directives such as {"{start_of_chorus}"} or {"{c: Verse 1}"} to arrange sections.</p>;
  return <>
    <div className="pattern-sequence" aria-label="Section order">
      {items.length ? items.map((item, i) => <span className="pattern-chip" data-section={item.toLowerCase().split(" ")[0]} key={i + item}>
        {item}<button type="button" aria-label={"Remove " + item + " at position " + (i + 1)} disabled={disabled}
          onClick={() => write(items.filter((_, j) => j !== i))}><X size={11}/></button></span>)
        : <span className="muted">Source order</span>}
    </div>
    <div className="pattern-palette">
      {labels.map(label => <button type="button" key={label} className="pattern-add" data-section={label.toLowerCase().split(" ")[0]}
        disabled={disabled} onClick={() => write([...items, label])}>+ {label}</button>)}
      {items.length > 0 && <button type="button" className="pattern-add" disabled={disabled} onClick={() => write([])}>Reset</button>}
    </div>
  </>;
}

export function Inspector(props: InspectorProps) {
  const { song, settings, autoScroll } = props;
  const locked = song.locked;
  const minutes = Math.floor(autoScroll.seconds / 60) + ":" + String(autoScroll.seconds % 60).padStart(2, "0");
  return <aside className="inspector" aria-label="Song details">
    <div className="panel-head"><h2>Song details</h2>
      <IconButton label={locked ? "Unlock song" : "Lock song"} aria-pressed={locked} onClick={props.toggleLock}>
        {locked ? <Lock size={15}/> : <LockOpen size={15}/>}</IconButton>
      <IconButton label="Close details" onClick={props.close}><X size={15}/></IconButton>
    </div>
    <section className="rack">
      <h3>Pitch{props.inSet && <small> · this setlist</small>}</h3>
      <Stepper label="Transpose" value={props.shift} display={(props.shift > 0 ? "+" : "") + props.shift} min={-24} max={24}
        onChange={v => props.changePitch("transpose", v)}/>
      <Stepper label="Capo" value={props.capo} min={0} max={12} onChange={v => props.changePitch("capo", v)}/>
      <label className="check"><input type="checkbox" checked={settings.notation === "nashville"}
        onChange={e => props.changeSettings({ ...settings, notation: e.target.checked ? "nashville" : "standard" })}/>Nashville numbers</label>
    </section>
    <section className="rack">
      <h3>View</h3>
      <Stepper label="Zoom" value={settings.scale} display={settings.scale + "%"} min={65} max={200} step={5}
        onChange={scale => props.changeSettings({ ...settings, scale })}/>
      {!song.document && <Stepper label="Scroll time" value={autoScroll.seconds} display={minutes} min={15} max={1800} step={15}
        onChange={value => props.autoScroll.adjust(value / autoScroll.seconds)}/>}
    </section>
    {!song.document && <section className="rack">
      <h3>Section order</h3>
      <SectionOrder labels={props.sectionLabels} order={song.section_order} change={props.changeSectionOrder} disabled={locked}/>
    </section>}
    {song.document && <section className="rack">
      <h3>Annotations</h3>
      <div className="tool-row" role="toolbar" aria-label="Annotation tools">
        <IconButton label="Pen" aria-pressed={props.tool === "pen"} disabled={locked} onClick={() => props.setTool(props.tool === "pen" ? "none" : "pen")}><PenLine size={15}/></IconButton>
        <IconButton label="Highlighter" aria-pressed={props.tool === "highlight"} disabled={locked} onClick={() => props.setTool(props.tool === "highlight" ? "none" : "highlight")}><Highlighter size={15}/></IconButton>
        <IconButton label="Eraser" aria-pressed={props.tool === "erase"} disabled={locked} onClick={() => props.setTool(props.tool === "erase" ? "none" : "erase")}><Eraser size={15}/></IconButton>
        <span className="toolbar-spacer"/>
        <IconButton label="Undo stroke" disabled={!props.undo} onClick={() => props.undo?.()}><Undo2 size={15}/></IconButton>
        <IconButton label="Redo stroke" disabled={!props.redo} onClick={() => props.redo?.()}><Redo2 size={15}/></IconButton>
      </div>
      <div className="swatches" role="radiogroup" aria-label="Ink colour">
        {swatches.map(color => <button type="button" key={color} role="radio" aria-checked={props.brush === color} aria-label={"Colour " + color}
          style={{ background: color }} onClick={() => props.setBrush(color)}/>)}
      </div>
      <Stepper label="Width" value={Math.round(props.width * 1000)} min={1} max={12} onChange={v => props.setWidth(v / 1000)}/>
    </section>}
    <section className="rack">
      <h3>Folders</h3>
      {props.folders.length ? props.folders.map(folder => <label className="check" key={folder.id}>
        <input type="checkbox" checked={song.folders.includes(folder.id)} onChange={() => props.toggleFolder(folder.id)}/>{folder.name}</label>)
        : <p className="muted">Create folders in the library browser.</p>}
    </section>
    <section className="rack">
      <h3>Details</h3>
      <dl><dt>Format</dt><dd>{props.kind}</dd>
        <dt>Duration</dt><dd>{duration(song.duration)}</dd>
        {song.number > 0 && <><dt>Number</dt><dd>{song.number}</dd></>}
        {!!song.tags.length && <><dt>Tags</dt><dd>{song.tags.join(", ")}</dd></>}</dl>
      <button type="button" disabled={locked} onClick={props.edit}><Pencil size={14}/>Edit song</button>
    </section>
  </aside>;
}
