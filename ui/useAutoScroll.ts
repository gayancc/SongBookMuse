import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";

export interface AutoScroll {
  running: boolean;
  waiting: boolean;
  /** Seconds to scroll from the top to the bottom of the sheet. */
  seconds: number;
  toggle: () => void;
  stop: () => void;
}

type ScrollState = "idle" | "waiting" | "scrolling";

export function useAutoScroll(target: RefObject<HTMLElement | null>, seconds: number, delay: number, resetKey: string): AutoScroll {
  const [state, setState] = useState<ScrollState>("idle");

  useEffect(() => setState("idle"), [resetKey]);

  useEffect(() => {
    if (state !== "waiting") return;
    const timer = window.setTimeout(() => setState("scrolling"), delay * 1000);
    return () => window.clearTimeout(timer);
  }, [state, delay]);

  useEffect(() => {
    const view = target.current;
    if (state !== "scrolling" || !view) return;
    let frame = 0;
    let previous = performance.now();
    let position = view.scrollTop;
    const step = (now: number) => {
      // Recalculate the distance for layout changes and continue from any manual scroll position.
      if (Math.abs(view.scrollTop - position) > 2) position = view.scrollTop;
      const distance = Math.max(0, view.scrollHeight - view.clientHeight);
      position += (distance / seconds) * (Math.max(0, now - previous) / 1000);
      view.scrollTop = position;
      previous = now;
      if (view.scrollTop >= distance - 1) {
        setState("idle");
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [state, seconds, target]);

  const toggle = useCallback(() => setState(current => {
    if (current === "scrolling") return "idle";
    if (current === "waiting" || delay === 0) return "scrolling";
    return "waiting";
  }), [delay]);
  const stop = useCallback(() => setState("idle"), []);
  return useMemo(() => ({ running: state !== "idle", waiting: state === "waiting", seconds, toggle, stop }),
    [state, seconds, toggle, stop]);
}
