import { useMemo, useState, type ReactNode } from "react";
import { RotateCcw, Search, X } from "lucide-react";
import { IconButton, Modal } from "../components";
import { defaultSettings, type Settings } from "../model";
import { ago, backupHealth } from "../backup/history";
import { categories, clock, entries, groups, matches, type Category, type Group, type SettingEntry, type SettingsContext } from "./catalog";
import { Panel, SettingRow } from "./controls";

const STORE_KEY = "settings-category";

function storedCategory(): Category {
  try {
    const value = localStorage.getItem(STORE_KEY);
    return categories.some(c => c.id === value) ? value as Category : "display";
  } catch {
    return "display";
  }
}

const themeNames: Record<Settings["theme"], string> = { dark: "Studio dark", light: "Daylight", contrast: "High contrast" };
const notationNames: Record<Settings["notation"], string> = { standard: "Letters", nashville: "Nashville", german: "German", latin: "Latin" };

/** One-line state of a category: the tab tooltip and the status bar readout. */
function summary(id: Category, s: Settings, lastExport: number | null): string {
  switch (id) {
    case "display": return themeNames[s.theme] + " · " + (s.layout === "fit" ? "Fit to screen" : "Scroll at " + s.scale + "%");
    case "chords": return notationNames[s.notation] + " · " + (s.key_spelling ? "key spelling on" : "key spelling off");
    case "diagrams": return s.diagram_location === "off" ? "Off" : s.instrument[0].toUpperCase() + s.instrument.slice(1) + (s.left_handed ? " · left handed" : "");
    case "performance": return "Scroll " + clock(s.autoscroll_duration) + " · metronome " + (s.metronome_timeout === "never" ? "runs until stopped" : "stops after 10 s");
    case "controllers": {
      const count = Object.keys(s.keyboard_pedals).length;
      return count ? count + (count === 1 ? " pedal key" : " pedal keys") : "No pedal keys";
    }
    case "library": return lastExport === null ? "Never exported here" : "Exported " + ago(lastExport);
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

interface SettingsWindowProps {
  settings: Settings;
  change: (next: Settings) => void;
  report: (cause: unknown) => void;
  close: () => void;
  library: ReactNode;
  lastExport: number | null;
}

export function SettingsWindow({ settings, change, report, close, library, lastExport }: SettingsWindowProps) {
  const [category, setCategory] = useState<Category>(storedCategory);
  const [query, setQuery] = useState("");
  const ctx: SettingsContext = { settings, change: patch => change({ ...settings, ...patch }), report, library };
  const searching = query.trim().length > 0;
  const found = useMemo(() => searching ? entries.filter(e => matches(e, query)) : [], [searching, query]);
  const active = categories.find(c => c.id === category)!;

  function pick(id: Category) {
    setCategory(id);
    setQuery("");
    try { localStorage.setItem(STORE_KEY, id); } catch { /* remembering the tab is optional */ }
  }

  // In search mode each panel keeps only its matching rows; panels without matches are dropped.
  const panels = searching
    ? groups.map(group => ({ group, rows: found.filter(e => e.group === group.id) })).filter(p => p.rows.length > 0)
    : groups.filter(g => g.category === category).map(group => ({ group, rows: entries.filter(e => e.group === group.id) }));

  return <Modal title="Settings" close={close} className="settings-window">
    <div className="settings-toolbar">
      <nav className="settings-tabs" aria-label="Settings categories">
        {categories.map(({ id, title, icon: Icon }) => <button key={id} type="button" className="settings-tab"
          title={summary(id, settings, lastExport)} aria-current={!searching && id === category ? "page" : undefined} onClick={() => pick(id)}>
          <Icon size={15} aria-hidden="true"/>{title}
          {id === "library" && <i className="led" data-state={backupHealth(lastExport)} aria-hidden="true"/>}
        </button>)}
      </nav>
      <label className="settings-search"><Search size={14} aria-hidden="true"/>
        <input type="search" aria-label="Search settings" placeholder="Search settings" value={query} onChange={e => setQuery(e.target.value)}/>
        {searching && <IconButton label="Clear search" onClick={() => setQuery("")}><X size={13}/></IconButton>}
      </label>
    </div>

    <section className="settings-page" aria-label={searching ? "Search results" : active.title}>
      {searching && panels.length === 0 && <p className="settings-empty">No settings match “{query.trim()}”. Try “pedal”, “flats” or “backup”.</p>}
      <div className="panel-grid">
        {panels.map(({ group, rows }) => <GroupPanel key={group.id} group={group} rows={rows} ctx={ctx} searching={searching}/>)}
      </div>
    </section>

    <div className="settings-status">
      <span><i className="led" data-state="ok" aria-hidden="true"/>Changes save automatically</span>
      <span className="settings-status-readout">{searching ? found.length + (found.length === 1 ? " match" : " matches") : active.title + ": " + summary(category, settings, lastExport)}</span>
    </div>
  </Modal>;
}

function GroupPanel({ group, rows, ctx, searching }: { group: Group; rows: SettingEntry[]; ctx: SettingsContext; searching: boolean }) {
  if (group.bare) return <div className="panel-bare" data-wide={group.wide}>{rows.map(e => <div key={e.id}>{e.render(ctx)}</div>)}</div>;
  const keys = rows.flatMap(e => e.keys);
  const changed = keys.some(key => !same(ctx.settings[key], defaultSettings[key]));
  const crumb = searching ? categories.find(c => c.id === group.category)!.title : undefined;
  const reset = keys.length > 0 && !group.preview
    ? <IconButton label={"Reset " + group.title} disabled={!changed}
        onClick={() => ctx.change(Object.fromEntries(keys.map(key => [key, defaultSettings[key]])) as Partial<Settings>)}><RotateCcw size={13}/></IconButton>
    : undefined;
  return <Panel title={group.title} crumb={crumb} actions={reset} wide={group.wide && !searching}>
    {group.preview ? group.preview(ctx.settings) : rows.map(entry => entry.block
      ? <div key={entry.id} className="panel-block">{entry.render(ctx)}</div>
      : <SettingRow key={entry.id} label={entry.label} hint={entry.hint} wide={entry.wide}>{entry.render(ctx)}</SettingRow>)}
  </Panel>;
}
