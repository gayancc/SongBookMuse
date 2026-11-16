import { useEffect, useState } from "react";
import { decode } from "./commands";
import type { Track } from "./model";

export function BackingTrack({ track, onError }: { track: Track; onError: (message: string) => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(new Blob([decode(track.bytes)], { type: track.mime }));
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [track]);
  return url ? <audio className="backing-player" controls src={url} aria-label={"Backing track: " + track.name}
    onError={() => onError("This webview could not play the selected backing track")}/> : null;
}
