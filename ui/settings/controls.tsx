import { useEffect, useId, useState, type ReactNode } from "react";

/** Group box with a slim title bar, like a plugin or mixer panel. Uses divs: dialog headers carry title-bar styles. */
export function Panel({ title, crumb, actions, wide = false, children }: {
  title: string;
  /** Category shown before the title in search results. */
  crumb?: string;
  actions?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return <section className="panel" data-wide={wide} aria-labelledby={id}>
    <div className="panel-bar">
      <h4 id={id}>{crumb && <span className="crumb">{crumb} ›</span>}{title}</h4>
      {actions && <div className="panel-actions">{actions}</div>}
    </div>
    <div className="panel-body">{children}</div>
  </section>;
}

/** One channel-rack row: name and explanation on the left, the control on the right. */
export function SettingRow({ label, hint, htmlFor, children, wide = false }: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  /** Stacks the control under the text for wide controls such as option cards. */
  wide?: boolean;
}) {
  // Wide rows hold option cards under a panel title that already names them, so only the hint shows.
  return <div className="setting-row" data-wide={wide}>
    <div className="setting-text">
      {htmlFor ? <label htmlFor={htmlFor} className="setting-name">{label}</label>
        : <span className={wide ? "sr-only" : "setting-name"}>{label}</span>}
      {hint && <p className="setting-hint">{hint}</p>}
    </div>
    <div className="setting-control">{children}</div>
  </div>;
}

/** Checkbox drawn as an LED switch. The visible label doubles as the accessible name. */
export function Switch({ label, checked, onChange, disabled, compact = false }: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Inside a setting row the row names the setting, so only an ON/OFF readout is shown. */
  compact?: boolean;
}) {
  return <label className="led-switch" data-compact={compact}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)}/>
    <span className="led-switch-track" aria-hidden="true"><i/></span>
    {compact ? <><span className="sr-only">{label}</span><span className="led-switch-state" aria-hidden="true">{checked ? "ON" : "OFF"}</span></>
      : <span className="led-switch-label">{label}</span>}
  </label>;
}

export interface Choice<T extends string> {
  value: T;
  label: string;
  /** Optional second line, such as an example or a tuning. */
  detail?: string;
}

/** Radio group drawn as a row of hardware-style segment buttons, or as cards when `cards` is set. */
export function Segmented<T extends string>({ label, value, choices, onChange, cards = false }: {
  label: string;
  value: T;
  choices: Choice<T>[];
  onChange: (value: T) => void;
  cards?: boolean;
}) {
  const name = useId();
  return <div role="radiogroup" aria-label={label} className={cards ? "choice-cards" : "segment-group"}>
    {choices.map(choice => <label key={choice.value} className="segment" data-checked={choice.value === value}>
      <input type="radio" name={name} value={choice.value} checked={choice.value === value} onChange={() => onChange(choice.value)}/>
      <span className="segment-label">{choice.label}</span>
      {choice.detail && <small>{choice.detail}</small>}
    </label>)}
  </div>;
}

/**
 * Slider with an LCD number field. The slider moves through the common range; the field accepts
 * the full valid range and commits on blur or Enter so typing "1" on the way to "120" is not saved.
 */
export function RangeField({ label, value, min, max, sliderMax = max, step = 1, format, unit, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  sliderMax?: number;
  step?: number;
  /** Readable form shown beside the number, such as 1:30 for 90 seconds. */
  format?: (value: number) => string;
  /** Unit shown after the number when no readable form is needed. */
  unit?: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  function commit() {
    const next = clamp(Number(draft) || value);
    setDraft(String(next));
    if (next !== value) onChange(next);
  }
  return <div className="range-field">
    <input type="range" aria-label={label + " slider"} min={min} max={sliderMax} step={step}
      value={Math.min(value, sliderMax)} onChange={e => onChange(clamp(Number(e.target.value)))}/>
    <span className="range-readout">
      <input type="number" aria-label={label} min={min} max={max} value={draft}
        onChange={e => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}/>
      {format ? <small>{format(value)}</small> : unit && <small className="range-unit">{unit}</small>}
    </span>
  </div>;
}
