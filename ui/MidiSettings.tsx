import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, X } from "lucide-react";
import { IconButton } from "./components";
import { navigationActions, type MidiMessage, type NavigationAction } from "./model";

type Port = { id: string; label: string };
type Ports = { supported: boolean; inputs: Port[]; outputs: Port[] };
type Mapping = { channel: number; number: number; note: boolean; action: NavigationAction };
type Setup = { input: string; output: string; bindings: Mapping[] };
const defaults: Setup = { input: "", output: "", bindings: [] };

export function MidiSettings({ onError }: { onError: (cause: unknown) => void }) {
  const [ports, setPorts] = useState<Ports | null>(null);
  const [setup, setSetup] = useState<Setup>(() => {
    try { return JSON.parse(localStorage.getItem("midi-setup") ?? "null") ?? defaults; }
    catch { return defaults; }
  });
  const [status, setStatus] = useState("");

  async function refresh() {
    try { setPorts(await invoke<Ports>("midi_ports")); }
    catch (error) { onError(error); }
  }
  async function connect() {
    try {
      await invoke("midi_connect", { input: setup.input || null, output: setup.output || null, bindings: setup.bindings });
      localStorage.setItem("midi-setup", JSON.stringify(setup));
      setStatus(setup.input || setup.output ? "Selected MIDI ports connected" : "MIDI ports disconnected");
    } catch (error) { setStatus(""); onError(error); }
  }
  function change(index: number, update: Partial<Mapping>) {
    setSetup(current => ({ ...current, bindings: current.bindings.map((b, i) => i === index ? { ...b, ...update } : b) }));
  }
  return <section className="settings-section">
    <h3>MIDI controllers</h3>
    <button type="button" onClick={() => void refresh()}>Scan for MIDI ports</button>
    {ports && !ports.supported && <p className="muted">MIDI device access is unavailable on this build.</p>}
    {ports?.supported && <>
      <div className="fields midi-controls">
        <label>Input<select value={setup.input} onChange={e => setSetup({ ...setup, input: e.target.value })}>
          <option value="">None</option>{ports.inputs.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          {setup.input && !ports.inputs.some(p => p.id === setup.input) && <option value={setup.input} disabled>Unavailable input</option>}
        </select></label>
        <label>Output<select value={setup.output} onChange={e => setSetup({ ...setup, output: e.target.value })}>
          <option value="">None</option>{ports.outputs.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          {setup.output && !ports.outputs.some(p => p.id === setup.output) && <option value={setup.output} disabled>Unavailable output</option>}
        </select></label>
      </div>
      {setup.bindings.map((b,i) => <div className="midi-row" key={i}>
        <label>Action<select value={b.action} onChange={e => change(i, { action: e.target.value as NavigationAction })}>
          {Object.entries(navigationActions).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Message<select value={b.note ? "note" : "cc"} onChange={e => change(i, { note: e.target.value === "note" })}><option value="cc">CC</option><option value="note">Note</option></select></label>
        <label>Ch.<input type="number" min="1" max="16" value={b.channel} onChange={e => change(i, { channel: Number(e.target.value) })}/></label>
        <label>Number<input type="number" min="0" max="127" value={b.number} onChange={e => change(i, { number: Number(e.target.value) })}/></label>
        <IconButton label={"Remove mapping " + (i + 1)} onClick={() => setSetup({ ...setup, bindings: setup.bindings.filter((_, j) => i !== j) })}><X size={16}/></IconButton>
      </div>)}
      <div className="button-row">
        <button type="button" disabled={setup.bindings.length >= 16} onClick={() => setSetup({ ...setup, bindings: [...setup.bindings, { channel: 1, number: 64, note: false, action: "next_song" }] })}><Plus size={16}/>Mapping</button>
        <button type="button" onClick={() => void connect()}>Apply connections</button>
      </div>
      {status && <p className="muted" role="status">{status}</p>}
    </>}
  </section>;
}

export function MidiEvents({ events, change }: { events: MidiMessage[]; change: (events: MidiMessage[]) => void }) {
  function update(i: number, m: MidiMessage) { change(events.map((v,j) => i === j ? m : v)); }
  function message(kind: MidiMessage["kind"], channel: number): MidiMessage {
    if (kind === "program") return { kind, channel, program: 0 };
    if (kind === "control") return { kind, channel, controller: 0, value: 0 };
    return { kind, channel, note: 60, velocity: kind === "note_on" ? 100 : 0 };
  }
  return <details className="midi-events">
    <summary>MIDI on song open{events.length ? " · " + events.length : ""}</summary>
    {events.map((m,i) => <div className="midi-row" key={i}>
      <label>Message<select value={m.kind} onChange={e => update(i, message(e.target.value as MidiMessage["kind"], m.channel))}>
        <option value="program">Program Change</option><option value="control">Control Change</option>
        <option value="note_on">Note On</option><option value="note_off">Note Off</option>
      </select></label>
      <label>Channel<input type="number" min="1" max="16" required value={m.channel} onChange={e => update(i,{ ...m, channel: Number(e.target.value) })}/></label>
      {m.kind === "program" ? <label>Program<input type="number" min="0" max="127" required value={m.program} onChange={e => update(i,{ ...m, program: Number(e.target.value) })}/></label> : m.kind === "control" ? <>
        <label>Controller<input type="number" min="0" max="127" required value={m.controller} onChange={e => update(i,{ ...m, controller: Number(e.target.value) })}/></label>
        <label>Value<input type="number" min="0" max="127" required value={m.value} onChange={e => update(i,{ ...m, value: Number(e.target.value) })}/></label>
      </> : <>
        <label>Note<input type="number" min="0" max="127" required value={m.note} onChange={e => update(i,{ ...m, note: Number(e.target.value) })}/></label>
        <label>Velocity<input type="number" min="0" max="127" required value={m.velocity} onChange={e => update(i,{ ...m, velocity: Number(e.target.value) })}/></label>
      </>}
      <IconButton label={"Remove event " + (i + 1)} onClick={() => change(events.filter((_,j) => j !== i))}><X size={16}/></IconButton>
    </div>)}
    <button type="button" disabled={events.length >= 64} onClick={() => change([...events, message("program", 1)])}><Plus size={16}/>MIDI event</button>
  </details>;
}
