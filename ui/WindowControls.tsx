import { useEffect, useState, type MouseEvent } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** Desktop builds draw their own chrome; Android and plain browsers keep the system's. */
export const ownsWindowChrome = isTauri() && !/Android/i.test(navigator.userAgent);

const INTERACTIVE = "button, a, input, select, textarea, label, summary, [role='slider'], [role='button'], [role='status']";

/** Drags the window from empty space in the top bar; a double-click there maximizes or restores it. */
export function dragWindow(event: MouseEvent<HTMLElement>): void {
  if (!ownsWindowChrome || event.button !== 0) return;
  if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
  const win = getCurrentWindow();
  void (event.detail === 2 ? win.toggleMaximize() : win.startDragging()).catch(() => {});
}

/** Minimize, maximize/restore and close, drawn as the top bar's last group. */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    if (!ownsWindowChrome) return;
    const win = getCurrentWindow();
    const sync = () => void win.isMaximized().then(setMaximized).catch(() => {});
    sync();
    const unlisten = win.onResized(sync);
    return () => { void unlisten.then(stop => stop()); };
  }, []);
  if (!ownsWindowChrome) return null;
  const win = getCurrentWindow();
  const run = (task: () => Promise<void>) => () => void task().catch(() => {});
  return <div className="window-controls" role="group" aria-label="Window">
    <button type="button" className="window-button" aria-label="Minimize" title="Minimize" onClick={run(() => win.minimize())}>
      <svg viewBox="0 0 10 10" aria-hidden="true"><rect x="2" y="7" width="6" height="1.6"/></svg>
    </button>
    <button type="button" className="window-button" aria-label={maximized ? "Restore" : "Maximize"} title={maximized ? "Restore" : "Maximize"}
      onClick={run(() => win.toggleMaximize())}>
      {maximized
        ? <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M3.5 1.5h5v5h-1.2v-3.8H3.5z"/><path fillRule="evenodd" d="M1.5 3.5h5v5h-5zm1.2 1.2v2.6h2.6V4.7z"/></svg>
        : <svg viewBox="0 0 10 10" aria-hidden="true"><path fillRule="evenodd" d="M1.5 1.5h7v7h-7zm1.2 1.8v4h4.6v-4z"/></svg>}
    </button>
    <button type="button" className="window-button window-close" aria-label="Close" title="Close" onClick={run(() => win.close())}>
      <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.3 1.3l7.4 7.4M8.7 1.3l-7.4 7.4" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>
    </button>
  </div>;
}
