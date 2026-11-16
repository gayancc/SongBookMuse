import { useState } from "react";
import { Modal } from "./components";

interface PromptProps {
  title: string;
  label: string;
  initial?: string;
  action: string;
  multiline?: boolean;
  close: () => void;
  submit: (value: string) => Promise<void>;
}

/** Single-field dialog used for folder names and setlist note items. */
export function Prompt({ title, label, initial = "", action, multiline = false, close, submit }: PromptProps) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  return <Modal title={title} close={close}>
    <form onSubmit={event => {
      event.preventDefault();
      setBusy(true);
      void submit(value.trim()).finally(() => setBusy(false));
    }}>
      <label>{label}{multiline
        ? <textarea autoFocus rows={5} value={value} maxLength={16000} onChange={e => setValue(e.target.value)}/>
        : <input autoFocus value={value} maxLength={256} onChange={e => setValue(e.target.value)}/>}</label>
      <footer><button type="button" onClick={close}>Cancel</button>
        <button className="primary" disabled={busy || !value.trim()}>{action}</button></footer>
    </form>
  </Modal>;
}
