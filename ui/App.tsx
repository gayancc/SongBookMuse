import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WindowControls, dragWindow } from "./WindowControls";
import {
  BookOpen, ChevronLeft, Columns2, Download, Maximize2, Ellipsis, Eye, FolderUp, Guitar, ListMusic, Minimize, Music2, Pencil, Play,
  Printer, Radio, ScrollText, Settings2, SkipBack, SkipForward, SlidersHorizontal, Square, Star, StickyNote, Trash2, X
} from "lucide-react";
import { BackingTrack } from "./BackingTrack";
import { Browser, type LibraryFilter } from "./Browser";
import { Chart, FitChart, type FitLayout } from "./Chart";
import { ChordStrip, useDiagrams, useSongChords } from "./ChordDiagram";
import { decode, encode, exportFile, safeName } from "./commands";
import { DialogError, IconButton, Modal } from "./components";
import { DocumentView, type InkTool } from "./DocumentView";
import { Inspector } from "./Inspector";
import { Metronome } from "./Metronome";
import { useLastExport, backupName, type LibraryStats } from "./backup/history";
import { LibraryPanel } from "./backup/LibraryPanel";
import { RestoreWizard, type RestoreMode, type RestoreResult } from "./backup/RestoreWizard";
import { SettingsWindow } from "./settings/SettingsWindow";
import {
  blankSong, defaultSettings, duration, nil, nilEntry, noteEntry, notationOptions,
  type Folder, type NavigationAction, type Preview, type RenderOptions, type SetEntry, type Settings, type Setlist, type Song, type SongSummary, type Stroke
} from "./model";
import { pedalKey } from "./PedalSettings";
import { Prompt } from "./Prompt";
import { SetEditor } from "./SetEditor";
import { SongEditor } from "./SongEditor";
import { Tuner } from "./Tuner";
import { useAutoScroll } from "./useAutoScroll";

type Dialog = "settings" | "backup" | "delete-song" | "delete-set" | "delete-folder" | "add-to-set" | "tuner" | null;
type PromptState = { kind: "new-folder" } | { kind: "rename-folder"; folder: Folder } | { kind: "note"; entry: SetEntry | null } | null;
const songTypes = ".txt,.pro,.cho,.chordpro,.chopro,.crd,.chords,.cpro,.pdf,.png,.jpg,.jpeg,.webp";
const blankSet = (): Setlist => ({ id: nil, title: "", date: "", pinned: false, entries: [] });
const textEntry = (target: EventTarget | null): boolean => target instanceof Element &&
  Boolean(target.closest("input, textarea, select, [contenteditable], dialog"));
/** Widgets that own arrow and paging keys natively. */
const keyWidget = (target: EventTarget | null): boolean => target instanceof Element &&
  Boolean(target.closest("[role=slider], [role=tab], [role=radio], [role=radiogroup], [role=listbox], [role=menu], [role=menuitem]"));

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const pad = (n: number): string => String(n).padStart(2, "0");
const emptyRender: RenderOptions = { shift: 0, flats: false, key: "", nashville: false, key_spelling: true, section_order: "", naming: "letter" };

export function App() {
  const [catalog, setCatalog] = useState<SongSummary[]>([]);
  const [matches, setMatches] = useState<SongSummary[] | null>(null);
  const [sets, setSets] = useState<Setlist[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [song, setSong] = useState<Song | null>(null);
  const [setId, setSetId] = useState<string | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>({ kind: "all" });
  const [sort, setSort] = useState("title");
  const [mode, setMode] = useState<"songs" | "sets">("songs");
  const [surface, setSurface] = useState<"library" | "song">("library");
  const [inspector, setInspector] = useState(false);
  const [perform, setPerform] = useState(false);
  const [lyricsOnly, setLyricsOnly] = useState(false);
  const [settings, setSettings] = useState(defaultSettings);
  const [editing, setEditing] = useState<Song | null>(null);
  const [editingSet, setEditingSet] = useState<Setlist | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [prompt, setPrompt] = useState<PromptState>(null);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [displayKey, setDisplayKey] = useState("");
  const [tool, setTool] = useState<InkTool>("none");
  const [brush, setBrush] = useState("#e8453c");
  const [width, setWidth] = useState(0.004);
  const [redo, setRedo] = useState<Stroke[]>([]);
  const [sectionLabels, setSectionLabels] = useState<string[]>([]);
  const [fitInfo, setFitInfo] = useState<FitLayout | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [backupFile, setBackupFile] = useState<{ name: string; size: number } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const lastExport = useLastExport();
  const [busy, setBusy] = useState(false);
  const [savingScrollTime, setSavingScrollTime] = useState(false);
  const [savingSectionOrder, setSavingSectionOrder] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [menu, setMenu] = useState(false);
  const [printSet, setPrintSet] = useState(false);
  const files = useRef<HTMLInputElement>(null);
  const backup = useRef<HTMLInputElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const selection = useRef(0);
  const touch = useRef<[number, number] | null>(null);

  const currentSet = sets.find(s => s.id === setId);
  const entry = currentSet?.entries.find(e => e.id === entryId);
  const noteItem = entry?.note != null ? entry : null;
  const shift = entry?.transpose ?? song?.transpose ?? 0;
  const capo = entry?.capo ?? song?.capo ?? 0;
  const locked = Boolean(song?.locked);
  const scrollDuration = song?.duration || settings.autoscroll_duration;
  // A tapped tempo plays and shows on the LCD for its song until saved or another song opens.
  const [tempoDraft, setTempoDraft] = useState<{ song: string; bpm: number } | null>(null);
  const tempo = tempoDraft && tempoDraft.song === song?.id ? tempoDraft.bpm : song?.tempo ?? 0;
  const autoScroll = useAutoScroll(scroll, scrollDuration, settings.autoscroll_delay, (song?.id ?? "") + ":" + (entryId ?? ""));
  const autoScrollLabel = autoScroll.waiting ? "Start auto-scroll now" : autoScroll.running ? "Stop auto-scroll" : "Start auto-scroll";

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const report = useCallback((cause: unknown) => setError(String(cause)), []);
  const action = useCallback(async (task: () => Promise<void>) => {
    setError("");
    try { await task(); } catch (cause) { report(cause); }
  }, [report]);
  const refresh = useCallback(async () => {
    const [all, lists, groups] = await Promise.all([
      invoke<SongSummary[]>("songs", { query: "" }), invoke<Setlist[]>("sets"), invoke<Folder[]>("folders")]);
    setCatalog(all);
    setSets(lists);
    setFolders(groups);
  }, []);
  const resetView = useCallback(() => {
    setPage(1); setPageCount(1); setTool("none"); setRedo([]);
    scroll.current?.scrollTo(0, 0);
  }, []);
  const changeSong = useCallback(async (id: string, list: string | null = null, position: string | null = null) => {
    const request = ++selection.current;
    const next = await invoke<Song>("song", { id });
    if (request !== selection.current) return;
    setSong(next); setSetId(list); setEntryId(position); setSurface("song");
    resetView();
    if (next.midi.length) void invoke("midi_open_song", { id }).catch(report);
  }, [report, resetView]);
  const openEntry = useCallback((set: Setlist, item: SetEntry) => {
    if (item.note != null) {
      ++selection.current;
      setSong(null); setSetId(set.id); setEntryId(item.id); setSurface("song");
      resetView();
    } else void action(() => changeSong(item.song_id, set.id, item.id));
  }, [action, changeSong, resetView]);

  useEffect(() => {
    void action(async () => {
      await refresh();
      setSettings({ ...defaultSettings, ...await invoke<Settings>("settings") });
      setLoaded(true);
    }).finally(() => {
      // The main window stays hidden behind the splash until the first load settles (errors included).
      void invoke("app_ready").catch(() => {});
    });
  }, [action, refresh]);

  useEffect(() => {
    let obsolete = false;
    if (mode !== "songs" || !search.trim()) { setMatches(null); return; }
    const timer = window.setTimeout(() => {
      void invoke<SongSummary[]>("songs", { query: search }).then(data => { if (!obsolete) setMatches(data); },
        cause => { if (!obsolete) report(cause); });
    }, 120);
    return () => { obsolete = true; window.clearTimeout(timer); };
  }, [search, catalog, mode, report]);

  useEffect(() => {
    let obsolete = false;
    if (!song?.key) { setDisplayKey(""); return; }
    void invoke<string>("transpose", { chord: song.key, shift, flats: settings.flats, keySpelling: settings.key_spelling })
      .then(value => { if (!obsolete) setDisplayKey(value); }, report);
    return () => { obsolete = true; };
  }, [song?.key, shift, settings.flats, settings.key_spelling, report]);

  useEffect(() => {
    let obsolete = false;
    const source = song?.source;
    if (source == null || song?.document) { setSectionLabels([]); return; }
    void invoke<string[]>("section_labels", { source })
      .then(labels => { if (!obsolete) setSectionLabels(labels); }, report);
    return () => { obsolete = true; };
  }, [song?.source, song?.document, report]);

  useEffect(() => {
    if (!perform || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    let disposed = false;
    async function acquire() {
      if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        const grant = await navigator.wakeLock.request("screen");
        if (disposed) void grant.release(); else lock = grant;
      } catch { /* Some webviews do not expose a screen wake lock. */ }
    }
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => { disposed = true; document.removeEventListener("visibilitychange", acquire); if (lock) void lock.release(); };
  }, [perform]);

  const index = currentSet?.entries.findIndex(e => e.id === entryId) ?? -1;
  const navigate = useCallback((step: number) => {
    if (!currentSet || index < 0) return;
    const next = currentSet.entries[index + step];
    if (next) openEntry(currentSet, next);
  }, [currentSet, index, openEntry]);

  const togglePerformance = useCallback(() => {
    const next = !perform;
    setPerform(next); setInspector(false); setTool("none");
    if (!next) autoScroll.stop();
    void getCurrentWindow().setFullscreen(next).catch(() => {});
  }, [perform, autoScroll]);

  const stepPage = useCallback((step: number) => {
    if (song?.document?.mime === "application/pdf") {
      setPage(current => Math.max(1, Math.min(pageCount, current + step)));
      return;
    }
    const view = scroll.current;
    // Fit pages are exactly one screen tall, so a page turn moves a whole page.
    if (view) view.scrollBy({ top: step * view.clientHeight * (view.dataset.fit === "true" ? 1 : .9) });
  }, [song?.document?.mime, pageCount]);

  const runNavigationAction = useCallback((command: NavigationAction) => {
    if (command === "next_song" || command === "previous_song") navigate(command === "next_song" ? 1 : -1);
    else if (command === "page_up" || command === "page_down") stepPage(command === "page_up" ? -1 : 1);
  }, [navigate, stepPage]);

  useEffect(() => {
    let disposed = false;
    const listener = listen<NavigationAction>("midi-action", ({ payload }) => {
      if (disposed || document.querySelector("dialog[open]")) return;
      runNavigationAction(payload);
    });
    return () => { disposed = true; void listener.then(stop => stop()).catch(() => {}); };
  }, [runNavigationAction]);

  useEffect(() => {
    function handle(event: KeyboardEvent) {
      // Buttons keep focus after a click; only Space/Enter belong to them, so other keys still drive the sheet.
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || textEntry(event.target) ||
          keyWidget(event.target) || document.querySelector("dialog[open]")) return;
      const onButton = event.target instanceof Element && Boolean(event.target.closest("button"));
      const key = pedalKey(event);
      if (key !== null && Object.hasOwn(settings.keyboard_pedals, key) && !(onButton && (key === " " || key === "Enter"))) {
        event.preventDefault();
        if (!event.repeat) runNavigationAction(settings.keyboard_pedals[key]);
        return;
      }
      if (event.key === "Escape" && perform) togglePerformance();
      else if (event.key === "ArrowLeft" || event.key === "ArrowRight") navigate(event.key === "ArrowLeft" ? -1 : 1);
      else if ((event.key === "PageUp" || event.key === "PageDown" || (event.key === " " && !onButton)) && (song || noteItem)) {
        event.preventDefault();
        stepPage(event.key === "PageUp" || event.shiftKey ? -1 : 1);
      } else if (event.key.toLowerCase() === "a" && !event.repeat && song && !song.document) autoScroll.toggle();
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [navigate, perform, song, noteItem, stepPage, togglePerformance, autoScroll, settings.keyboard_pedals, runNavigationAction]);

  const lookup = useMemo(() => new Map(catalog.map(item => [item.id, item])), [catalog]);
  const visible = useMemo(() => {
    const result = (matches ?? catalog).filter(s => !s.archived &&
      (filter.kind !== "favorites" || s.favorite) && (filter.kind !== "folder" || s.folders.includes(filter.id)));
    if (sort === "artist") result.sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
    if (sort === "number") result.sort((a, b) => (a.number || Infinity) - (b.number || Infinity) || a.title.localeCompare(b.title));
    if (sort === "key") result.sort((a, b) => a.key.localeCompare(b.key) || a.title.localeCompare(b.title));
    return result;
  }, [matches, catalog, filter, sort]);

  async function saveSong(next: Song, select: boolean) {
    const current = selection.current;
    const saved = await invoke<SongSummary>("save_song", { song: next });
    await refresh();
    if (select) await changeSong(saved.id, next.id === nil ? null : setId, next.id === nil ? null : entryId);
    else if (current === selection.current) setSong({ ...next, id: saved.id });
  }

  async function writeSet(next: Setlist) {
    const saved = await invoke<Setlist>("save_set", { set: next });
    await refresh();
    return saved;
  }

  async function modifyPitch(property: "transpose" | "capo", value: number) {
    if (!song) return;
    if (entry && currentSet) {
      await writeSet({ ...currentSet, entries: currentSet.entries.map(e => e.id === entry.id ? { ...e, [property]: value } : e) });
    } else await saveSong({ ...song, [property]: value }, false);
  }

  async function changeSectionOrder(order: string | null) {
    if (!song || song.locked) return;
    if (!entry || !currentSet) {
      await saveSong({ ...song, section_order: order ?? "" }, false);
      return;
    }
    setSavingSectionOrder(true);
    try {
      await writeSet({ ...currentSet, entries: currentSet.entries.map(item =>
        item.id === entry.id ? { ...item, section_order: order } : item) });
    } finally {
      setSavingSectionOrder(false);
    }
  }

  function move(position: number, direction: number) {
    if (!currentSet) return;
    const entries = [...currentSet.entries];
    const other = position + direction;
    if (position < 0 || position >= entries.length || other < 0 || other >= entries.length || other === position) return;
    const [item] = entries.splice(position, 1);
    entries.splice(other, 0, item);
    void action(async () => { await writeSet({ ...currentSet, entries }); });
  }

  async function importFiles(selected: File[]) {
    if (!selected.length) return;
    if (selected.length > 200 || selected.some(f => f.size > 24 * 1024 * 1024) ||
        selected.reduce((sum, f) => sum + f.size, 0) > 64 * 1024 * 1024) {
      throw new Error("Import supports up to 200 files, 24 MiB per file and 64 MiB per batch");
    }
    setBusy(true);
    try {
      const payload = await Promise.all(selected.map(async f => ({ name: f.name, data: await encode(f) })));
      const added = await invoke<number>("import_files", { files: payload });
      await refresh();
      // Show the result: a folder or favorites filter would otherwise hide the new songs.
      setMode("songs"); setSearch(""); setFilter({ kind: "all" });
      setNotice(added + " added · " + (selected.length - added) + " duplicates skipped");
    } finally { setBusy(false); }
  }

  function onImport(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    void action(() => importFiles(selected));
  }

  async function onPreview(file: File) {
    if (file.size > 64 * 1024 * 1024) throw new Error("Backup exceeds 64 MiB");
    setPreview(await invoke<Preview>("preview_backup", { data: await encode(file) }));
    setBackupFile({ name: file.name, size: file.size });
    setDialog("backup");
  }

  /** Saves a native backup; resolves false when the save dialog is cancelled. */
  async function exportBackup(name: string) {
    const saved = await invoke<boolean>("save_backup", { name });
    if (saved) lastExport.record();
    return saved;
  }

  async function restore(mode: RestoreMode): Promise<RestoreResult> {
    if (!preview) throw new Error("Preview this backup again");
    const result = await invoke<RestoreResult>("restore_backup", { token: preview.token, mode });
    if (mode === "replace") {
      ++selection.current;
      setSong(null); setSetId(null); setEntryId(null); setSurface("library"); setFilter({ kind: "all" });
      setSettings({ ...defaultSettings, ...await invoke<Settings>("settings") });
    }
    await refresh();
    setNotice(result.songs + " added · " + result.reused + " reused · " + result.sets + " setlists restored");
    return result;
  }

  async function changeSettings(next: Settings) {
    setSettings(next);
    await invoke("save_settings", { settings: next });
  }

  function changeInk(ink: Stroke[]) {
    if (song && !song.locked) void action(() => saveSong({ ...song, ink }, false));
  }

  async function changeScrollTime(seconds: number) {
    if (!song || locked) return;
    setSavingScrollTime(true);
    try {
      await saveSong({ ...song, duration: seconds }, false);
    } finally {
      setSavingScrollTime(false);
    }
  }

  async function exportCurrent() {
    if (!song) return;
    if (song.document) {
      const ext = ({ "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as Record<string, string>)[song.document.mime];
      await exportFile(safeName(song.title) + "." + ext, new Blob([decode(song.document.bytes)], { type: song.document.mime }));
      return;
    }
    const fields = { title: song.title, artist: song.artist, subtitle: song.subtitle, key: song.key,
      tempo: song.tempo || "", duration: song.duration ? duration(song.duration) : "", capo: song.capo || "",
      time: song.time_signature, copyright: song.copyright };
    const clean = (s: string | number) => String(s).replace(/[\r\n{}]/g, " ");
    const header = Object.entries(fields).filter(([, value]) => value).map(([key, value]) => "{" + key + ": " + clean(value) + "}");
    const known = /^\s*\{\s*(t|title|artist|st|subtitle|k|key|tempo|duration|capo|time|copyright)\s*:/i;
    const body = song.source.split(/\r?\n/).filter(line => !known.test(line)).join("\n");
    await exportFile(safeName(song.title) + ".cho", new Blob([header.join("\n"), "\n", body], { type: "text/plain" }));
  }

  function print(list: boolean) {
    setMenu(false);
    setPrintSet(list);
    window.setTimeout(() => { window.print(); setPrintSet(false); }, 100);
  }

  async function submitPrompt(value: string) {
    if (!prompt) return;
    if (prompt.kind === "new-folder") {
      const folder = await invoke<Folder>("save_folder", { folder: { id: nil, name: value } });
      await refresh();
      setFilter({ kind: "folder", id: folder.id });
    } else if (prompt.kind === "rename-folder") {
      await invoke<Folder>("save_folder", { folder: { ...prompt.folder, name: value } });
      await refresh();
    } else if (currentSet) {
      const target = prompt.entry;
      const entries = target
        ? currentSet.entries.map(e => e.id === target.id ? { ...e, note: value } : e)
        : [...currentSet.entries, noteEntry(value)];
      await writeSet({ ...currentSet, entries });
    }
    setPrompt(null);
  }

  const pdf = song?.document?.mime === "application/pdf";
  const canDraw = Boolean(song?.document) && !locked;
  const lcdTitle = noteItem ? "Note" : song?.title ?? (currentSet ? currentSet.title : "No song loaded");
  const position = index >= 0 && currentSet ? pad(index + 1) + "/" + pad(currentSet.entries.length) : "--/--";
  const fitMode = settings.layout === "fit" && Boolean(song) && !song?.document && !noteItem;
  const sectionOrder = entry?.section_order ?? song?.section_order ?? "";
  const renderOptions = song ? { shift: shift - capo, flats: settings.flats, key: song.key, ...notationOptions(settings.notation),
    key_spelling: settings.key_spelling, section_order: sectionOrder } : null;
  // Inline popovers are keyed by letter chord names, so other notations show the top strip instead.
  const diagramLocation = settings.diagram_location === "inline" && settings.notation !== "standard" ? "top" : settings.diagram_location;
  const showDiagrams = Boolean(song && !song.document) && !lyricsOnly && diagramLocation !== "off";
  const songChords = useSongChords(song?.source ?? "", renderOptions ?? emptyRender, showDiagrams);
  const diagrams = useDiagrams(songChords, settings.instrument, showDiagrams);
  const inlineDiagrams = showDiagrams && diagramLocation === "inline" ? { diagrams, leftHanded: settings.left_handed } : undefined;
  const sheetHeader = useMemo(() => song ? <header className="sheet-header">
    <h2>{song.number > 0 && <span className="song-number">{song.number}</span>}{song.title}</h2>
    {(song.artist || song.subtitle) && <p>{[song.artist, song.subtitle].filter(Boolean).join(" — ")}</p>}
  </header> : null, [song?.number, song?.title, song?.artist, song?.subtitle, song]);
  const chartHeader = useMemo(() => showDiagrams && diagramLocation === "top"
    ? <>{sheetHeader}<ChordStrip key={(song?.id ?? "") + settings.instrument} chords={songChords} diagrams={diagrams} leftHanded={settings.left_handed}/></>
    : sheetHeader, [showDiagrams, diagramLocation, sheetHeader, song?.id, songChords, diagrams, settings.instrument, settings.left_handed]);
  const sheetFooter = song && (song.copyright || song.notes) ? <>
    {song.copyright && <p className="copyright">{song.copyright}</p>}
    {song.notes && <aside className="song-notes"><h3>Notes</h3>{song.notes}</aside>}
  </> : null;
  const fitHint = fitMode && fitInfo ? "Fit to screen: " + fitInfo.columns + (fitInfo.columns === 1 ? " column" : " columns") + " · " +
    Math.round(fitInfo.scale * 100) + "% · " + fitInfo.pages.length + (fitInfo.pages.length === 1 ? " screen" : " screens") : "";

  const libraryStats: LibraryStats = {
    songs: catalog.filter(s => !s.archived).length,
    archived: catalog.filter(s => s.archived).length,
    documents: catalog.filter(s => s.kind !== "Chord sheet").length,
    sets: sets.length,
    entries: sets.reduce((total, set) => total + set.entries.length, 0),
    folders: folders.length,
  };

  return <DialogError.Provider value={error}><div className="app" data-theme={settings.theme} data-perform={perform} data-surface={surface}
    data-inspector={inspector && Boolean(song)} data-compact={settings.compact_sidebar}
    onMouseOver={e => {
      const labelled = (e.target as Element).closest?.("[aria-label],[title]");
      setHint(labelled?.getAttribute("title") ?? labelled?.getAttribute("aria-label") ?? "");
    }}>
    <input ref={files} type="file" accept={songTypes} multiple hidden onChange={onImport}/>
    <input ref={backup} type="file" accept=".sbpbackup,.musebackup,.zip" hidden onChange={e => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) void action(() => onPreview(file));
    }}/>

    <header className="transport" aria-label="Transport" onMouseDown={dragWindow}>
      <div className="brand"><img src="/muse.png" alt=""/><span>SongBook<b>Muse</b></span></div>
      <div className="transport-group transport-file">
        <button type="button" onClick={() => files.current?.click()} disabled={busy} title="Import chord sheets, PDFs or images">
          <FolderUp size={15}/><span>{busy ? "Importing…" : "Import"}</span></button>
      </div>
      <div className="transport-group transport-keys" role="group" aria-label="Song navigation">
        <IconButton label="Previous song" disabled={index <= 0} onClick={() => navigate(-1)}><SkipBack size={15}/></IconButton>
        <button type="button" className="play" aria-label={perform ? "Exit performance" : "Perform"} aria-pressed={perform}
          disabled={!song && !noteItem} onClick={togglePerformance}>{perform ? <Square size={13}/> : <Play size={15}/>}</button>
        <IconButton label="Next song" disabled={!currentSet || index < 0 || index >= currentSet.entries.length - 1} onClick={() => navigate(1)}><SkipForward size={15}/></IconButton>
      </div>
      <div className="lcd" role="status" aria-label="Song display">
        <span className="lcd-title">{lcdTitle}</span>
        <span className="lcd-cell"><small>Key</small>{displayKey || "--"}{capo > 0 && <em>c{capo}</em>}</span>
        <span className="lcd-cell"><small>BPM</small>{tempo || "---"}</span>
        <span className="lcd-cell"><small>Sig</small>{song?.time_signature || "4/4"}</span>
        <span className="lcd-cell"><small>Set</small>{position}</span>
      </div>
      <div className="transport-group">
        <Metronome tempo={tempo} savedTempo={song?.tempo ?? 0} beats={Number((song?.time_signature || "4/4").split("/")[0])}
          songKey={(song?.id ?? "") + ":" + (entryId ?? "")} timeout={settings.metronome_timeout} canSave={Boolean(song) && !locked}
          onTempo={bpm => { if (song) setTempoDraft({ song: song.id, bpm }); }}
          onSave={bpm => void action(async () => { if (song) { await saveSong({ ...song, tempo: bpm }, false); setTempoDraft(null); } })}
          onError={report}/>
        <IconButton label={autoScrollLabel + " (A)"} aria-pressed={autoScroll.running}
          disabled={!song || Boolean(song.document)} onClick={autoScroll.toggle}><ScrollText size={15}/></IconButton>
        <IconButton label="Chromatic tuner" onClick={() => setDialog("tuner")}><Radio size={15}/></IconButton>
        <IconButton label="Settings" onClick={() => setDialog("settings")}><Settings2 size={16}/></IconButton>
      </div>
      <WindowControls/>
    </header>

    <Browser mode={mode} setMode={setMode} search={search} setSearch={setSearch} songs={visible} hasSongs={catalog.length > 0}
      loaded={loaded} busy={busy} folders={folders} filter={filter} setFilter={setFilter} sort={sort} setSort={setSort}
      activeSong={entry ? null : song?.id ?? null} openSong={id => void action(() => changeSong(id))}
      newSong={() => setEditing(blankSong())} newFolder={() => setPrompt({ kind: "new-folder" })}
      renameFolder={folder => setPrompt({ kind: "rename-folder", folder })}
      deleteFolder={folder => { setFolderToDelete(folder); setDialog("delete-folder"); }}
      sets={sets} lookup={lookup} setId={setId} entryId={entryId}
      toggleSet={id => { setSetId(id === setId ? null : id); setEntryId(null); }}
      openEntry={openEntry} newSet={() => setEditingSet(blankSet())} editSet={setEditingSet}
      duplicateSet={set => setEditingSet({ ...set, id: nil, title: set.title + " copy", entries: set.entries.map(e => ({ ...e, id: nil })) })}
      printSet={() => print(true)} deleteSet={() => setDialog("delete-set")} moveEntry={move}
      removeEntry={(set, item) => void action(async () => {
        await writeSet({ ...set, entries: set.entries.filter(v => v.id !== item.id) });
        if (entryId === item.id) setEntryId(null);
      })}
      addNote={() => setPrompt({ kind: "note", entry: null })}
      shuffle={set => void action(async () => { await writeSet({ ...set, entries: shuffled(set.entries) }); setNotice("Shuffled " + set.title); })}
      dropFiles={selected => void action(() => importFiles(selected))}/>

    <main className="workspace">
      {song || noteItem ? <>
        <div className="toolstrip">
          <IconButton label="Back to library" className="icon-button mobile-back" onClick={() => { setPerform(false); setSurface("library"); }}><ChevronLeft size={18}/></IconButton>
          <span className="toolstrip-title">{currentSet && entry ? currentSet.title + "  ›  " + (index + 1) : song?.title}</span>
          <span className="toolbar-spacer"/>
          {song && <>
            <IconButton label="Lyrics only" aria-pressed={lyricsOnly} disabled={Boolean(song.document)} onClick={() => setLyricsOnly(!lyricsOnly)}><Eye size={15}/></IconButton>
            <IconButton label="Chord diagrams" aria-pressed={settings.diagram_location !== "off"} disabled={Boolean(song.document) || lyricsOnly}
              onClick={() => void action(() => changeSettings({ ...settings, diagram_location: settings.diagram_location === "off" ? "top" : "off" }))}><Guitar size={15}/></IconButton>
            <IconButton label="Fit song to screen" aria-pressed={settings.layout === "fit"} disabled={Boolean(song.document)}
              onClick={() => void action(() => changeSettings({ ...settings, layout: settings.layout === "fit" ? "scroll" : "fit" }))}><Maximize2 size={15}/></IconButton>
            {settings.layout === "scroll" && <IconButton label="Two columns" aria-pressed={settings.columns} disabled={Boolean(song.document)}
              onClick={() => void action(() => changeSettings({ ...settings, columns: !settings.columns }))}><Columns2 size={15}/></IconButton>}
            {!perform && <>
              <IconButton label={song.favorite ? "Remove from favorites" : "Add to favorites"} aria-pressed={song.favorite}
                onClick={() => void action(() => saveSong({ ...song, favorite: !song.favorite }, false))}><Star size={15}/></IconButton>
              <IconButton label="Song details" aria-pressed={inspector} onClick={() => setInspector(!inspector)}><SlidersHorizontal size={15}/></IconButton>
              <div className="menu-wrap">
                <IconButton label="Song actions" aria-expanded={menu} onClick={() => setMenu(!menu)}><Ellipsis size={17}/></IconButton>
                {menu && <div className="menu" role="menu">
                  <button role="menuitem" disabled={locked} onClick={() => { setEditing(song); setMenu(false); }}><Pencil size={14}/>Edit song</button>
                  <button role="menuitem" onClick={() => { setDialog("add-to-set"); setMenu(false); }}><ListMusic size={14}/>Add to setlist</button>
                  <button role="menuitem" onClick={() => { setMenu(false); void action(exportCurrent); }}><Download size={14}/>Export song</button>
                  <button role="menuitem" onClick={() => print(false)}><Printer size={14}/>Print song</button>
                  <button role="menuitem" disabled={locked} onClick={() => { setMenu(false); setDialog("delete-song"); }}><Trash2 size={14}/>Delete song</button>
                </div>}
              </div>
            </>}
          </>}
          {noteItem && !perform && <button type="button" onClick={() => setPrompt({ kind: "note", entry: noteItem })}><Pencil size={14}/>Edit note</button>}
          {perform && <button type="button" className="exit-perform" onClick={togglePerformance}><Minimize size={15}/>Exit</button>}
        </div>
        <div className="sheet-scroll" ref={scroll} data-autoscroll={autoScroll.running} data-fit={fitMode}
          data-overscroll={settings.autoscroll_overscroll && !fitMode && Boolean(song && !song.document && !noteItem)} onTouchStart={e => {
          touch.current = e.touches.length === 1 ? [e.touches[0].clientX, e.touches[0].clientY] : null;
        }} onTouchEnd={e => {
          const start = touch.current; touch.current = null;
          if (!start || tool !== "none" || !perform) return;
          const dx = e.changedTouches[0].clientX - start[0], dy = e.changedTouches[0].clientY - start[1];
          if (Math.abs(dx) >= 70 && Math.abs(dx) > Math.abs(dy) * 1.5) navigate(dx < 0 ? 1 : -1);
        }}>
          {noteItem ? <article className="sheet note-sheet" style={{ "--zoom": settings.scale / 100 } as React.CSSProperties}>
            <header className="sheet-header"><StickyNote size={18}/><h2>Note</h2></header>
            <p className="note-text">{noteItem.note}</p>
          </article> : song && renderOptions && fitMode ? <article className="sheet sheet-fit">
            <FitChart key={song.id} source={song.source} options={renderOptions} lyricsOnly={lyricsOnly} viewport={scroll}
              inline={inlineDiagrams} header={chartHeader} footer={sheetFooter} onLayout={setFitInfo}/>
          </article> : song && renderOptions && <article className={"sheet" + (settings.columns ? " sheet-columns" : "")} style={{ "--zoom": settings.scale / 100 } as React.CSSProperties}>
            {chartHeader}
            {song.document ? <DocumentView key={song.id} song={song} page={page} setPage={setPage} setPageCount={setPageCount}
              invertPdf={settings.invert_pdf} tool={canDraw ? tool : "none"} brush={brush} width={width}
              changeInk={ink => { setRedo([]); changeInk(ink); }} onError={report}/> :
              <Chart source={song.source} options={renderOptions} lyricsOnly={lyricsOnly} inline={inlineDiagrams}/>}
            {sheetFooter}
          </article>}
        </div>
        {perform && <footer className="stage-bar">
          <button type="button" aria-label="Previous song" disabled={index <= 0} onClick={() => navigate(-1)}><SkipBack size={20}/></button>
          {pdf && <span className="lcd-inline">{page}/{pageCount}</span>}
          <button type="button" aria-label={autoScrollLabel} aria-pressed={autoScroll.running}
            disabled={!song || Boolean(song.document)} onClick={autoScroll.toggle}><ScrollText size={20}/></button>
          <span className="lcd-inline">{position}</span>
          <button type="button" aria-label="Next song" disabled={!currentSet || index < 0 || index >= currentSet.entries.length - 1} onClick={() => navigate(1)}><SkipForward size={20}/></button>
        </footer>}
        {song?.track && <BackingTrack key={song.id} track={song.track} onError={report}/>}
      </> : <div className="empty-workspace">
        <span className="empty-mark"><Music2 size={34} strokeWidth={1.4}/></span>
        <h2>{catalog.length ? "Pick a song to load it" : "Build your songbook"}</h2>
        <p>{catalog.length ? "Choose a song or setlist item from the browser. Arrow keys move through a setlist." : "Add chord sheets, PDFs or images. Drop files on the browser or use Import."}</p>
        {!catalog.length && <button className="primary" onClick={() => files.current?.click()} disabled={busy}><FolderUp size={16}/>Import songs</button>}
      </div>}
    </main>

    {song && inspector && !perform && <Inspector song={song} kind={lookup.get(song.id)?.kind ?? "Chord sheet"} shift={shift} capo={capo}
      inSet={Boolean(entry)} changePitch={(p, v) => void action(() => modifyPitch(p, v))} settings={settings}
      changeSettings={next => void action(() => changeSettings(next))} fitScale={fitMode ? fitInfo?.scale ?? null : null} folders={folders}
      toggleFolder={id => void action(() => saveSong({ ...song, folders: song.folders.includes(id) ? song.folders.filter(f => f !== id) : [...song.folders, id] }, false))}
      toggleLock={() => void action(() => saveSong({ ...song, locked: !song.locked }, false))}
      scrollSeconds={autoScroll.seconds} savingScrollTime={savingScrollTime} changeScrollTime={seconds => void action(() => changeScrollTime(seconds))}
      sectionLabels={sectionLabels} sectionOrder={sectionOrder} sectionOrderOverridden={entry?.section_order != null}
      savingSectionOrder={savingSectionOrder} changeSectionOrder={order => void action(() => changeSectionOrder(order))}
      tool={tool} setTool={setTool} brush={brush} setBrush={setBrush} width={width} setWidth={setWidth}
      undo={song.ink.length && !locked ? () => { setRedo([...redo, song.ink.at(-1)!]); changeInk(song.ink.slice(0, -1)); } : null}
      redo={redo.length && !locked ? () => { changeInk([...song.ink, redo.at(-1)!]); setRedo(redo.slice(0, -1)); } : null}
      edit={() => setEditing(song)} close={() => setInspector(false)}/>}

    <footer className="hintbar" role={error ? "alert" : "status"} data-tone={error ? "error" : notice ? "notice" : "hint"}>
      <span>{error || notice || hint || fitHint || (song ? "Space or Page Down turns the page · A toggles auto-scroll" : "Ready")}</span>
      {(error || notice) && <IconButton label="Dismiss message" onClick={() => { setNotice(""); setError(""); }}><X size={13}/></IconButton>}
    </footer>

    <nav className="mobile-nav" aria-label="Main navigation">
      <button aria-pressed={surface === "library"} onClick={() => { setSurface("library"); setInspector(false); }}><BookOpen size={17}/>Library</button>
      <button aria-pressed={surface === "song"} disabled={!song && !noteItem} onClick={() => setSurface("song")}><Music2 size={17}/>Song</button>
    </nav>

    {editing && <SongEditor song={editing} settings={settings} onClose={() => setEditing(null)} onSave={next => action(async () => {
      await saveSong(next, true); setEditing(null);
    })}/>}
    {editingSet && <SetEditor setlist={editingSet} close={() => setEditingSet(null)} save={next => action(async () => {
      const result = await writeSet(next); setSetId(result.id); setEntryId(null); setMode("sets"); setEditingSet(null);
    })}/>}
    {prompt && <Prompt title={prompt.kind === "new-folder" ? "New folder" : prompt.kind === "rename-folder" ? "Rename folder" : prompt.entry ? "Edit note" : "Add note item"}
      label={prompt.kind === "note" ? "Note text" : "Folder name"} multiline={prompt.kind === "note"}
      initial={prompt.kind === "rename-folder" ? prompt.folder.name : prompt.kind === "note" ? prompt.entry?.note ?? "" : ""}
      action={prompt.kind === "new-folder" ? "Create folder" : prompt.kind === "rename-folder" ? "Rename folder" : "Save note"}
      close={() => setPrompt(null)} submit={value => action(() => submitPrompt(value))}/>}
    {dialog === "tuner" && <Modal title="Chromatic tuner" close={() => setDialog(null)}><Tuner/></Modal>}
    {dialog === "settings" && <SettingsWindow settings={settings} change={next => void action(() => changeSettings(next))}
      report={report} close={() => setDialog(null)} lastExport={lastExport.at}
      library={<LibraryPanel stats={libraryStats} lastExport={lastExport.at} chooseRestore={() => backup.current?.click()}
        exportBackup={() => exportBackup(backupName())}/>}/>}
    {dialog === "backup" && preview && backupFile && <Modal title="Restore backup" className="wizard-window"
      close={() => { if (!restoring) setDialog("settings"); }}>
      <RestoreWizard preview={preview} file={backupFile} current={libraryStats} setBusy={setRestoring}
        restore={restore} safetyExport={() => exportBackup(backupName("SongBookMuse before restore"))}
        close={() => setDialog(null)}/>
    </Modal>}
    {dialog === "add-to-set" && song && <Modal title="Add to setlist" close={() => setDialog(null)}>
      {!sets.length && <p>Create a setlist from the browser first.</p>}
      <div className="set-picker">{sets.map(set => <button key={set.id} onClick={() => void action(async () => {
        await writeSet({ ...set, entries: [...set.entries, nilEntry(song.id)] });
        setNotice("Added to " + set.title); setDialog(null);
      })}><ListMusic size={16}/>{set.title}</button>)}</div>
    </Modal>}
    {dialog === "delete-song" && song && <Modal title="Delete song?" close={() => setDialog(null)}>
      <p>{song.title} will be removed from your library and all setlists.</p>
      <footer><button onClick={() => setDialog(null)}>Cancel</button><button className="danger" onClick={() => void action(async () => {
        await invoke("delete_song", { id: song.id }); ++selection.current; setSong(null);
        setEntryId(null); setSurface("library"); setDialog(null); await refresh();
      })}>Delete song</button></footer>
    </Modal>}
    {dialog === "delete-set" && currentSet && <Modal title="Delete setlist?" close={() => setDialog(null)}>
      <p>{currentSet.title} will be removed. Songs stay in your library.</p><footer><button onClick={() => setDialog(null)}>Cancel</button>
        <button className="danger" onClick={() => void action(async () => {
          await invoke("delete_set", { id: currentSet.id }); setSetId(null); setEntryId(null); setDialog(null); await refresh();
        })}>Delete setlist</button></footer>
    </Modal>}
    {dialog === "delete-folder" && folderToDelete && <Modal title="Delete folder?" close={() => setDialog(null)}>
      <p>{folderToDelete.name} will be removed. Its songs stay in your library.</p><footer><button onClick={() => setDialog(null)}>Cancel</button>
        <button className="danger" onClick={() => void action(async () => {
          await invoke("delete_folder", { id: folderToDelete.id }); setFilter({ kind: "all" }); setDialog(null); await refresh();
          if (song) setSong({ ...song, folders: song.folders.filter(f => f !== folderToDelete.id) });
        })}>Delete folder</button></footer>
    </Modal>}

    {printSet && currentSet && <section className="print-set"><h1>{currentSet.title}</h1>
      {currentSet.date && <p>{currentSet.date.slice(0, 10)}</p>}
      <ol>{currentSet.entries.map(e => <li key={e.id}>{e.note != null ? <em>{e.note}</em> : lookup.get(e.song_id)?.title}</li>)}</ol>
    </section>}
  </div></DialogError.Provider>;
}
