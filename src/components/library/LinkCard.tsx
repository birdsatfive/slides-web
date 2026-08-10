"use client";

import { Check, Copy, ExternalLink, Eye, Lock, Ban } from "lucide-react";
import { useState, useTransition } from "react";
import { revokeShareLink } from "@/lib/share/actions";

interface Props {
  fileId: string;
  slug: string;
  createdAt: string;
  revokedAt: string | null;
  expiresAt: string | null;
  hasPassword: boolean;
  views: number;
}

export function LinkCard({ fileId, slug, createdAt, revokedAt, expiresAt, hasPassword, views }: Props) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const expired = Boolean(expiresAt && new Date(expiresAt) < new Date());
  const live = !revokedAt && !expired;

  function onCopy() {
    navigator.clipboard?.writeText(`${window.location.origin}/s/${slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function onRevoke() {
    if (!window.confirm("Revoke this link? Anyone holding it loses access immediately.")) return;
    start(async () => {
      try { await revokeShareLink(fileId, slug); }
      catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    });
  }

  return (
    <div className="panel-card p-4 flex items-center gap-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[13px] truncate">/s/{slug}</p>
        <p className="text-[11px] text-foreground/45 mt-0.5">
          {live ? "Live" : revokedAt ? "Revoked" : "Expired"}
          {" · "}created {new Date(createdAt).toLocaleDateString()}
          {expiresAt ? ` · expires ${new Date(expiresAt).toLocaleDateString()}` : ""}
          {hasPassword ? " · password protected" : ""}
        </p>
        {error && <p className="mt-1 text-[10px] text-[rgb(var(--error))]">{error}</p>}
      </div>

      <span className="inline-flex items-center gap-1 text-[12px] text-foreground/60 tabular-nums">
        <Eye className="w-3.5 h-3.5 text-foreground/35" /> {views}
      </span>
      {hasPassword && <Lock className="w-3.5 h-3.5 text-foreground/35" />}

      {live && (
        <>
          <button type="button" onClick={onCopy} className="btn-secondary btn-sm">
            {copied ? <Check className="w-3.5 h-3.5 text-[rgb(var(--success))]" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy link"}
          </button>
          <a href={`/s/${slug}`} target="_blank" rel="noreferrer" className="btn-primary">
            <ExternalLink className="w-3.5 h-3.5" /> Open
          </a>
          <button
            type="button"
            onClick={onRevoke}
            disabled={pending}
            title="Revoke this link"
            className="w-8 h-8 rounded-md inline-flex items-center justify-center text-foreground/45 hover:text-[rgb(var(--error))] hover:bg-[rgb(var(--error)/0.08)] transition-smooth disabled:opacity-60"
          >
            <Ban className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
