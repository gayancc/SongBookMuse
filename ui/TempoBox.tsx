import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X } from "lucide-react";
import { IconButton } from "./components";
import { TAP_MIN, TEMPO_MAX, TEMPO_MIN } from "./model";

/** Most recent taps sent to the Rust tempo calculation; it averages at most the last eight gaps. */
const TAP_HISTORY = 16;

interface TempoBoxProps {
  bpm: number;
  /** Song tempo as saved, so the box can tell whether there is anything to save. */
  saved: number;
  canSave: boolean;
  onChange: (bpm: number) => void;
  onSave: (bpm: number) => void;
  onClose: () => void;
}

/** Metronome tempo box: tap at least four times, nudge with +/- and optionally save to the song. */
export function TempoBox({ bpm, saved, canSave, onChange, onSave, onClose }: TempoBoxProps) {
  const taps = useRef<number[]>([]);
  const [count, setCount] = useState(0);
  const pad = useRef<HTMLButtonElement>(null);

  useEffect(() => { pad.current?.focus(); }, []);

  // Escape closes the box first wherever focus is, e.g. after Save disables the focused button.
  useEffect(() => {
    const close = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", close, true);
    return () => window.removeEventListener("keydown", close, true);
  }, [onClose]);

  function tap() {
    const now = performance.now();
    const last = taps.current.at(-1);
    taps.current = last !== undefined && now - last > 2000 ? [now] : [...taps.current, now].slice(-TAP_HISTORY);
    setCount(taps.current.length);
    void invoke<number | null>("tap_tempo", { taps: taps.current })
      .then(value => { if (value) onChange(value); }, () => {});
  }

  function keyTap(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (!event.repeat) tap();
  }

  const nudge = (delta: number) => onChange(Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, bpm + delta)));
  const hint = count === 0 ? "Tap " + TAP_MIN + " or more times"
    : count < TAP_MIN ? "Keep tapping (" + count + "/" + TAP_MIN + ")" : "Tapped " + count + " beats";

  return <div className="tempo-box" role="dialog" aria-label="Tempo">
    <header><span>Tempo</span><IconButton label="Close tempo" onClick={onClose}><X size={14}/></IconButton></header>
    <button ref={pad} type="button" className="tap-pad" aria-label="Tap tempo" onPointerDown={tap} onKeyDown={keyTap}>
      <output aria-live="polite" aria-label="Tempo in BPM">{bpm}</output><small>BPM</small>
    </button>
    <p className="tap-hint">{hint}</p>
    <div className="tempo-nudge">
      <button type="button" aria-label="Tempo down" disabled={bpm <= TEMPO_MIN} onClick={() => nudge(-1)}>−</button>
      <button type="button" aria-label="Tempo up" disabled={bpm >= TEMPO_MAX} onClick={() => nudge(1)}>+</button>
      <button type="button" className="primary" disabled={!canSave || bpm === saved} onClick={() => onSave(bpm)}>Save to song</button>
    </div>
  </div>;
}
