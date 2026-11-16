import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ArrowDown, ArrowUp, BookOpen, ChevronLeft, ChevronRight, Columns2, Download, Ellipsis, Eye,
  FileText, FolderUp, ListMusic, Maximize, Minimize, Music2, Pencil, Pin, Plus, Printer, Search,
  Settings2, SlidersHorizontal, Star, Trash2, Undo2, X, Radio
} from "lucide-react";
import { Chart } from "./Chart";
import { DialogError, IconButton, Modal } from "./components";
import { decode, encode, exportFile, safeName } from "./commands";
import { DocumentView } from "./DocumentView";
import { Metronome } from "./Metronome";
import { MidiSettings } from "./MidiSettings";
import { SongEditor } from "./SongEditor";
import { SetEditor } from "./SetEditor";
import { BackingTrack } from "./BackingTrack";
import { Tuner } from "./Tuner";
import {
  blankSong, defaultSettings, duration, nil,
  type Preview, type Settings, type Setlist, type Song, type SongSummary, type Stroke
} from "./model";

type Dialog = "settings" | "backup" | "delete-song" | "delete-set" | "add-to-set" | "tuner" | null;
const songTypes = ".txt,.pro,.cho,.chordpro,.chopro,.crd,.chords,.cpro,.pdf,.png,.jpg,.jpeg,.webp";
const blankSet = (): Setlist => ({ id: nil, title: "", date: "", pinned: false, entries: [] });

export function App() {
  const [catalog, setCatalog] = useState<SongSummary[]>([]);
  const [matches, setMatches] = useState<SongSummary[] | null>(null);
  const [sets, setSets] = useState<Setlist[]>([]);
  const [song, setSong] = useState<Song | null>(null);
  const [setId, setSetId] = useState<string | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState(false);
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
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [displayKey, setDisplayKey] = useState("");
  const [draw, setDraw] = useState(false);
  const [brush, setBrush] = useState("#ad3937");
  const [redo, setRedo] = useState<Stroke[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const files = useRef<HTMLInputElement>(null);
  const backup = useRef<HTMLInputElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const selection = useRef(0);
  const touch = useRef<[number, number] | null>(null);
  const currentSet = sets.find(s => s.id === setId);
  const entry = currentSet?.entries.find(e => e.id === entryId);
  const shift = entry?.transpose ?? song?.transpose ?? 0;
  const capo = entry?.capo ?? song?.capo ?? 0;

  const report = useCallback((cause: unknown) => setError(String(cause)), []);
  const action = useCallback(async (task: () => Promise<void>) => {
    setError("");
    try { await task(); } catch (cause) { report(cause); }
  }, [report]);
  const refresh = useCallback(async () => {
    const [all, lists] = await Promise.all([invoke<SongSummary[]>("songs", { query: "" }), invoke<Setlist[]>("sets")]);
    setCatalog(all);
    setSets(lists);
  }, []);
  const changeSong = useCallback(async (id: string, list: string | null = null, position: string | null = null) => {
    const request = ++selection.current;
    const next = await invoke<Song>("song", { id });
    if (request !== selection.current) return;
    setSong(next);
    setSetId(list);
    setEntryId(position);
    setSurface("song");
    setPage(1);
    setPageCount(1);
    setDraw(false);
    setRedo([]);
    scroll.current?.scrollTo(0, 0);
    if (next.midi.length) void invoke("midi_open_song", { id }).catch(report);
  }, [report]);

  useEffect(() => {
    void action(async () => {
      await refresh();
      setSettings(await invoke<Settings>("settings"));
      setLoaded(true);
    });
  }, [action, refresh]);

  useEffect(() => {
    let obsolete = false;
    if (mode !== "songs" || !search.trim()) { setMatches(null); return; }
    const timer = window.setTimeout(() => {
      void invoke<SongSummary[]>("songs", { query: search }).then(data => {
        if (!obsolete) setMatches(data);
      }, cause => { if (!obsolete) report(cause); });
    }, 120);
    return () => { obsolete = true; window.clearTimeout(timer); };
  }, [search, catalog, mode, report]);

  useEffect(() => {
    let obsolete = false;
    if (!song?.key) { setDisplayKey(""); return; }
    void invoke<string>("transpose", { chord: song.key, shift, flats: settings.flats }).then(value => {
      if (!obsolete) setDisplayKey(value);
    }, report);
    return () => { obsolete = true; };
  }, [song?.key, shift, settings.flats, report]);

  useEffect(() => {
    if (!perform || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    let disposed = false;
    async function acquire() {
      if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        const grant = await navigator.wakeLock.request("screen");
        if (disposed) void grant.release();
        else lock = grant;
      } catch { /* Some webviews do not expose a screen wake lock. */ }
    }
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", acquire);
      if (lock) void lock.release();
    };
  }, [perform]);

  const index = currentSet?.entries.findIndex(e => e.id === entryId) ?? -1;
  const navigate = useCallback((step: number) => {
    if (!currentSet || index < 0) return;
    const next = currentSet.entries[index + step];
    if (next) void action(() => changeSong(next.song_id, currentSet.id, next.id));
  }, [currentSet, index, action, changeSong]);

  const togglePerformance = useCallback(() => {
    setPerform(!perform);
    setInspector(false);
    setDraw(false);
    void getCurrentWindow().setFullscreen(!perform).catch(() => {});
  }, [perform]);

  const stepPage = useCallback((step: number) => {
    if (song?.document?.mime === "application/pdf") {
      setPage(current => Math.max(1, Math.min(pageCount, current + step)));
      return;
    }
    const view = scroll.current;
    if (view) view.scrollBy({ top: step * view.clientHeight * .9 });
  }, [song?.document?.mime, pageCount]);

  useEffect(() => {
    let disposed = false;
    const listener = listen<string>("midi-action", ({ payload }) => {
      if (disposed || document.querySelector("dialog[open]")) return;
      if (payload === "next_song" || payload === "previous_song") {
        navigate(payload === "next_song" ? 1 : -1);
      } else if (payload === "page_up" || payload === "page_down") {
        stepPage(payload === "page_up" ? -1 : 1);
      }
    });
    return () => { disposed = true; void listener.then(stop => stop()).catch(() => {}); };
  }, [navigate, stepPage]);

  useEffect(() => {
    function handle(event: KeyboardEvent) {
      if (event.defaultPrevented || event.target instanceof Element &&
          event.target.closest("input, textarea, select, button, [contenteditable], dialog")) return;
      if (event.key === "Escape" && perform) togglePerformance();
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") navigate(event.key === "ArrowLeft" ? -1 : 1);
      if (["PageUp", "PageDown", " "].includes(event.key) && song) {
        event.preventDefault();
        stepPage(event.key === "PageUp" || event.shiftKey ? -1 : 1);
      }
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [navigate, perform, song, stepPage, togglePerformance]);

  const lookup = useMemo(() => new Map(catalog.map(item => [item.id, item])), [catalog]);
  const visible = useMemo(() => {
    const result = (matches ?? catalog).filter(s => !s.archived && (!favorites || s.favorite));
    if (sort === "artist") result.sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
    return result;
  }, [matches, catalog, favorites, sort]);

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

  function move(position: number, direction: number) {
    if (!currentSet) return;
    const entries = [...currentSet.entries];
    const other = position + direction;
    if (other < 0 || other >= entries.length) return;
    [entries[position], entries[other]] = [entries[other], entries[position]];
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
    setReplace(false);
    setDialog("backup");
  }

  const [restoring, setRestoring] = useState(false);
  async function restore() {
    if (!preview) return;
    setRestoring(true);
    const replacing = replace;
    try {
      const result = await invoke<{ songs: number; reused: number; sets: number }>("restore_backup",
        { token: preview.token, mode: replacing ? "replace" : "merge" });
      if (replacing) {
        ++selection.current;
        setSong(null); setSetId(null); setEntryId(null); setSurface("library");
        setSettings(await invoke<Settings>("settings"));
      }
      await refresh();
      setNotice(result.songs + " added · " + result.reused + " reused · " + result.sets + " setlists restored");
      setDialog(null);
    } finally { setRestoring(false); }
  }

  async function changeSettings(next: Settings) {
    await invoke("save_settings", { settings: next });
    setSettings(next);
  }

  function changeInk(ink: Stroke[]) {
    if (song) void action(() => saveSong({ ...song, ink }, false));
  }

  async function exportCurrent() {
    if (!song) return;
    if (song.document) {
      const ext = ({ "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as Record<string,string>)[song.document.mime];
      await exportFile(safeName(song.title) + "." + ext, new Blob([decode(song.document.bytes)], { type: song.document.mime }));
    } else {
      const fields = { title: song.title, artist: song.artist, subtitle: song.subtitle, key: song.key,
        tempo: song.tempo || "", duration: song.duration || "", capo: song.capo || "", time: song.time_signature, copyright: song.copyright };
      const clean = (s: string | number) => String(s).replace(/[\r\n{}]/g, " ");
      const header = Object.entries(fields).filter(([,value]) => value).map(([key,value]) => "{" + key + ": " + clean(value) + "}");
      const known = /^\s*\{\s*(t|title|artist|st|subtitle|k|key|tempo|duration|capo|time|copyright)\s*:/i;
      const body = song.source.split(/\r?\n/).filter(line => !known.test(line)).join("\n");
      await exportFile(safeName(song.title) + ".cho", new Blob([header.join("\n"), "\n", body], { type: "text/plain" }));
    }
  }

  const [menu, setMenu] = useState(false);
  const [printSet, setPrintSet] = useState(false);
  function print(list: boolean) {
    setMenu(false);
    setPrintSet(list);
    window.setTimeout(() => { window.print(); setPrintSet(false); }, 100);
  }

  return <DialogError.Provider value={error}><div className="app" data-theme={settings.theme} data-perform={perform} data-surface={surface} data-inspector={inspector} data-compact={settings.compact_sidebar}>
    <input ref={files} type="file" accept={songTypes} multiple hidden onChange={onImport}/>
    <input ref={backup} type="file" accept=".sbpbackup,.musebackup,.zip" hidden onChange={e => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) void action(() => onPreview(file));
    }}/>
    <header className="topbar">
      <div className="brand"><img src="/muse.png" alt=""/><span>SongBook<span className="brand-accent">Muse</span></span></div>
      <div className="top-actions">
        <button type="button" onClick={() => files.current?.click()} disabled={busy}><FolderUp size={16}/><span>{busy ? "Importing…" : "Import"}</span></button>
        <IconButton label="Settings" onClick={() => setDialog("settings")}><Settings2 size={19}/></IconButton>
      </div>
    </header>

    {(notice || error) && !(dialog || editing || editingSet) && <div className={"message" + (error ? " error" : "")} role={error ? "alert" : "status"}>
      {error || notice}<IconButton label="Dismiss message" onClick={() => { setNotice(""); setError(""); }}><X size={17}/></IconButton>
    </div>}

    <aside className="library" aria-label="Library" onDragOver={e => e.preventDefault()} onDrop={e => {
      e.preventDefault();
      if (!busy) void action(() => importFiles(Array.from(e.dataTransfer.files)));
    }}>
      <nav className="tabs" aria-label="Collection">
        <button onClick={() => { setMode("songs"); setSearch(""); }} aria-pressed={mode === "songs"}><BookOpen size={17}/>Songs</button>
        <button onClick={() => { setMode("sets"); setSearch(""); }} aria-pressed={mode === "sets"}><ListMusic size={18}/>Setlists</button>
      </nav>
      <div className="library-title"><h1>{mode === "songs" ? "Library" : "Setlists"}</h1>
        <IconButton label={mode === "songs" ? "New song" : "New setlist"} className="icon-button add"
          onClick={() => mode === "songs" ? setEditing(blankSong()) : setEditingSet(blankSet())}><Plus size={19}/></IconButton>
      </div>
      <label className="search"><Search size={17}/><input type="search" aria-label={mode === "songs" ? "Search songs" : "Search setlists"}
        placeholder={mode === "songs" ? "Search songs" : "Search setlists"} value={search} onChange={e => setSearch(e.target.value)}/></label>
      {mode === "songs" ? <>
        <div className="filters">
          <button className="filter" aria-pressed={favorites} onClick={() => setFavorites(!favorites)}><Star size={14}/> Favorites</button>
          <select aria-label="Sort songs" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="title">Title</option><option value="artist">Artist</option>
          </select>
        </div>
        <div className="library-scroll">
          {visible.map(item => <button className="song-row" key={item.id} aria-current={song?.id === item.id && !entry ? "true" : undefined}
            onClick={() => void action(() => changeSong(item.id))}>
            {item.kind === "Chord sheet" ? <Music2 size={17}/> : <FileText size={17}/>}
            <span><strong>{item.title}</strong><small>{item.artist || item.kind}</small></span>
            {item.key && <span className="song-key">{item.key}</span>}
          </button>)}
          {loaded && !visible.length && <p className="list-empty">{catalog.length ? "No matching songs" : "Your songs will appear here."}</p>}
        </div>
        <div className="list-footer">{visible.length.toLocaleString()} {visible.length === 1 ? "song" : "songs"}</div>
      </> : <>
        <div className="library-scroll set-scroll">
          {sets.filter(s => s.title.toLowerCase().includes(search.toLowerCase())).map(set => <section key={set.id} className="set-group">
            <button className="song-row" aria-expanded={set.id === setId} onClick={() => {
              setSetId(set.id === setId ? null : set.id); setEntryId(null);
            }}><ListMusic size={18}/><span><strong>{set.title}</strong>
              <small>{set.entries.length} songs · {duration(set.entries.reduce((sum, e) => sum + (lookup.get(e.song_id)?.duration ?? 0), 0))}</small></span>
              {set.pinned && <Pin size={13}/>}</button>
            {set.id === setId && <>
              <div className="set-tools">
                <IconButton label="Edit setlist" onClick={() => setEditingSet(set)}><Pencil size={15}/></IconButton>
                <IconButton label="Duplicate setlist" onClick={() => setEditingSet({ ...set, id: nil, title: set.title + " copy",
                  entries: set.entries.map(e => ({ ...e, id: nil })) })}><Plus size={15}/></IconButton>
                <IconButton label="Print setlist" onClick={() => print(true)}><Printer size={15}/></IconButton>
                <IconButton label="Delete setlist" onClick={() => setDialog("delete-set")}><Trash2 size={15}/></IconButton>
              </div>
              {set.entries.map((e, i) => <div className="set-entry" key={e.id}>
                <button aria-current={entryId === e.id ? "true" : undefined}
                  onClick={() => void action(() => changeSong(e.song_id, set.id, e.id))}>
                  <span>{i + 1}</span>{lookup.get(e.song_id)?.title ?? "Unavailable song"}
                </button>
                <IconButton label={"Move song " + (i+1) + " up"} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14}/></IconButton>
                <IconButton label={"Move song " + (i+1) + " down"} disabled={i === set.entries.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14}/></IconButton>
                <IconButton label={"Remove song " + (i+1)} onClick={() => void action(async () => {
                  await writeSet({ ...set, entries: set.entries.filter(v => v.id !== e.id) });
                  if (entryId === e.id) setEntryId(null);
                })}><X size={14}/></IconButton>
              </div>)}
              {!set.entries.length && <p className="list-empty">Open a song and choose Add to setlist.</p>}
            </>}
          </section>)}
          {loaded && !sets.length && <p className="list-empty">Create a setlist to arrange your songs for a performance.</p>}
        </div>
        <div className="list-footer">{sets.length} {sets.length === 1 ? "setlist" : "setlists"}</div>
      </>}
    </aside>

    <main className="workspace">
      {song ? <>
        <div className="viewer-toolbar">
          <IconButton label="Back to library" className="icon-button mobile-back" onClick={() => { setPerform(false); setSurface("library"); }}><ChevronLeft size={20}/></IconButton>
          <span className="toolbar-title">{currentSet && entry ? currentSet.title : song.title}</span>
          <span className="toolbar-spacer"/>
          {!perform && <>
            <IconButton label={song.favorite ? "Remove from favorites" : "Add to favorites"} aria-pressed={song.favorite}
              onClick={() => void action(() => saveSong({ ...song, favorite: !song.favorite }, false))}><Star size={18}/></IconButton>
            <IconButton label="Song details" aria-pressed={inspector} onClick={() => setInspector(!inspector)}><SlidersHorizontal size={17}/></IconButton>
            <div className="menu-wrap">
              <IconButton label="Song actions" aria-expanded={menu} onClick={() => setMenu(!menu)}><Ellipsis size={20}/></IconButton>
              {menu && <div className="menu">
                <button onClick={() => { setEditing(song); setMenu(false); }}><Pencil size={16}/>Edit song</button>
                <button onClick={() => { setDialog("add-to-set"); setMenu(false); }}><ListMusic size={16}/>Add to setlist</button>
                <button onClick={() => { setMenu(false); void action(exportCurrent); }}><Download size={16}/>Export song</button>
                <button onClick={() => print(false)}><Printer size={16}/>Print song</button>
                <button onClick={() => { setMenu(false); setDialog("delete-song"); }}><Trash2 size={16}/>Delete song</button>
              </div>}
            </div>
          </>}
          <button aria-label={perform ? "Exit performance" : "Perform"} className="perform-button" onClick={togglePerformance}>
            {perform ? <Minimize size={17}/> : <Maximize size={17}/>}<span>{perform ? "Exit" : "Perform"}</span>
          </button>
        </div>
        <div className="sheet-scroll" ref={scroll} onTouchStart={e => {
          touch.current = e.touches.length === 1 ? [e.touches[0].clientX, e.touches[0].clientY] : null;
        }} onTouchEnd={e => {
          const start = touch.current; touch.current = null;
          if (!start || draw || !perform) return;
          const dx = e.changedTouches[0].clientX - start[0], dy = e.changedTouches[0].clientY - start[1];
          if (Math.abs(dx) >= 70 && Math.abs(dx) > Math.abs(dy) * 1.5) navigate(dx < 0 ? 1 : -1);
        }}>
          <article className={"sheet" + (settings.columns ? " sheet-columns" : "")} style={{ "--zoom": settings.scale / 100 } as React.CSSProperties}>
            <header className="sheet-header">
              <h2>{song.title}</h2>
              {(song.artist || song.subtitle) && <p>{[song.artist, song.subtitle].filter(Boolean).join(" · ")}</p>}
              <div className="sheet-meta">{displayKey && <span>Key {displayKey}</span>}{capo > 0 && <span>Capo {capo}</span>}
                {song.tempo > 0 && <span>{song.tempo} BPM</span>}{song.time_signature && <span>{song.time_signature}</span>}</div>
            </header>
            {song.document ? <DocumentView key={song.id} song={song} page={page} setPage={setPage} setPageCount={setPageCount} draw={draw}
              brush={brush} changeInk={ink => { setRedo([]); changeInk(ink); }} onError={report}/> :
              <Chart source={song.source} shift={shift - capo} flats={settings.flats} lyricsOnly={lyricsOnly}/>}
            {song.copyright && <p className="copyright">{song.copyright}</p>}
            {song.notes && <aside className="song-notes"><h3>Notes</h3>{song.notes}</aside>}
          </article>
        </div>
        <footer className="performance-bar">
          <div className="performance-controls">
            <Metronome tempo={song.tempo} beats={Number(song.time_signature.split("/")[0])} onError={report}/>
            <IconButton label="Chromatic tuner" onClick={() => setDialog("tuner")}><Radio size={17}/></IconButton>
          </div>
          <div className="performance-controls">
            <IconButton label="Previous song" disabled={index <= 0} onClick={() => navigate(-1)}><ChevronLeft size={21}/></IconButton>
            {index >= 0 && <span>{index + 1} / {currentSet?.entries.length}</span>}
            <IconButton label="Next song" disabled={!currentSet || index < 0 || index >= currentSet.entries.length - 1} onClick={() => navigate(1)}><ChevronRight size={21}/></IconButton>
          </div>
          <div className="view-tools">
            <IconButton label="Lyrics only" aria-pressed={lyricsOnly} disabled={Boolean(song.document)} onClick={() => setLyricsOnly(!lyricsOnly)}><Eye size={17}/></IconButton>
            <IconButton label="Two columns" aria-pressed={settings.columns} disabled={Boolean(song.document)}
              onClick={() => void action(() => changeSettings({ ...settings, columns: !settings.columns }))}><Columns2 size={17}/></IconButton>
          </div>
        </footer>
        {song.track && <BackingTrack key={song.id} track={song.track} onError={report}/>}
      </> : <div className="empty-workspace">
        <span className="empty-mark"><BookOpen size={36} strokeWidth={1.3}/></span>
        <h2>{catalog.length ? "Open a song" : "Build your songbook"}</h2>
        <p>{catalog.length ? "Choose a song from your library." : "Add chord sheets, PDFs, or images to your library."}</p>
        {!catalog.length && <button className="primary" onClick={() => files.current?.click()} disabled={busy}><FolderUp size={17}/>Import songs</button>}
      </div>}
    </main>

    {song && inspector && !perform && <aside className="inspector" aria-label="Song details">
      <header><h2>Song details</h2><IconButton label="Close details" onClick={() => setInspector(false)}><X size={17}/></IconButton></header>
      <section><h3>Pitch</h3>
        <div className="step-row"><span>Transpose</span><button disabled={shift <= -24} aria-label="Transpose down" onClick={() => void action(() => modifyPitch("transpose", shift - 1))}>−</button>
          <output>{shift > 0 ? "+" : ""}{shift}</output>
          <button disabled={shift >= 24} aria-label="Transpose up" onClick={() => void action(() => modifyPitch("transpose", shift + 1))}>+</button></div>
        <div className="step-row"><span>Capo</span><button disabled={capo <= 0} aria-label="Lower capo" onClick={() => void action(() => modifyPitch("capo", capo - 1))}>−</button>
          <output>{capo}</output><button disabled={capo >= 12} aria-label="Raise capo" onClick={() => void action(() => modifyPitch("capo", capo + 1))}>+</button></div>
      </section>
      <section><h3>Display</h3><label>Zoom <output>{settings.scale}%</output>
        <input aria-label="Song zoom" type="range" min="65" max="200" step="5" value={settings.scale} onChange={e => {
          const next = { ...settings, scale: Number(e.target.value) };
          setSettings(next);
          void action(() => changeSettings(next));
        }}/></label></section>
      {song.document && <section><h3>Annotations</h3>
        <button aria-pressed={draw} onClick={() => setDraw(!draw)}><Pencil size={16}/>{draw ? "Finish drawing" : "Draw on page"}</button>
        {draw && <label>Ink color<input type="color" value={brush} onChange={e => setBrush(e.target.value)}/></label>}
        <div className="ink-tools"><button disabled={!song.ink.length} onClick={() => {
          setRedo([...redo, song.ink.at(-1)!]); changeInk(song.ink.slice(0,-1));
        }}><Undo2 size={15}/>Undo</button>
        <button disabled={!redo.length} onClick={() => {
          changeInk([...song.ink, redo.at(-1)!]); setRedo(redo.slice(0,-1));
        }}>Redo</button></div>
      </section>}
      <section><h3>Metadata</h3><dl><dt>Format</dt><dd>{lookup.get(song.id)?.kind ?? "Chord sheet"}</dd>
        <dt>Duration</dt><dd>{duration(song.duration)}</dd>
        {!!song.tags.length && <><dt>Tags</dt><dd>{song.tags.join(", ")}</dd></>}</dl>
        <button onClick={() => setEditing(song)}><Pencil size={16}/>Edit song</button>
      </section>
    </aside>}

    <nav className="mobile-nav" aria-label="Main navigation">
      <button aria-pressed={surface === "library"} onClick={() => { setSurface("library"); setInspector(false); }}><BookOpen size={18}/>Library</button>
      <button aria-pressed={surface === "song"} disabled={!song} onClick={() => setSurface("song")}><Music2 size={18}/>Song</button>
    </nav>

    {editing && <SongEditor song={editing} settings={settings} onClose={() => setEditing(null)} onSave={next => action(async () => {
      await saveSong(next, true); setEditing(null);
    })}/>}
    {editingSet && <SetEditor setlist={editingSet} close={() => setEditingSet(null)} save={next => action(async () => {
      const result = await writeSet(next); setSetId(result.id); setEntryId(null); setMode("sets"); setEditingSet(null);
    })}/>}
    {dialog === "tuner" && <Modal title="Chromatic tuner" close={() => setDialog(null)}><Tuner/></Modal>}
    {dialog === "settings" && <Modal title="Settings" close={() => setDialog(null)}>
      <section className="settings-section"><h3>Appearance</h3>
        <label>Theme<select value={settings.theme} onChange={e => void action(() => changeSettings({ ...settings, theme: e.target.value as Settings["theme"] }))}>
          <option value="dark">Dark</option><option value="light">Light</option><option value="contrast">High contrast</option></select></label>
        <label className="check"><input type="checkbox" checked={settings.flats}
          onChange={e => void action(() => changeSettings({ ...settings, flats: e.target.checked }))}/>Prefer flats when transposing</label>
        <label className="check"><input type="checkbox" checked={settings.compact_sidebar}
          onChange={e => void action(() => changeSettings({ ...settings, compact_sidebar: e.target.checked }))}/>Compact library rows</label></section>
      <section className="settings-section"><h3>Library backup</h3>
        <div className="button-row">
          <button onClick={() => void action(async () => {
            const bytes = await invoke<ArrayBuffer>("export_backup");
            await exportFile("SongBookMuse.musebackup", new Blob([bytes], { type: "application/octet-stream" }));
          })}><Download size={16}/>Export backup</button>
          <button onClick={() => backup.current?.click()}><FolderUp size={16}/>Restore backup</button>
        </div>
      </section>
      <MidiSettings onError={report}/>
    </Modal>}
    {dialog === "backup" && preview && <Modal title="Review backup" close={() => { if (!restoring) setDialog(null); }}>
      <p>{preview.details.format} · {preview.details.songs.toLocaleString()} songs · {preview.details.sets} setlists</p>
      <p>{preview.details.entries} set entries · {preview.details.archived} archived songs linked from sets</p>
      {preview.details.settings && <p className="muted">Replace mode also restores supported preferences.</p>}
      {preview.details.warnings.map(warning => <p key={warning} className="muted">{warning}</p>)}
      <fieldset><legend>Restore mode</legend>
        <label className="check"><input type="radio" checked={!replace} onChange={() => setReplace(false)}/>Merge and reuse identical songs</label>
        <label className="check"><input type="radio" checked={replace} onChange={() => setReplace(true)}/>Replace all current songs, setlists and settings</label>
      </fieldset>
      <footer><button disabled={restoring} onClick={() => setDialog(null)}>Cancel</button>
        <button className={replace ? "danger" : "primary"} disabled={restoring} onClick={() => void action(restore)}>
          {restoring ? "Restoring…" : replace ? "Replace library" : "Merge library"}</button></footer>
    </Modal>}
    {dialog === "add-to-set" && song && <Modal title="Add to setlist" close={() => setDialog(null)}>
      {!sets.length && <p>Create a setlist from the library first.</p>}
      <div className="set-picker">{sets.map(set => <button key={set.id} onClick={() => void action(async () => {
        await writeSet({ ...set, entries: [...set.entries, { id: nil, song_id: song.id, transpose: null, capo: null }] });
        setNotice("Added to " + set.title); setDialog(null);
      })}><ListMusic size={18}/>{set.title}<Plus size={16}/></button>)}</div>
    </Modal>}
    {dialog === "delete-song" && song && <Modal title="Delete song?" close={() => setDialog(null)}>
      <p>{song.title} will be removed from your library and all setlists.</p>
      <footer><button onClick={() => setDialog(null)}>Cancel</button><button className="danger" onClick={() => void action(async () => {
        await invoke("delete_song", { id: song.id }); ++selection.current; setSong(null);
        setEntryId(null); setSurface("library"); setDialog(null); await refresh();
      })}>Delete song</button></footer>
    </Modal>}
    {dialog === "delete-set" && currentSet && <Modal title="Delete setlist?" close={() => setDialog(null)}>
      <p>{currentSet.title} will be removed.</p><footer><button onClick={() => setDialog(null)}>Cancel</button>
        <button className="danger" onClick={() => void action(async () => {
          await invoke("delete_set", { id: currentSet.id }); setSetId(null); setEntryId(null); setDialog(null); await refresh();
        })}>Delete setlist</button></footer>
    </Modal>}

    {printSet && currentSet && <section className="print-set"><h1>{currentSet.title}</h1>
      {currentSet.date && <p>{currentSet.date.slice(0,10)}</p>}<ol>{currentSet.entries.map(e => <li key={e.id}>{lookup.get(e.song_id)?.title}</li>)}</ol>
    </section>}
  </div></DialogError.Provider>;
}
