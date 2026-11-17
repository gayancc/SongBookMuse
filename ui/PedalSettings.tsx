import { useState } from "react";
import { Plus, X } from "lucide-react";
import { IconButton } from "./components";
import { navigationActions, type NavigationAction, type Settings } from "./model";

const reservedKeys = new Set(["Alt", "AltGraph", "CapsLock", "Control", "Dead", "Escape", "Meta", "Process", "Shift", "Tab", "Unidentified"]);

export function pedalKey(event: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "isComposing">) {
  if (!event.key || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || reservedKeys.has(event.key)) return null;
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

const displayKey = (key: string) => key === " " ? "Space" : key;

export function PedalSettings({ bindings, change }: {
  bindings: Settings["keyboard_pedals"];
  change: (bindings: Settings["keyboard_pedals"]) => void;
}) {
  const [learning, setLearning] = useState(false);
  const [message, setMessage] = useState("");

  return <section className="settings-section">
    <h3>Keyboard pedals</h3>
    {Object.entries(bindings).map(([key, action]) => <div className="midi-row" key={key}>
      <label>{displayKey(key)}<select value={action} onChange={e => change({ ...bindings, [key]: e.target.value as NavigationAction })}>
        {Object.entries(navigationActions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <IconButton label={"Remove pedal " + displayKey(key)} onClick={() => {
        const next = { ...bindings };
        delete next[key];
        change(next);
      }}><X size={16}/></IconButton>
    </div>)}
    <button type="button" aria-pressed={learning} onBlur={() => setLearning(false)} onClick={() => {
      setMessage("");
      setLearning(!learning);
    }} onKeyDown={event => {
      if (!learning || event.repeat) return;
      const key = pedalKey(event.nativeEvent);
      if (key === null) return;
      event.preventDefault();
      setLearning(false);
      if (Object.hasOwn(bindings, key)) {
        setMessage(displayKey(key) + " is already assigned");
      } else {
        change({ ...bindings, [key]: "page_down" });
      }
    }}><Plus size={16}/>{learning ? "Press a pedal" : "Add pedal action"}</button>
    {message && <p className="muted" role="status">{message}</p>}
  </section>;
}
