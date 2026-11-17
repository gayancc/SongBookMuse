import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Modal } from "./components";
import { Chart } from "./Chart";
import { MidiEvents } from "./MidiSettings";
import { encode } from "./commands";
import { notationOptions, type Settings, type Song, type Track } from "./model";

export function SongEditor({ song, settings, onClose, onSave }:
  { song: Song; settings: Settings; onClose: () => void; onSave: (s: Song) => Promise<void> }) {
  const [draft, setDraft] = useState(song);
  const [busy, setBusy] = useState(false);
  const [trackError, setTrackError] = useState("");
  const [trackBusy, setTrackBusy] = useState(false);
  const set = <K extends keyof Song,>(field: K, value: Song[K]) => setDraft(current => ({ ...current, [field]: value }));
  return <Modal title={song.title ? "Edit song" : "New song"} close={onClose}>
    <form className="editor" onSubmit={event => {
      event.preventDefault();
      setBusy(true);
      void onSave({ ...draft, title: draft.title.trim() }).finally(() => setBusy(false));
    }}>
      <div className="fields">
        <label>Title<input required autoFocus value={draft.title} onChange={e => set("title", e.target.value)}/></label>
        <label>Artist<input value={draft.artist} onChange={e => set("artist", e.target.value)}/></label>
        <label>Subtitle<input value={draft.subtitle} onChange={e => set("subtitle", e.target.value)}/></label>
        <label>Key<input placeholder="Am" value={draft.key} onChange={e => set("key", e.target.value)}/></label>
        <label>Tempo (BPM)<input type="number" min="0" max="300" value={draft.tempo} onChange={e => set("tempo", Number(e.target.value))}/></label>
        <label>Duration (seconds)<input type="number" min="0" max="86400" value={draft.duration} onChange={e => set("duration", Number(e.target.value))}/></label>
        <label>Time signature<input placeholder="4/4" value={draft.time_signature} onChange={e => set("time_signature", e.target.value)}/></label>
        <label>Copyright<input value={draft.copyright} onChange={e => set("copyright", e.target.value)}/></label>
        <label>Song number<input type="number" min="0" max="99999" value={draft.number} onChange={e => set("number", Math.max(0, Math.floor(Number(e.target.value) || 0)))}/></label>
        <label>Section order<input placeholder="Verse 1, Chorus, Verse 2, Chorus" value={draft.section_order} onChange={e => set("section_order", e.target.value)}/></label>
        <label className="wide">Tags, separated by commas<input defaultValue={draft.tags.join(", ")} onChange={e => set("tags", e.target.value.split(",").map(v => v.trim()).filter(Boolean))}/></label>
      </div>
      {!song.document && <div className="editor-split">
        <label>Source<textarea rows={12} spellCheck={false} value={draft.source} onChange={e => set("source", e.target.value)} placeholder="[Am]Add a chord before the lyric"/></label>
        <section className="editor-preview" aria-label="Live preview"><Chart source={draft.source} options={{ shift: draft.transpose, flats: settings.flats, key: draft.key,
          ...notationOptions(settings.notation), key_spelling: settings.key_spelling, section_order: draft.section_order }}/></section>
      </div>}
      <label>Notes<textarea rows={3} value={draft.notes} onChange={e => set("notes", e.target.value)}/></label>
      <label className="track-input">Backing track (MP3 or WAV)<input type="file" accept=".mp3,.wav" disabled={trackBusy} onChange={e => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        if (file.size > 24 * 1024 * 1024) { setTrackError("Backing track exceeds 24 MiB"); return; }
        setTrackBusy(true);
        setTrackError("");
        void encode(file).then(data => invoke<Track>("prepare_track", { name: file.name, data }))
          .then(track => set("track", track), error => setTrackError(String(error))).finally(() => setTrackBusy(false));
      }}/></label>
      {draft.track && <div className="track-file"><span>{draft.track.name}</span>
        <button type="button" onClick={() => set("track", null)}>Remove track</button></div>}
      {trackError && <p role="alert" className="dialog-error">{trackError}</p>}
      <MidiEvents events={draft.midi} change={midi => set("midi", midi)}/>
      <footer><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={busy || trackBusy || !draft.title.trim()}>Save song</button></footer>
    </form>
  </Modal>;
}
