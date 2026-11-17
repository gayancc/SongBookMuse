import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileText, Music2, PanelLeftClose, PanelLeftOpen, Plus, Upload, X } from "lucide-react";
import { IconButton, Modal, Stepper } from "./components";
import { Chart } from "./Chart";
import { MidiEvents } from "./MidiSettings";
import { encode } from "./commands";
import { notationOptions, type Settings, type Song, type Track } from "./model";
import { SourceEditor, sourceStats } from "./editor/SourceEditor";

const KEYS = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B",
  "Cm", "C#m", "Dm", "D#m", "Ebm", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "Bbm", "Bm"];
const METERS = ["4/4", "3/4", "6/8", "2/4", "12/8", "5/4"];

/** "3:25" or "205" to seconds; null when the text is not a duration. */
export function parseDuration(text: string): number | null {
  const value = text.trim();
  if (!value) return 0;
  const clock = /^(\d{1,3}):([0-5]\d)$/.exec(value);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  return /^\d{1,5}$/.test(value) ? Number(value) : null;
}

const clockText = (seconds: number) => seconds > 0 ? Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0") : "";

function useSectionLabels(source: string, enabled: boolean) {
  const [labels, setLabels] = useState<string[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let obsolete = false;
    const timer = setTimeout(() => {
      void invoke<string[]>("section_labels", { source }).then(l => { if (!obsolete) setLabels(l); }, () => {});
    }, 200);
    return () => { obsolete = true; clearTimeout(timer); };
  }, [source, enabled]);
  return labels;
}

interface SongEditorProps { song: Song; settings: Settings; onClose: () => void; onSave: (s: Song) => Promise<void> }

export function SongEditor({ song, settings, onClose, onSave }: SongEditorProps) {
  const [draft, setDraft] = useState(song);
  const [touched, setTouched] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [trackError, setTrackError] = useState("");
  const [trackBusy, setTrackBusy] = useState(false);
  const [duration, setDuration] = useState(clockText(song.duration));
  const [tags, setTags] = useState(song.tags.join(", "));
  const [pane, setPane] = useState<"source" | "preview">("source");
  const [rackOpen, setRackOpen] = useState(true);
  const isNew = !song.title;
  const isChart = !song.document;
  const labels = useSectionLabels(draft.source, isChart);
  const durationValue = parseDuration(duration);
  const title = draft.title.trim();
  const problem = !title ? "A title is required" : durationValue === null ? "Duration must look like 3:25 or 205" : "";

  function set<K extends keyof Song>(field: K, value: Song[K]) {
    setDraft(current => ({ ...current, [field]: value }));
    setTouched(true);
    setConfirmDiscard(false);
  }

  function requestClose() {
    if (touched && !busy) setConfirmDiscard(true);
    else if (!busy) onClose();
  }

  function save() {
    if (problem || busy || trackBusy) return;
    setBusy(true);
    const tagList = tags.split(",").map(v => v.trim()).filter(Boolean);
    void onSave({ ...draft, title, duration: durationValue ?? 0, tags: tagList }).finally(() => setBusy(false));
  }

  // Ctrl+S saves wherever focus is while the editor is open, even after a hidden pane drops focus.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const shortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); saveRef.current(); }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  function addSection(label: string) {
    set("section_order", draft.section_order.trim() ? draft.section_order.replace(/,?\s*$/, ", ") + label : label);
  }

  function loadTrack(file: File | undefined) {
    if (!file) return;
    if (file.size > 24 * 1024 * 1024) { setTrackError("Backing track exceeds 24 MiB"); return; }
    setTrackBusy(true);
    setTrackError("");
    void encode(file).then(data => invoke<Track>("prepare_track", { name: file.name, data }))
      .then(track => set("track", track), error => setTrackError(String(error))).finally(() => setTrackBusy(false));
  }

  const preview = { shift: draft.transpose - draft.capo, flats: settings.flats, key: draft.key, ...notationOptions(settings.notation),
    key_spelling: settings.key_spelling, section_order: draft.section_order };

  return <Modal title={isNew ? "New song" : "Edit song"} close={requestClose} className="editor-window">
    <form className="song-editor" data-pane={pane} data-rack={rackOpen} onSubmit={e => { e.preventDefault(); save(); }}>
      <div className="editor-identity">
        <IconButton label={rackOpen ? "Hide song properties" : "Show song properties"} aria-pressed={rackOpen}
          onClick={() => setRackOpen(open => !open)}>{rackOpen ? <PanelLeftClose size={16}/> : <PanelLeftOpen size={16}/>}</IconButton>
        <input className="identity-title" required autoFocus aria-label="Title" value={draft.title} placeholder="Song title" onChange={e => set("title", e.target.value)}/>
        <input aria-label="Artist" value={draft.artist} placeholder="Artist" onChange={e => set("artist", e.target.value)}/>
        <input aria-label="Subtitle" value={draft.subtitle} placeholder="Subtitle" onChange={e => set("subtitle", e.target.value)}/>
        <input className="identity-number" type="number" min="0" max="99999" aria-label="Song number" title="Song number" value={draft.number || ""} placeholder="#"
          onChange={e => set("number", Math.max(0, Math.floor(Number(e.target.value) || 0)))}/>
      </div>

      <div className="editor-workspace" data-chart={isChart}>
        <aside className="editor-rack" aria-label="Song properties" hidden={!rackOpen}>
          <div className="rack-fields">
            <label>Key<input list="song-keys" placeholder="—" value={draft.key} onChange={e => set("key", e.target.value)}/></label>
            <label>Tempo<input type="number" min="0" max="300" aria-label="Tempo (BPM)" value={draft.tempo || ""} placeholder="BPM" onChange={e => set("tempo", Math.max(0, Number(e.target.value) || 0))}/></label>
            <label>Time<input list="song-meters" aria-label="Time signature" placeholder="4/4" value={draft.time_signature} onChange={e => set("time_signature", e.target.value)}/></label>
            <label>Duration<input inputMode="numeric" placeholder="3:25" value={duration} aria-invalid={durationValue === null}
              onChange={e => { setDuration(e.target.value); setTouched(true); }}/></label>
          </div>
          <Stepper label="Capo" value={draft.capo} min={0} max={11} onChange={v => set("capo", v)}/>
          <Stepper label="Transpose" value={draft.transpose} min={-11} max={11} display={(draft.transpose > 0 ? "+" : "") + draft.transpose} onChange={v => set("transpose", v)}/>
          <datalist id="song-keys">{KEYS.map(k => <option key={k} value={k}/>)}</datalist>
          <datalist id="song-meters">{METERS.map(m => <option key={m} value={m}/>)}</datalist>

          <hr/>
          <input aria-label="Copyright" value={draft.copyright} placeholder="Copyright / CCLI" onChange={e => set("copyright", e.target.value)}/>
          <input aria-label="Tags" value={tags} placeholder="Tags, comma separated" onChange={e => { setTags(e.target.value); setTouched(true); }}/>
          {tags.trim() && <div className="tag-chips" aria-hidden="true">
            {tags.split(",").map(t => t.trim()).filter(Boolean).map(t => <span key={t}>{t}</span>)}</div>}

          <hr/>
          <div className="track-slot">
            {draft.track ? <><Music2 size={14} aria-hidden="true"/><span className="track-name">{draft.track.name}</span>
              <IconButton label="Remove track" onClick={() => set("track", null)}><X size={13}/></IconButton></>
              : <label className="track-pick"><Upload size={13} aria-hidden="true"/>{trackBusy ? "Loading track…" : "Backing track…"}
                <input type="file" accept=".mp3,.wav" aria-label="Backing track (MP3 or WAV)" disabled={trackBusy}
                  onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; loadTrack(file); }}/></label>}
          </div>
          {trackError && <p role="alert" className="dialog-error">{trackError}</p>}
          <MidiEvents events={draft.midi} change={midi => set("midi", midi)}/>
          <details className="rack-notes" open={Boolean(song.notes)}>
            <summary>Notes{draft.notes.trim() ? " ·" : ""}</summary>
            <textarea aria-label="Notes" rows={4} value={draft.notes} placeholder="Cues for the band, reminders" onChange={e => set("notes", e.target.value)}/>
          </details>
        </aside>

        {isChart ? <>
          <div className="pane-switch segment-group" role="tablist" aria-label="Editor view">
            {(["source", "preview"] as const).map(p => <button key={p} type="button" role="tab" aria-selected={pane === p}
              className="segment" data-checked={pane === p} onClick={() => setPane(p)}>{p === "source" ? "Source" : "Preview"}</button>)}
          </div>
          <div className="editor-pane editor-source">
            <SourceEditor value={draft.source} onChange={v => set("source", v)} stats={sourceStats(draft.source)}/>
          </div>
          <div className="editor-pane editor-output">
            <div className="section-order">
              <label>Order<input aria-label="Section order" value={draft.section_order} placeholder="Source order" onChange={e => set("section_order", e.target.value)}/></label>
              {labels.length > 0 && <div className="section-chips" role="group" aria-label="Add a section to the order">
                {labels.map(l => <button key={l} type="button" onClick={() => addSection(l)}><Plus size={11}/>{l}</button>)}
                {draft.section_order && <button type="button" className="chip-clear" onClick={() => set("section_order", "")}>Reset</button>}
              </div>}
            </div>
            <section className="editor-preview" aria-label="Live preview">
              {draft.source.trim() ? <Chart source={draft.source} options={preview}/> : <p className="preview-empty">The chart appears here as you type.</p>}
            </section>
          </div>
        </> : <div className="editor-pane">
          <div className="document-note"><FileText size={28} aria-hidden="true"/>
            <strong>{song.document?.mime === "application/pdf" ? "PDF document" : "Image"}</strong>
            <p>The pages are kept as imported. Draw on them, invert them or page through them in the song view.</p></div>
        </div>}
      </div>

      <div className="editor-status">
        {confirmDiscard ? <div className="discard" role="alert">
          <span>Discard your changes to this song?</span>
          <button type="button" onClick={() => setConfirmDiscard(false)}>Keep editing</button>
          <button type="button" className="danger" onClick={onClose}>Discard</button>
        </div> : <>
          <span className="editor-state"><i className="led" data-state={problem ? "none" : touched ? "stale" : "ok"} aria-hidden="true"/>
            {problem || (touched ? "Unsaved changes · Ctrl+S saves" : isNew ? "New song" : "No changes")}</span>
          <button type="button" onClick={requestClose}>Cancel</button>
          <button className="primary" disabled={Boolean(problem) || busy || trackBusy}>{busy ? "Saving…" : "Save song"}</button>
        </>}
      </div>
    </form>
  </Modal>;
}
