import { createContext, useContext, useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { X } from "lucide-react";

export const DialogError = createContext("");

export function IconButton({ label, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button className="icon-button" type="button" title={label} aria-label={label} {...props}>{children}</button>;
}

export function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const error = useContext(DialogError);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); };
  }, []);
  return <dialog ref={ref} aria-labelledby="modal-title" onCancel={event => { event.preventDefault(); close(); }}>
    <header><h2 id="modal-title">{title}</h2><IconButton label="Close dialog" onClick={close}><X size={19}/></IconButton></header>
    <div className="modal-body">{error && <p className="dialog-error" role="alert">{error}</p>}{children}</div>
  </dialog>;
}
