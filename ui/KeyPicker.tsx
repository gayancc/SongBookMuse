import { ChevronDown, RotateCcw } from "lucide-react";
import { Modal } from "./components";

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

export function KeyReadout({ value, keys, capo, compact, open, pending }: {
  value: string; keys: KeyChoices | null; capo?: number; compact?: boolean; open?: () => void; pending?: boolean;
}) {
  const label = value ? keys ? fullName(value, keys.minor) : value : "No key";
  const content = <>
    <small>{compact ? "Key" : "Song key"}</small>
    <span className="key-readout-value">{value && compact ? value : label}{Boolean(capo) && <em title={`Capo ${capo}`}>c{capo}</em>}</span>
    {open && <ChevronDown size={14} aria-hidden="true"/>}
  </>;
  const className = "key-readout" + (compact ? " key-readout-compact" : "");
  return open ? <button type="button" className={className} aria-haspopup="dialog"
    aria-label={keys ? "Change key from " + label : "Set song key"} disabled={pending} onClick={open}>{content}</button>
    : <span className={className} title={label}>{content}</span>;
}

// Grid lines for C through B, interleaving the raised keys between their neighbors.
const piano = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13];

export function KeyPicker({ keys, shift, inSet, pending, close, change }: {
  keys: KeyChoices; shift: number; inSet: boolean; pending: boolean; close: () => void; change: (shift: number) => void;
}) {
  const selected = activePitch(keys, shift);
  const current = shift === 0 ? keys.original : keys.names[selected];
  return <Modal title="Change song key" close={close} className="key-picker">
    <div className="key-picker-display">
      <div><small>Current key</small><strong>{fullName(current, keys.minor)}</strong></div>
      {inSet && <span>This setlist entry</span>}
    </div>
    <div className="key-piano" role="group" aria-label={keys.minor ? "Minor keys" : "Major keys"}>
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
  </Modal>;
}
