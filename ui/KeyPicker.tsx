import { ChevronDown, RotateCcw } from "lucide-react";
import { useId, useLayoutEffect, useRef } from "react";

export interface KeyChoices {
  original: string;
  tonic: number;
  minor: boolean;
  names: string[];
}

const pitchClass = (value: number) => ((value % 12) + 12) % 12;
export const activePitch = (keys: KeyChoices, shift: number) => pitchClass(keys.tonic + shift);

/** Stay close to the current setting, within the inspector's transpose range. */
function shiftTo(keys: KeyChoices, shift: number, pitch: number) {
  const delta = pitchClass(pitch - activePitch(keys, shift) + 6) - 6;
  const target = shift + delta;
  if (target > 24 && target <= 36) return target - 12;
  if (target < -24 && target >= -36) return target + 12;
  return target > 24 || target < -24 ? (pitchClass(pitch - keys.tonic + 6) - 6) : target;
}

const symbols = (key: string) => key.replace("#", "♯").replace("b", "♭");
const fullName = (key: string, minor: boolean) => minor ? symbols(key.slice(0, -1)) + " minor" : symbols(key) + " major";

export function KeyReadout({ value, keys, capo, compact, anchor, open, pending }: {
  value: string; keys: KeyChoices | null; capo?: number; compact?: boolean; anchor?: HTMLButtonElement | null;
  open?: (button: HTMLButtonElement) => void; pending?: boolean;
}) {
  const id = useId();
  const expanded = anchor?.id === id;
  const label = value ? keys ? fullName(value, keys.minor) : value : "No key";
  const content = <>
    <small>{compact ? "Key" : "Song key"}</small>
    <span className="key-readout-value">{value && compact ? value : label}{Boolean(capo) && <em title={`Capo ${capo}`}>c{capo}</em>}</span>
    {open && <ChevronDown size={14} aria-hidden="true"/>}
  </>;
  const className = "key-readout" + (compact ? " key-readout-compact" : "");
  return open ? <button id={id} type="button" className={className} aria-haspopup={keys ? undefined : "dialog"}
    aria-expanded={keys ? expanded : undefined} aria-controls={expanded ? "song-key-picker" : undefined}
    aria-label={keys ? "Change key from " + label : "Set song key"} disabled={pending && !expanded}
    onClick={event => open(event.currentTarget)}>{content}</button>
    : <span className={className} title={label}>{content}</span>;
}

// Grid lines for C through B, interleaving the raised keys between their neighbors.
const piano = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13];

export function KeyPicker({ anchor, keys, shift, inSet, pending, error, close, change }: {
  anchor: HTMLButtonElement; keys: KeyChoices; shift: number; inSet: boolean; pending: boolean; error: string;
  close: () => void; change: (shift: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const selected = activePitch(keys, shift);
  const current = shift === 0 ? keys.original : keys.names[selected];

  useLayoutEffect(() => {
    const panel = ref.current!;
    const gap = 6;
    function position() {
      const rect = anchor.getBoundingClientRect();
      if (!rect.width || !rect.height) { close(); return; }
      const left = Math.min(rect.right - panel.offsetWidth, window.innerWidth - panel.offsetWidth - gap);
      const below = rect.bottom + gap;
      const above = rect.top - panel.offsetHeight - gap;
      const top = below + panel.offsetHeight <= window.innerHeight - gap ? below : above;
      panel.style.left = Math.max(gap, left) + "px";
      panel.style.top = Math.max(gap, top) + "px";
    }
    function dismissOutside(event: Event) {
      const target = event.target;
      if (target instanceof Node && !panel.contains(target) && !anchor.contains(target)) close();
    }
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      anchor.focus({ preventScroll: true });
      close();
    }
    position();
    panel.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
    const observer = new ResizeObserver(position);
    observer.observe(anchor);
    observer.observe(panel);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [anchor, close]);

  return <div id="song-key-picker" ref={ref} className="key-picker" role="group" aria-label="Change song key">
    <div className="key-picker-heading">
      <strong>{keys.minor ? "Minor keys" : "Major keys"}</strong>
      {inSet && <small>This setlist entry</small>}
    </div>
    {error && <p className="dialog-error" role="alert">{error}</p>}
    <div className="key-piano">
      {keys.names.map((name, pitch) => {
        const column = piano[pitch];
        const raised = column % 2 === 0;
        const key = pitch === selected ? current : pitch === keys.tonic ? keys.original : name;
        return <button type="button" key={pitch} className="piano-key" data-raised={raised}
          style={{ gridColumn: `${column} / span 2`, gridRow: raised ? 1 : 2 }}
          aria-label={fullName(key, keys.minor)} aria-pressed={pitch === selected} disabled={pending}
          onClick={() => change(pitch === selected ? shift : pitch === keys.tonic ? 0 : shiftTo(keys, shift, pitch))}>
          {symbols(keys.minor ? key.slice(0, -1) : key)}{keys.minor && <span>m</span>}
        </button>;
      })}
    </div>
    {shift !== 0 && <footer><button type="button" className="key-reset" disabled={pending} onClick={() => change(0)}>
      <RotateCcw size={14} aria-hidden="true"/>Original key · {fullName(keys.original, keys.minor)}
    </button></footer>}
  </div>;
}
