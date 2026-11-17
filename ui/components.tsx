import { createContext, useContext, useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { X } from "lucide-react";

export const DialogError = createContext("");

export function IconButton({ label, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button className="icon-button" type="button" title={label} aria-label={label} {...props}>{children}</button>;
}

export function Modal({ title, close, children, className }: { title: string; close: () => void; children: ReactNode; className?: string }) {
  const error = useContext(DialogError);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); };
  }, []);
  return <dialog ref={ref} className={className} aria-labelledby="modal-title" onCancel={event => { event.preventDefault(); close(); }}>
    <header><h2 id="modal-title">{title}</h2><IconButton label="Close dialog" onClick={close}><X size={19}/></IconButton></header>
    <div className="modal-body">{error && <p className="dialog-error" role="alert">{error}</p>}{children}</div>
  </dialog>;
}

interface StepperProps {
  label: string;
  value: number;
  display?: string;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/** Channel-rack style value strip: label, LCD readout and nudge buttons. */
export function Stepper({ label, value, display, min, max, step = 1, onChange, disabled }: StepperProps) {
  return <div className="stepper" role="group" aria-label={label}>
    <span className="stepper-label">{label}</span>
    <button type="button" aria-label={label + " down"} disabled={disabled || value <= min} onClick={() => onChange(Math.max(min, value - step))}>−</button>
    <output className="lcd-value" aria-live="polite">{display ?? value}</output>
    <button type="button" aria-label={label + " up"} disabled={disabled || value >= max} onClick={() => onChange(Math.min(max, value + step))}>+</button>
  </div>;
}
