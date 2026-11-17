import { useEffect, useRef, useState } from "react";
import { AudioLines, Gauge } from "lucide-react";
import { IconButton } from "./components";
import { TEMPO_MAX, TEMPO_MIN, type MetronomeTimeout } from "./model";
import { TempoBox } from "./TempoBox";

/** Auto-stop window from the reference Live Buttons setting. */
const TIMEOUT_MS = 10_000;
const LONG_PRESS_MS = 550;

interface MetronomeProps {
  /** Effective tempo: a tapped draft or the song tempo; 0 when unknown. */
  tempo: number;
  savedTempo: number;
  beats: number;
  /** Changes when another song or set entry opens. */
  songKey: string;
  timeout: MetronomeTimeout;
  canSave: boolean;
  onTempo: (bpm: number) => void;
  onSave: (bpm: number) => void;
  onError: (message: string) => void;
}

export function Metronome({ tempo, savedTempo, beats, songKey, timeout, canSave, onTempo, onSave, onError }: MetronomeProps) {
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(0);
  const [boxOpen, setBoxOpen] = useState(false);
  /** Bumped on each start so the auto-stop window restarts. */
  const [run, setRun] = useState(0);
  const context = useRef<AudioContext | null>(null);
  const armed = useRef(false);
  const press = useRef<number | undefined>(undefined);
  /** Set when a touch long-press opened the box, so the click that follows does not toggle. */
  const longPressed = useRef(false);
  const bpm = Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, tempo || 100));
  const meter = Number.isFinite(beats) && beats >= 1 && beats <= 16 ? beats : 4;

  useEffect(() => {
    const audio = context.current;
    if (!playing || !audio) return;
    let next = audio.currentTime + 0.05;
    let index = 0;
    const timers = new Set<number>();
    const voices = new Set<OscillatorNode>();
    const interval = window.setInterval(() => {
      if (next < audio.currentTime) next = audio.currentTime + 0.02;
      while (next < audio.currentTime + 0.1) {
        const sound = audio.createOscillator();
        const gain = audio.createGain();
        sound.frequency.value = index === 0 ? 1250 : 820;
        gain.gain.setValueAtTime(0.25, next);
        gain.gain.exponentialRampToValueAtTime(0.001, next + 0.05);
        sound.connect(gain).connect(audio.destination);
        voices.add(sound);
        sound.onended = () => { voices.delete(sound); sound.disconnect(); gain.disconnect(); };
        sound.start(next);
        sound.stop(next + 0.06);
        const display = index;
        const timer = window.setTimeout(() => { setBeat(display + 1); timers.delete(timer); }, (next - audio.currentTime) * 1000);
        timers.add(timer);
        index = (index + 1) % meter;
        next += 60 / bpm;
      }
    }, 25);
    return () => { window.clearInterval(interval); timers.forEach(clearTimeout); voices.forEach(v => v.stop()); };
  }, [playing, bpm, meter]);

  useEffect(() => {
    if (!playing || timeout === "never") return;
    const timer = window.setTimeout(() => { setPlaying(false); setBeat(0); }, TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [playing, timeout, run]);

  // "After 10s, resumes after changing song": a metronome used earlier runs again for 10s.
  const firstSong = useRef(true);
  useEffect(() => {
    if (firstSong.current) { firstSong.current = false; return; }
    setBoxOpen(false);
    if (timeout === "10s_resume" && armed.current) void start();
  }, [songKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { void context.current?.close(); context.current = null; }, []);

  async function start() {
    try {
      context.current ??= new AudioContext();
      await context.current.resume();
      armed.current = true;
      setRun(r => r + 1);
      setPlaying(true);
    } catch {
      onError("Audio output is unavailable");
    }
  }

  function toggle() {
    if (playing) { setPlaying(false); setBeat(0); return; }
    // The reference opens the tempo box when the song has no tempo yet.
    if (!tempo) setBoxOpen(true);
    void start();
  }

  function pressStart() {
    window.clearTimeout(press.current);
    longPressed.current = false;
    press.current = window.setTimeout(() => { longPressed.current = true; setBoxOpen(true); }, LONG_PRESS_MS);
  }

  function pressEnd() {
    window.clearTimeout(press.current);
  }

  function click() {
    if (longPressed.current) { longPressed.current = false; return; }
    toggle();
  }

  return <div className="metro" data-playing={playing}>
    <IconButton label={playing ? "Stop metronome" : "Start metronome"} aria-pressed={playing} onClick={click}
      onPointerDown={e => { if (e.pointerType !== "mouse") pressStart(); }} onPointerUp={pressEnd} onPointerLeave={pressEnd}
      onContextMenu={e => { e.preventDefault(); pressEnd(); setBoxOpen(true); }}><AudioLines size={16}/></IconButton>
    <IconButton label="Set tempo" aria-expanded={boxOpen} onClick={() => setBoxOpen(open => !open)}><Gauge size={14}/></IconButton>
    <span className="beat-leds" aria-hidden="true">
      {Array.from({ length: meter }, (_, i) => <i key={i} data-on={playing && beat === i + 1} data-down={i === 0}/>)}
    </span>
    {boxOpen && <TempoBox bpm={bpm} saved={savedTempo} canSave={canSave} onChange={onTempo} onSave={onSave} onClose={() => setBoxOpen(false)}/>}
  </div>;
}
