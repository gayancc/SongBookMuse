import { useRef } from "react";
import { Hash, MessageSquareText, Music, Repeat, Rows3, SquareStack } from "lucide-react";
import { IconButton } from "../components";

/** A ChordPro snippet: text placed before and after the selection, or around a placeholder. */
interface Snippet { label: string; icon: typeof Music; before: string; after: string; placeholder: string }

const snippets: Snippet[] = [
  { label: "Insert chord", icon: Hash, before: "[", after: "]", placeholder: "C" },
  { label: "Insert verse", icon: Rows3, before: "{start_of_verse: Verse}\n", after: "\n{end_of_verse}\n", placeholder: "[C]Lyrics" },
  { label: "Insert chorus", icon: Repeat, before: "{start_of_chorus}\n", after: "\n{end_of_chorus}\n", placeholder: "[G]Lyrics" },
  { label: "Insert bridge", icon: SquareStack, before: "{start_of_bridge}\n", after: "\n{end_of_bridge}\n", placeholder: "[Am]Lyrics" },
  { label: "Insert comment", icon: MessageSquareText, before: "{c: ", after: "}", placeholder: "Comment" },
  { label: "Insert tab", icon: Music, before: "{start_of_tab}\n", after: "\n{end_of_tab}\n", placeholder: "e|---0---|" },
];

/** Counts lines and chord brackets so the panel bar can show the size of the chart at a glance. */
export function sourceStats(source: string) {
  const lines = source ? source.split("\n").length : 0;
  const chords = (source.match(/\[[^\]*\n][^\]\n]*\]/g) ?? []).length;
  return lines + (lines === 1 ? " line" : " lines") + " · " + chords + (chords === 1 ? " chord" : " chords");
}

export function SourceEditor({ value, onChange, stats }: { value: string; onChange: (value: string) => void; stats?: string }) {
  const area = useRef<HTMLTextAreaElement>(null);

  function insert({ before, after, placeholder }: Snippet) {
    const field = area.current;
    if (!field) return;
    const { selectionStart: start, selectionEnd: end } = field;
    const selected = value.slice(start, end) || placeholder;
    // Block snippets start on their own line.
    const lead = before.endsWith("\n") && start > 0 && value[start - 1] !== "\n" ? "\n" : "";
    const next = value.slice(0, start) + lead + before + selected + after + value.slice(end);
    onChange(next);
    const from = start + lead.length + before.length;
    requestAnimationFrame(() => { field.focus(); field.setSelectionRange(from, from + selected.length); });
  }

  return <div className="source-editor">
    <div className="source-tools" role="toolbar" aria-label="ChordPro">
      {snippets.map(snippet => <IconButton key={snippet.label} label={snippet.label} onClick={() => insert(snippet)}>
        <snippet.icon size={13}/><span>{snippet.label.replace("Insert ", "")}</span></IconButton>)}
      {stats && <span className="source-stats">{stats}</span>}
    </div>
    <textarea ref={area} id="song-source" aria-label="Source" spellCheck={false} value={value} onChange={e => onChange(e.target.value)}
      placeholder={"{start_of_verse: Verse 1}\n[Am]Put a chord in brackets before the [F]syllable\n{end_of_verse}"}/>
  </div>;
}
