import { useEffect, useRef, useState } from "react";
import { AudioLines } from "lucide-react";
import { IconButton } from "./components";

export function Metronome({ tempo, beats, onError }: { tempo: number; beats: number; onError: (message: string) => void }) {
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(0);
  const context = useRef<AudioContext | null>(null);
  const bpm = Math.min(300, Math.max(25, tempo || 100));
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

  useEffect(() => () => { void context.current?.close(); context.current = null; }, []);

  async function toggle() {
    try {
      if (playing) { setPlaying(false); setBeat(0); return; }
      context.current ??= new AudioContext();
      await context.current.resume();
      setPlaying(true);
    } catch {
      onError("Audio output is unavailable");
    }
  }

  return <div className="metro" data-playing={playing}>
    <IconButton label={playing ? "Stop metronome" : "Start metronome"} aria-pressed={playing} onClick={() => void toggle()}><AudioLines size={17}/></IconButton>
    <span aria-hidden="true">{playing ? beat + " / " + meter : bpm + " BPM"}</span>
  </div>;
}
