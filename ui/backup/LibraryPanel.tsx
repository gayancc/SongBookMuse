import { useState } from "react";
import { Download, FolderUp } from "lucide-react";
import { Panel } from "../settings/controls";
import { ago, backupHealth, type LibraryStats } from "./history";

interface LibraryPanelProps {
  stats: LibraryStats;
  lastExport: number | null;
  /** Saves a backup; resolves false when the save dialog was cancelled. */
  exportBackup: () => Promise<boolean>;
  chooseRestore: () => void;
}

const healthText = { ok: "Backed up recently", stale: "Backup is over a week old", none: "No backup from this device yet" };
const healthLcd = { ok: "OK", stale: "OLD", none: "NONE" };

export function LibraryPanel({ stats, lastExport, exportBackup, chooseRestore }: LibraryPanelProps) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const health = backupHealth(lastExport);

  async function save() {
    setBusy(true);
    setStatus("");
    try {
      setStatus(await exportBackup() ? "Backup saved" : "Export cancelled");
    } catch (cause) {
      setStatus("Export failed: " + String(cause));
    } finally {
      setBusy(false);
    }
  }

  return <div className="library-page">
    <div className="library-lcd" role="group" aria-label="Library contents">
      <span><small>Songs</small>{stats.songs.toLocaleString()}</span>
      <span><small>PDF / image</small>{stats.documents.toLocaleString()}</span>
      <span><small>Setlists</small>{stats.sets.toLocaleString()}</span>
      <span><small>Folders</small>{stats.folders.toLocaleString()}</span>
      <span data-health={health}><small>Backup</small>{healthLcd[health]}</span>
    </div>

    <div className="library-actions">
      <Panel title="Export backup">
        <div className="backup-state">
          <i className="led" data-state={health} aria-hidden="true"/>
          <div><strong>{healthText[health]}</strong>
            <small>{lastExport === null ? "Export regularly and keep a copy off this device." : "Last export " + ago(lastExport)}</small></div>
        </div>
        <p className="backup-copy">One <code>.musebackup</code> file holds songs, PDFs and images, setlists, folders, ink, notes and preferences.</p>
        <div className="backup-foot">
          {status && <span className="backup-status" role="status">{status}</span>}
          <button type="button" className="primary" disabled={busy} onClick={() => void save()}><Download size={15}/>{busy ? "Saving…" : "Export backup"}</button>
        </div>
      </Panel>

      <Panel title="Restore backup">
        <button type="button" className="restore-drop" onClick={chooseRestore}>
          <FolderUp size={20} aria-hidden="true"/>
          <span><strong>Choose a backup file</strong>
            <small><code>.musebackup</code> from SongBookMuse · <code>.sbpbackup</code> or <code>.zip</code> from SongBook Pro</small></span>
        </button>
        <p className="setting-hint">Nothing changes until you choose Merge or Replace.</p>
      </Panel>
    </div>
  </div>;
}
