import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Pitch { note: string; octave: number; frequency: number; cents: number; }

export function Tuner() {
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const live = useRef<{ context: AudioContext; stream: MediaStream; timer?: number } | null>(null);
  const disposed = useRef(false);

  function stop() {
    const current = live.current;
    live.current = null;
    if (!current) return;
    if (current.timer !== undefined) window.clearInterval(current.timer);
    current.stream.getTracks().forEach(track => track.stop());
    void current.context.close().catch(() => {});
  }

  useEffect(() => () => { disposed.current = true; stop(); }, []);

  async function start() {
    if (starting || live.current) return;
    setStarting(true);
    setError("");
    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone input is unavailable in this webview");
      context = new AudioContext();
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (disposed.current) {
        stream.getTracks().forEach(track => track.stop());
        await context.close();
        return;
      }
      await context.resume();
      if (disposed.current) {
        stream.getTracks().forEach(track => track.stop());
        await context.close();
        return;
      }
      const analyser = context.createAnalyser();
      analyser.fftSize = 4096;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(4096);
      const rate = context.sampleRate;
      let pending = false;
      const session = { context, stream, timer: undefined as number | undefined };
      live.current = session;
      session.timer = window.setInterval(() => {
        if (pending) return;
        analyser.getFloatTimeDomainData(samples);
        pending = true;
        void invoke<Pitch | null>("detect_pitch", { frame: Array.from(samples), rate }).then(value => {
          if (live.current === session) setPitch(value);
        }).catch(cause => {
          if (live.current !== session) return;
          stop();
          setEnabled(false);
          setError(String(cause));
        }).finally(() => { pending = false; });
      }, 120);
      setEnabled(true);
    } catch (cause) {
      stream?.getTracks().forEach(track => track.stop());
      if (context) void context.close().catch(() => {});
      if (!disposed.current) setError(String(cause));
    } finally { if (!disposed.current) setStarting(false); }
  }

  return <div className="tuner">
    <output aria-live="off" className="tuner-note">{pitch ? pitch.note + pitch.octave : "—"}</output>
    <meter aria-label="Tuning offset in cents" min={-50} max={50} low={-8} high={8} optimum={0} value={pitch?.cents ?? 0}/>
    <p aria-live="off">{pitch ? pitch.frequency.toFixed(1) + " Hz · " + (pitch.cents > 0 ? "+" : "") + pitch.cents.toFixed(1) + "¢" : enabled ? "Play one note" : "440 Hz reference"}</p>
    {error && <p role="alert" className="dialog-error">{error}</p>}
    <button className="primary" disabled={starting} onClick={() => {
      if (enabled) { stop(); setEnabled(false); setPitch(null); }
      else void start();
    }}>{enabled ? "Stop listening" : starting ? "Opening microphone…" : "Start listening"}</button>
  </div>;
}
