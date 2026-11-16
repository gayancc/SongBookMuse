import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";

export interface AutoScroll {
  running: boolean;
  /** Seconds the remaining sheet should take to scroll. */
  seconds: number;
  toggle: () => void;
  stop: () => void;
  adjust: (factor: number) => void;
}

const fallbackSeconds = 180;

/**
 * Scrolls `target` from its current position to the bottom over the song duration, after a delay.
 * Reference evidence: SongBook Pro exposes "Auto Scroll", "Auto-Scroll Duration" and "Auto-scroll delay".
 */
export function useAutoScroll(target: RefObject<HTMLElement | null>, duration: number, delay: number, resetKey: string): AutoScroll {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(duration > 0 ? duration : fallbackSeconds);
  const position = useRef(0);

  useEffect(() => {
    setRunning(false);
    setSeconds(duration > 0 ? duration : fallbackSeconds);
  }, [duration, resetKey]);

  useEffect(() => {
    const view = target.current;
    if (!running || !view) return;
    let frame = 0;
    let previous = 0;
    const startAt = performance.now() + Math.max(0, delay) * 1000;
    const duration = Math.max(5, seconds - delay);
    position.current = view.scrollTop;
    const step = (now: number) => {
      if (now >= startAt) {
        const elapsed = previous ? (now - previous) / 1000 : 0;
        // Respect manual scrolling: continue from wherever the performer left the sheet.
        if (Math.abs(view.scrollTop - position.current) > 2) position.current = view.scrollTop;
        // Recompute each frame so zoom or column changes mid-song keep the overall timing.
        const speed = Math.max(1, view.scrollHeight - view.clientHeight) / duration;
        position.current += speed * elapsed;
        view.scrollTop = position.current;
        previous = now;
        if (view.scrollTop + view.clientHeight >= view.scrollHeight - 1) { setRunning(false); return; }
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [running, seconds, delay, target]);

  const toggle = useCallback(() => setRunning(value => !value), []);
  const stop = useCallback(() => setRunning(false), []);
  const adjust = useCallback((factor: number) => {
    setSeconds(value => Math.round(Math.min(1800, Math.max(15, value * factor))));
  }, []);
  return useMemo(() => ({ running, seconds, toggle, stop, adjust }), [running, seconds, toggle, stop, adjust]);
}
