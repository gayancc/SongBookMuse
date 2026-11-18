import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowDown, ArrowUp, BookOpen, Check, Copy, Folder as FolderIcon, FolderPlus, GripVertical, ListMusic, ListPlus, Lock, Music2, FileText,
  Pencil, Pin, Plus, Printer, Search, Shuffle, Star, StickyNote, Trash2, X
} from "lucide-react";
import { IconButton } from "./components";
import { duration, type Folder, type SetEntry, type Setlist, type SongSummary } from "./model";

export interface SongSelection { target: Setlist | null; picked: ReadonlySet<string> }
export type LibraryFilter = { kind: "all" } | { kind: "favorites" } | { kind: "folder"; id: string };
const setEntryDrag = "application/x-songbookmuse-set-entry";

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
  /** Switches to the Songs list with checkboxes, ready to add the checked songs to this setlist. */
  addSongs: (set: Setlist) => void;
  /** Checkbox selection over the Songs list; null when the list opens songs on click. */
  selection: SongSelection | null;
  setPicked: (ids: ReadonlySet<string>) => void;
  /** Adds the checked songs to the selection's setlist, or asks which setlist from the given point. */
  commitSelection: (x: number, y: number) => void;
  cancelSelection: () => void;
  /** Right-click on a library song row. */
  songMenu: (song: SongSummary, x: number, y: number) => void;
  dropFiles: (files: File[]) => void;
}

const keyHue = (key: string): number => {
  const roots = "C D EF G A B";
  const index = roots.indexOf(key.charAt(0).toUpperCase());
  return index < 0 ? -1 : (index * 30 + (key.includes("m") && !key.includes("maj") ? 15 : 0)) % 360;
};

interface SongRowProps {
  item: SongSummary;
  active: boolean;
  open: (event: React.MouseEvent) => void;
  menu: (x: number, y: number) => void;
  /** Present while the list is in checkbox mode. */
  checked?: boolean;
  /** Already an item of the setlist being filled. */
  inSet?: boolean;
}

function SongRow({ item, active, open, menu, checked, inSet }: SongRowProps) {
  const hue = keyHue(item.key);
  const selecting = checked !== undefined;
  return <button className="song-row" aria-current={active && !selecting ? "true" : undefined} onClick={open}
    role={selecting ? "checkbox" : undefined} aria-checked={selecting ? checked : undefined} data-checked={checked || undefined}
    onContextMenu={event => {
      event.preventDefault();
      // The Menu key and Shift+F10 also raise contextmenu; anchor those beside the row instead of at 0,0.
      const box = event.currentTarget.getBoundingClientRect();
      const keyboard = event.clientX === 0 && event.clientY === 0;
      menu(keyboard ? box.left + 24 : event.clientX, keyboard ? box.top + box.height / 2 : event.clientY);
    }}
    style={hue >= 0 ? { "--row-hue": hue } as React.CSSProperties : undefined} data-keyed={hue >= 0}>
    <span className="row-strip" aria-hidden="true"/>
    {selecting && <span className="row-check" aria-hidden="true">{checked && <Check size={12} strokeWidth={3}/>}</span>}
    {item.number > 0 ? <span className="row-number">{item.number}</span> :
      item.kind === "Chord sheet" ? <Music2 size={15}/> : <FileText size={15}/>}
    <span className="row-text"><strong>{item.title}</strong><small>{item.artist || item.kind}</small></span>
    {selecting && inSet && <span className="row-in-set">In set</span>}
    {item.locked && <Lock size={12} aria-label="Locked"/>}
    {item.favorite && <Star size={12} aria-label="Favorite" className="row-star"/>}
    {item.key && <span className="key-chip">{item.key}</span>}
  </button>;
}

type DropSide = "before" | "after";
interface DragState { set: string; entry: string; over: string | null; side: DropSide }

interface SetEntryRowProps {
  set: Setlist;
  entry: SetEntry;
  index: number;
  props: BrowserProps;
  drag: DragState | null;
  setDrag: Dispatch<SetStateAction<DragState | null>>;
}

function SetEntryRow({ set, entry, index, props, drag, setDrag }: SetEntryRowProps) {
  const song = props.lookup.get(entry.song_id);
  const label = entry.note != null ? entry.note.split("\n")[0] || "Note" : song?.title ?? "Unavailable song";
  const shift = entry.transpose ?? 0;
  const dragging = drag?.set === set.id && drag.entry === entry.id;
  const target = drag?.set === set.id && drag.over === entry.id && !dragging ? drag.side : undefined;
  /** Marks this row as the drop target, on the half the pointer is over. Runs on enter too: dragover can lag a fast move. */
  const track = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(setEntryDrag) || drag?.set !== set.id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const box = event.currentTarget.getBoundingClientRect();
    const side: DropSide = event.clientY < box.top + box.height / 2 ? "before" : "after";
    setDrag(current => current && (current.over !== entry.id || current.side !== side) ? { ...current, over: entry.id, side } : current);
  };
  return <div className="set-entry" data-note={entry.note != null} data-dragging={dragging || undefined} data-drop={target}
    draggable
    onDragStart={event => {
      event.dataTransfer.setData(setEntryDrag, set.id + ":" + entry.id);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setDragImage(event.currentTarget, 12, event.currentTarget.offsetHeight / 2);
      setDrag({ set: set.id, entry: entry.id, over: null, side: "before" });
    }}
    onDragEnd={() => setDrag(null)}
    onDragEnter={track}
    onDragOver={track}
    onDrop={event => {
      if (!event.dataTransfer.types.includes(setEntryDrag)) return;
      event.preventDefault();
      event.stopPropagation();
      const [setId, entryId] = event.dataTransfer.getData(setEntryDrag).split(":");
      setDrag(null);
      if (setId !== set.id) return;
      const from = set.entries.findIndex(item => item.id === entryId);
      const box = event.currentTarget.getBoundingClientRect();
      let to = event.clientY < box.top + box.height / 2 ? index : index + 1;
      if (from < to) to -= 1;
      if (from >= 0 && from !== to) props.moveEntry(from, to - from);
    }}>
    <button aria-current={props.entryId === entry.id ? "true" : undefined} onClick={() => props.openEntry(set, entry)}>
      <span className="set-entry-handle" aria-hidden="true" title="Drag to reorder"><GripVertical size={13}/></span>
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
  const [drag, setDrag] = useState<DragState | null>(null);
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
              <IconButton label="Add songs" onClick={() => props.addSongs(set)}><ListPlus size={14}/></IconButton>
              <IconButton label="Add note item" onClick={props.addNote}><StickyNote size={14}/></IconButton>
              <IconButton label="Shuffle order" disabled={set.entries.length < 2} onClick={() => props.shuffle(set)}><Shuffle size={14}/></IconButton>
              <IconButton label="Duplicate setlist" onClick={() => props.duplicateSet(set)}><Copy size={14}/></IconButton>
              <IconButton label="Print setlist" onClick={props.printSet}><Printer size={14}/></IconButton>
              <IconButton label="Delete setlist" onClick={props.deleteSet}><Trash2 size={14}/></IconButton>
            </div>
            <div className="set-entries" data-dragging={drag?.set === set.id || undefined} onDragLeave={event => {
              // relatedTarget is null for HTML drag events in WebView2, so test the pointer against the list bounds.
              const box = event.currentTarget.getBoundingClientRect();
              const inside = event.clientX > box.left && event.clientX < box.right && event.clientY > box.top && event.clientY < box.bottom;
              if (!inside) setDrag(current => current && current.over ? { ...current, over: null } : current);
            }}>
              {set.entries.map((e, i) => <SetEntryRow key={e.id} set={set} entry={e} index={i} props={props} drag={drag} setDrag={setDrag}/>)}
              {!set.entries.length && <p className="list-empty">Choose Add songs, or right-click a song in Songs and send it here.</p>}
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
  const { filter, selection } = props;
  const anchor = useRef<number | null>(null);
  const allShown = props.songs.length > 0 && props.songs.every(s => selection?.picked.has(s.id));

  /** Click checks or unchecks one song; Shift+click checks the range from the last clicked song. */
  function toggle(index: number, range: boolean) {
    if (!selection) return;
    const next = new Set(selection.picked);
    const id = props.songs[index].id;
    if (range && anchor.current != null && anchor.current < props.songs.length) {
      const [from, to] = [Math.min(anchor.current, index), Math.max(anchor.current, index)];
      props.songs.slice(from, to + 1).forEach(s => next.add(s.id));
    } else if (next.has(id)) next.delete(id);
    else next.add(id);
    anchor.current = index;
    props.setPicked(next);
  }

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
    <div className="browser-scroll" data-selecting={selection ? "true" : undefined}>
      {props.songs.map((item, index) => <SongRow key={item.id} item={item} active={props.activeSong === item.id}
        checked={selection ? selection.picked.has(item.id) : undefined}
        inSet={Boolean(selection?.target?.entries.some(e => e.song_id === item.id))}
        open={event => selection ? toggle(index, event.shiftKey) : props.openSong(item.id)}
        menu={(x, y) => props.songMenu(item, x, y)}/>)}
      {props.loaded && !props.songs.length && <p className="list-empty">
        {props.hasSongs ? (filter.kind === "folder" ? "This folder is empty. Add songs from Song details." : "No matching songs") : "Import chord sheets, PDFs or images to start your songbook."}</p>}
    </div>
    {selection ? <div className="selection-bar" role="toolbar" aria-label="Song selection">
      <div className="selection-info">
        <label className="selection-all"><input type="checkbox" aria-label="Select all shown songs" checked={allShown}
          disabled={!props.songs.length} onChange={() => {
            const next = new Set(selection.picked);
            props.songs.forEach(s => allShown ? next.delete(s.id) : next.add(s.id));
            props.setPicked(next);
          }}/>{selection.picked.size} selected</label>
        {selection.target && <span className="selection-target" title={selection.target.title}>to {selection.target.title}</span>}
      </div>
      <div className="selection-actions">
        <button type="button" onClick={props.cancelSelection}>Cancel</button>
        <button type="button" className="primary" disabled={!selection.picked.size}
          onClick={event => {
            const box = event.currentTarget.getBoundingClientRect();
            props.commitSelection(box.left, box.top);
          }}>{selection.target ? (selection.picked.size === 1 ? "Add 1 song" : "Add " + selection.picked.size + " songs") : "Send to setlist..."}</button>
      </div>
    </div> :
    <div className="browser-footer">{props.songs.length.toLocaleString()} {props.songs.length === 1 ? "song" : "songs"}</div>}
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
