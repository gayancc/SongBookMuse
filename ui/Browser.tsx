import {
  ArrowDown, ArrowUp, BookOpen, Copy, Folder as FolderIcon, FolderPlus, ListMusic, Lock, Music2, FileText,
  Pencil, Pin, Plus, Printer, Search, Shuffle, Star, StickyNote, Trash2, X
} from "lucide-react";
import { IconButton } from "./components";
import { duration, type Folder, type SetEntry, type Setlist, type SongSummary } from "./model";

export type LibraryFilter = { kind: "all" } | { kind: "favorites" } | { kind: "folder"; id: string };

interface BrowserProps {
  mode: "songs" | "sets";
  setMode: (mode: "songs" | "sets") => void;
  search: string;
  setSearch: (value: string) => void;
  songs: SongSummary[];
  hasSongs: boolean;
  loaded: boolean;
  busy: boolean;
  folders: Folder[];
  filter: LibraryFilter;
  setFilter: (filter: LibraryFilter) => void;
  sort: string;
  setSort: (sort: string) => void;
  activeSong: string | null;
  openSong: (id: string) => void;
  newSong: () => void;
  newFolder: () => void;
  renameFolder: (folder: Folder) => void;
  deleteFolder: (folder: Folder) => void;
  sets: Setlist[];
  lookup: Map<string, SongSummary>;
  setId: string | null;
  entryId: string | null;
  toggleSet: (id: string) => void;
  openEntry: (set: Setlist, entry: SetEntry) => void;
  newSet: () => void;
  editSet: (set: Setlist) => void;
  duplicateSet: (set: Setlist) => void;
  printSet: () => void;
  deleteSet: () => void;
  moveEntry: (index: number, direction: number) => void;
  removeEntry: (set: Setlist, entry: SetEntry) => void;
  addNote: () => void;
  shuffle: (set: Setlist) => void;
  dropFiles: (files: File[]) => void;
}

const keyHue = (key: string): number => {
  const roots = "C D EF G A B";
  const index = roots.indexOf(key.charAt(0).toUpperCase());
  return index < 0 ? -1 : (index * 30 + (key.includes("m") && !key.includes("maj") ? 15 : 0)) % 360;
};

function SongRow({ item, active, open }: { item: SongSummary; active: boolean; open: () => void }) {
  const hue = keyHue(item.key);
  return <button className="song-row" aria-current={active ? "true" : undefined} onClick={open}
    style={hue >= 0 ? { "--row-hue": hue } as React.CSSProperties : undefined} data-keyed={hue >= 0}>
    <span className="row-strip" aria-hidden="true"/>
    {item.number > 0 ? <span className="row-number">{item.number}</span> :
      item.kind === "Chord sheet" ? <Music2 size={15}/> : <FileText size={15}/>}
    <span className="row-text"><strong>{item.title}</strong><small>{item.artist || item.kind}</small></span>
    {item.locked && <Lock size={12} aria-label="Locked"/>}
    {item.favorite && <Star size={12} aria-label="Favorite" className="row-star"/>}
    {item.key && <span className="key-chip">{item.key}</span>}
  </button>;
}

function SetEntryRow({ set, entry, index, props }: { set: Setlist; entry: SetEntry; index: number; props: BrowserProps }) {
  const song = props.lookup.get(entry.song_id);
  const label = entry.note != null ? entry.note.split("\n")[0] || "Note" : song?.title ?? "Unavailable song";
  const shift = entry.transpose ?? 0;
  return <div className="set-entry" data-note={entry.note != null}>
    <button aria-current={props.entryId === entry.id ? "true" : undefined} onClick={() => props.openEntry(set, entry)}>
      <span className="step-index">{index + 1}</span>
      {entry.note != null && <StickyNote size={13}/>}
      <span className="entry-title">{label}</span>
      {shift !== 0 && <span className="key-chip">{shift > 0 ? "+" : ""}{shift}</span>}
    </button>
    <IconButton label={"Move item " + (index + 1) + " up"} disabled={index === 0} onClick={() => props.moveEntry(index, -1)}><ArrowUp size={13}/></IconButton>
    <IconButton label={"Move item " + (index + 1) + " down"} disabled={index === set.entries.length - 1} onClick={() => props.moveEntry(index, 1)}><ArrowDown size={13}/></IconButton>
    <IconButton label={"Remove item " + (index + 1)} onClick={() => props.removeEntry(set, entry)}><X size={13}/></IconButton>
  </div>;
}

function SetsView(props: BrowserProps) {
  const query = props.search.toLowerCase();
  const sets = props.sets.filter(s => s.title.toLowerCase().includes(query));
  return <>
    <div className="browser-scroll">
      {sets.map(set => {
        const total = set.entries.reduce((sum, e) => sum + (props.lookup.get(e.song_id)?.duration ?? 0), 0);
        const songs = set.entries.filter(e => e.note == null).length;
        return <section key={set.id} className="set-group">
          <button className="song-row set-row" aria-expanded={set.id === props.setId} onClick={() => props.toggleSet(set.id)}>
            <span className="row-strip" aria-hidden="true"/>
            <ListMusic size={15}/>
            <span className="row-text"><strong>{set.title}</strong>
              <small>{songs} {songs === 1 ? "song" : "songs"} · {duration(total)}{set.date ? " · " + set.date.slice(0, 10) : ""}</small></span>
            {set.pinned && <Pin size={12} aria-label="Pinned"/>}
          </button>
          {set.id === props.setId && <>
            <div className="set-tools" role="toolbar" aria-label="Setlist tools">
              <IconButton label="Edit setlist" onClick={() => props.editSet(set)}><Pencil size={14}/></IconButton>
              <IconButton label="Add note item" onClick={props.addNote}><StickyNote size={14}/></IconButton>
              <IconButton label="Shuffle order" disabled={set.entries.length < 2} onClick={() => props.shuffle(set)}><Shuffle size={14}/></IconButton>
              <IconButton label="Duplicate setlist" onClick={() => props.duplicateSet(set)}><Copy size={14}/></IconButton>
              <IconButton label="Print setlist" onClick={props.printSet}><Printer size={14}/></IconButton>
              <IconButton label="Delete setlist" onClick={props.deleteSet}><Trash2 size={14}/></IconButton>
            </div>
            <div className="set-entries">
              {set.entries.map((e, i) => <SetEntryRow key={e.id} set={set} entry={e} index={i} props={props}/>)}
              {!set.entries.length && <p className="list-empty">Open a song and choose Add to setlist.</p>}
            </div>
          </>}
        </section>;
      })}
      {props.loaded && !props.sets.length && <p className="list-empty">Create a setlist to arrange songs for a performance.</p>}
    </div>
    <div className="browser-footer">{props.sets.length} {props.sets.length === 1 ? "setlist" : "setlists"}</div>
  </>;
}

function SongsView(props: BrowserProps) {
  const { filter } = props;
  const isFolder = (id: string) => filter.kind === "folder" && filter.id === id;
  return <>
    <div className="browser-tree" role="group" aria-label="Collections">
      <button className="tree-item" aria-pressed={filter.kind === "all"} onClick={() => props.setFilter({ kind: "all" })}><BookOpen size={14}/>All songs</button>
      <button className="tree-item" aria-pressed={filter.kind === "favorites"} onClick={() => props.setFilter({ kind: "favorites" })}><Star size={14}/>Favorites</button>
      {props.folders.map(folder => <div className="tree-folder" key={folder.id}>
        <button className="tree-item" aria-pressed={isFolder(folder.id)} onClick={() => props.setFilter({ kind: "folder", id: folder.id })}>
          <FolderIcon size={14}/><span>{folder.name}</span></button>
        {isFolder(folder.id) && <>
          <IconButton label={"Rename folder " + folder.name} onClick={() => props.renameFolder(folder)}><Pencil size={12}/></IconButton>
          <IconButton label={"Delete folder " + folder.name} onClick={() => props.deleteFolder(folder)}><Trash2 size={12}/></IconButton>
        </>}
      </div>)}
      <button className="tree-item tree-add" onClick={props.newFolder}><FolderPlus size={14}/>New folder</button>
    </div>
    <div className="browser-filters">
      <label className="inline-select">Sort
        <select aria-label="Sort songs" value={props.sort} onChange={e => props.setSort(e.target.value)}>
          <option value="title">Title</option><option value="artist">Artist</option><option value="number">Number</option><option value="key">Key</option>
        </select></label>
    </div>
    <div className="browser-scroll">
      {props.songs.map(item => <SongRow key={item.id} item={item} active={props.activeSong === item.id} open={() => props.openSong(item.id)}/>)}
      {props.loaded && !props.songs.length && <p className="list-empty">
        {props.hasSongs ? (filter.kind === "folder" ? "This folder is empty. Add songs from Song details." : "No matching songs") : "Import chord sheets, PDFs or images to start your songbook."}</p>}
    </div>
    <div className="browser-footer">{props.songs.length.toLocaleString()} {props.songs.length === 1 ? "song" : "songs"}</div>
  </>;
}

export function Browser(props: BrowserProps) {
  const songs = props.mode === "songs";
  return <aside className="browser" aria-label="Library browser" onDragOver={e => e.preventDefault()} onDrop={e => {
    e.preventDefault();
    if (!props.busy) props.dropFiles(Array.from(e.dataTransfer.files));
  }}>
    <div className="panel-head">
      <nav className="segmented" aria-label="Collection">
        <button onClick={() => { props.setMode("songs"); props.setSearch(""); }} aria-pressed={songs}><BookOpen size={14}/>Songs</button>
        <button onClick={() => { props.setMode("sets"); props.setSearch(""); }} aria-pressed={!songs}><ListMusic size={14}/>Setlists</button>
      </nav>
      <IconButton label={songs ? "New song" : "New setlist"} className="icon-button accent" onClick={songs ? props.newSong : props.newSet}><Plus size={16}/></IconButton>
    </div>
    <label className="search"><Search size={14}/><input type="search" aria-label={songs ? "Search songs" : "Search setlists"}
      placeholder={songs ? "Search titles, artists, lyrics" : "Search setlists"} value={props.search} onChange={e => props.setSearch(e.target.value)}/></label>
    {songs ? <SongsView {...props}/> : <SetsView {...props}/>}
  </aside>;
}
