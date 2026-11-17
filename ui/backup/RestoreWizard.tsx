import { useState } from "react";
import { AlertTriangle, FileArchive } from "lucide-react";
import type { Preview } from "../model";
import { Switch } from "../settings/controls";
import { fileSize, type LibraryStats } from "./history";

export type RestoreMode = "merge" | "replace";
export interface RestoreResult { songs: number; reused: number; sets: number }

interface RestoreWizardProps {
  preview: Preview;
  file: { name: string; size: number };
  current: LibraryStats;
  restore: (mode: RestoreMode) => Promise<RestoreResult>;
  /** Saves a backup of the current library; resolves false when the save was cancelled. */
  safetyExport: () => Promise<boolean>;
  close: () => void;
  /** Lets the window block closing while a restore is writing. */
  setBusy: (busy: boolean) => void;
}

const n = (value: number) => value.toLocaleString();
const plural = (value: number, one: string, many = one + "s") => n(value) + " " + (value === 1 ? one : many);

/** One compact panel: what the file holds, merge or replace, then a single action. */
export function RestoreWizard({ preview, file, current, restore, safetyExport, close, setBusy }: RestoreWizardProps) {
  const details = preview.details;
  const [mode, setMode] = useState<RestoreMode>("merge");
  const [safety, setSafety] = useState(true);
  const [understood, setUnderstood] = useState(false);
  const [working, setWorking] = useState<"" | "safety" | "restore">("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<RestoreResult & { safetySaved: boolean } | null>(null);

  async function run() {
    setMessage("");
    setBusy(true);
    let safetySaved = false;
    try {
      if (mode === "replace" && safety) {
        setWorking("safety");
        safetySaved = await safetyExport();
        if (!safetySaved) {
          setMessage("The safety backup was not saved, so nothing was replaced.");
          return;
        }
      }
      setWorking("restore");
      setResult({ ...await restore(mode), safetySaved });
    } catch (cause) {
      setMessage(String(cause));
    } finally {
      setWorking("");
      setBusy(false);
    }
  }

  if (result) return <div className="restore-panel">
    <p className="restore-result" role="status"><i className="led" data-state="ok" aria-hidden="true"/>
      <span><strong>{mode === "merge" ? "Library merged" : "Library replaced"}</strong>
        {" · "}{plural(result.songs, "song")} added · {n(result.reused)} reused · {plural(result.sets, "setlist")}
        {result.safetySaved && <small>Your previous library was saved as a safety backup first.</small>}</span></p>
    <footer><button type="button" className="primary" onClick={close}>Done</button></footer>
  </div>;

  const contents = [plural(details.songs, "song"), details.documents ? plural(details.documents, "PDF/image", "PDFs/images") : "",
    details.archived ? n(details.archived) + " archived" : "", plural(details.sets, "setlist"), plural(details.folders, "folder"),
    details.settings ? "preferences" : ""].filter(Boolean).join(" · ");
  const effect = mode === "merge"
    ? "Adds what is new. Songs you already have are reused; nothing is removed and your preferences stay."
    : "Deletes your " + plural(current.songs + current.archived, "song") + ", " + plural(current.sets, "setlist") + " and "
      + plural(current.folders, "folder") + ", then loads the backup. "
      + (details.settings ? "Your preferences are replaced by the backup's." : "Your preferences return to defaults, because this backup has none.");
  const canRestore = mode === "merge" || safety || understood;

  return <div className="restore-panel">
    <div className="restore-file"><FileArchive size={16} aria-hidden="true"/>
      <strong>{file.name}</strong><small>{details.format} · {fileSize(file.size)}</small></div>
    <p className="restore-contents" aria-label="Backup contents">{contents}</p>
    {details.warnings.length > 0 && <ul className="restore-warnings" aria-label="Warnings">
      {details.warnings.map(w => <li key={w}><AlertTriangle size={13} aria-hidden="true"/>{w}</li>)}</ul>}

    <div className="restore-mode">
      <div role="radiogroup" aria-label="Restore mode" className="segment-group">
        {(["merge", "replace"] as const).map(m => <label key={m} className="segment" data-checked={mode === m} data-danger={m === "replace"}>
          <input type="radio" name="restore-mode" checked={mode === m} disabled={working !== ""} onChange={() => setMode(m)}/>
          {m === "merge" ? "Merge" : "Replace"}</label>)}
      </div>
      <p className="restore-effect" data-danger={mode === "replace"}>{effect}</p>
    </div>

    {mode === "replace" && <div className="restore-guards">
      <Switch label="Save a safety backup of my current library first" checked={safety} onChange={setSafety} disabled={working !== ""}/>
      {!safety && <label className="check"><input type="checkbox" checked={understood} onChange={e => setUnderstood(e.target.checked)}/>
        I understand my current library will be deleted without a backup</label>}
    </div>}
    {message && <p className="dialog-error" role="alert">{message}</p>}

    <footer><button type="button" disabled={working !== ""} onClick={close}>Cancel</button>
      <button type="button" className={mode === "replace" ? "danger" : "primary"} disabled={!canRestore || working !== ""} onClick={() => void run()}>
        {working === "safety" ? "Saving safety backup…" : working === "restore" ? "Restoring…" : mode === "merge" ? "Merge library" : "Replace library"}</button></footer>
  </div>;
}
