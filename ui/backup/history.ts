import { useCallback, useState } from "react";

const KEY = "last-backup-export";
const DAY = 24 * 60 * 60 * 1000;

/** Library counts used to compare the current library with a backup. */
export interface LibraryStats {
  songs: number;
  archived: number;
  documents: number;
  sets: number;
  entries: number;
  folders: number;
}

export type BackupHealth = "ok" | "stale" | "none";

function read(): number | null {
  try {
    const value = Number(localStorage.getItem(KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * When this device last exported a backup. Stored per device on purpose: it describes this
 * machine's habit, and a missing value only means "unknown", never that the library is unsafe.
 */
export function useLastExport() {
  const [at, setAt] = useState<number | null>(read);
  const record = useCallback(() => {
    const now = Date.now();
    try { localStorage.setItem(KEY, String(now)); } catch { /* the export itself still succeeded */ }
    setAt(now);
  }, []);
  return { at, record };
}

export function backupHealth(at: number | null, now = Date.now()): BackupHealth {
  if (at === null) return "none";
  return now - at <= 7 * DAY ? "ok" : "stale";
}

export function ago(at: number, now = Date.now()) {
  const minutes = Math.round((now - at) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes + (minutes === 1 ? " minute ago" : " minutes ago");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");
  const days = Math.round(hours / 24);
  return days + (days === 1 ? " day ago" : " days ago");
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

/** File name for a dated backup, e.g. "SongBookMuse 2026-11-17.musebackup". */
export function backupName(prefix = "SongBookMuse", date = new Date()) {
  const day = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  return prefix + " " + day + ".musebackup";
}
