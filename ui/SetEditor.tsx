import { useState } from "react";
import { Modal } from "./components";
import type { Setlist } from "./model";

export function SetEditor({ setlist, close, save }:
  { setlist: Setlist; close: () => void; save: (s: Setlist) => Promise<void> }) {
  const [draft, update] = useState(setlist);
  const [busy, setBusy] = useState(false);
  return <Modal title={setlist.title ? "Edit setlist" : "New setlist"} close={close}>
    <form onSubmit={e => {
      e.preventDefault();
      setBusy(true);
      void save({ ...draft, title: draft.title.trim() }).finally(() => setBusy(false));
    }}>
      <label>Name<input autoFocus required value={draft.title} onChange={e => update({ ...draft, title: e.target.value })}/></label>
      <label>Date<input type="date" value={draft.date.slice(0,10)} onChange={e => update({ ...draft, date: e.target.value })}/></label>
      <label className="check"><input type="checkbox" checked={draft.pinned} onChange={e => update({ ...draft, pinned: e.target.checked })}/>Pin to top</label>
      <footer><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={busy || !draft.title.trim()}>Save setlist</button></footer>
    </form>
  </Modal>;
}
