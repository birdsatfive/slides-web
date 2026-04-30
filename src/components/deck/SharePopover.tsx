"use client";

import { useEffect, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import { ShareControls } from "@/components/deck/ShareControls";

interface ShareLink {
  id: string; slug: string; password_hash: string | null;
  expires_at: string | null; revoked_at: string | null; created_at: string;
}

interface Props {
  deckId: string;
  versionId: string;
  links: ShareLink[];
  hasRender: boolean;
}

export function SharePopover({ deckId, versionId, links, hasRender }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const liveCount = links.filter((l) => !l.revoked_at).length;

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          "px-3 py-1.5 rounded-md text-[12px] inline-flex items-center gap-1.5 transition-smooth " +
          (open
            ? "bg-[rgb(var(--primary))] text-white"
            : "bg-[rgb(var(--primary))] text-white hover:opacity-90")
        }
      >
        <Share2 className="w-3.5 h-3.5" />
        Share
        {liveCount > 0 && (
          <span className="ml-1 px-1.5 rounded-full bg-white/25 text-[10px] tabular-nums leading-4">
            {liveCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-40 w-[360px] panel-card p-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
          <ShareControls
            deckId={deckId}
            versionId={versionId}
            links={links}
            hasRender={hasRender}
          />
        </div>
      )}
    </div>
  );
}
