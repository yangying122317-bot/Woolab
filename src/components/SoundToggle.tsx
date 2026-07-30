import { useEffect, useState } from "react";
import { isMuted, onMutedChange, setMuted } from "../audio/sfx";

/** 音效开关：小喇叭图标，状态存 localStorage */
export default function SoundToggle() {
  const [muted, setMutedState] = useState(isMuted());

  useEffect(() => onMutedChange(setMutedState), []);

  return (
    <button
      onClick={() => setMuted(!muted)}
      aria-label={muted ? "开启音效" : "关闭音效"}
      title={muted ? "开启音效" : "关闭音效"}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-neutral-700 shadow-sm backdrop-blur transition hover:bg-white"
    >
      {muted ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H3v6h3l5 4V5z" />
          <line x1="16" y1="9" x2="21" y2="14" />
          <line x1="21" y1="9" x2="16" y2="14" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H3v6h3l5 4V5z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </svg>
      )}
    </button>
  );
}
