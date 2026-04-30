"use client";

import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink, Lock, Share2, Trash2 } from "lucide-react";
import { createShareLink, revokeShareLink, exportDeckToPdf } from "@/lib/share/actions";

interface ShareLink {
  id: string;
  slug: string;
  password_hash: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface Props {
  deckId: string;
  versionId: string;
  links: ShareLink[];
  hasRender: boolean;
}

export function ShareControls({ deckId, versionId, links, hasRender }: Props) {
  const [pwd, setPwd] = useState("");
  const [expiry, setExpiry] = useState<"24h" | "7d" | "30d" | "never">("never");
  const [pinVersion, setPinVersion] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function origin() {
    return typeof window !== "undefined" ? window.location.origin : "";
  }

  function create() {
    setError(null);
    start(async () => {
      try {
        await createShareLink({
          deckId,
          versionId: pinVersion ? versionId : undefined,
          password: pwd || undefined,
          expiresIn: expiry,
        });
        setPwd("");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function copy(slug: string) {
    const url = `${origin()}/s/${slug}`;
    navigator.clipboard?.writeText(url);
    setCopied(slug);
    setTimeout(() => setCopied(null), 1500);
  }

  function revoke(slug: string) {
    start(async () => {
      try { await revokeShareLink(deckId, slug); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    });
  }

  function exportPdf() {
    setError(null);
    start(async () => {
      try {
        const { url } = await exportDeckToPdf(deckId, versionId);
        setPdfUrl(url);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Create */}
      <div className="panel-card p-4">
        <p className="text-[10px] uppercase tracking-wider text-foreground/40 mb-2 inline-flex items-center gap-1">
          <Share2 className="w-3 h-3" /> New share link
        </p>
        <div className="space-y-2">
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Optional password"
            className="w-full px-2 py-1.5 rounded-md border border-border bg-card text-[12px] outline-none focus:border-[rgb(var(--primary))]"
          />
          <select
            value={expiry}
            onChange={(e) => setExpiry(e.target.value as typeof expiry)}
            className="w-full px-2 py-1.5 rounded-md border border-border bg-card text-[12px]"
          >
            <option value="never">Never expires</option>
            <option value="24h">Expires in 24 hours</option>
            <option value="7d">Expires in 7 days</option>
            <option value="30d">Expires in 30 days</option>
          </select>
          <label className="flex items-center gap-2 text-[11px] text-foreground/65">
            <input type="checkbox" checked={pinVersion} onChange={(e) => setPinVersion(e.target.checked)} />
            Pin to current version (default: always show latest)
          </label>
          <button
            type="button"
            disabled={pending || !hasRender}
            onClick={create}
            className="w-full px-3 py-1.5 rounded-md bg-[rgb(var(--primary))] text-white text-[12px] font-medium disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create link"}
          </button>
          {!hasRender && (
            <p className="text-[10px] text-foreground/40">Render the deck first to share it.</p>
          )}
        </div>
      </div>

      {/* Active links */}
      {links.length > 0 && (
        <div className="panel-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-foreground/40 mb-2 px-1">Links</p>
          <ul className="space-y-1">
            {links.filter((l) => !l.revoked_at).map((link) => {
              const url = `${origin()}/s/${link.slug}`;
              return (
                <li key={link.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[rgb(var(--fg)/0.04)] group">
                  <span className="flex-1 truncate text-[11px] font-mono text-foreground/70">{url}</span>
                  {link.password_hash && <Lock className="w-3 h-3 text-foreground/40" />}
                  <button type="button" onClick={() => copy(link.slug)} className="icon-btn" title="Copy">
                    {copied === link.slug ? <Check className="w-3.5 h-3.5 text-[rgb(var(--success))]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <a href={url} target="_blank" rel="noreferrer" className="icon-btn" title="Open">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button type="button" onClick={() => revoke(link.slug)} className="icon-btn" title="Revoke">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* PDF export */}
      <div className="panel-card p-3">
        <p className="text-[10px] uppercase tracking-wider text-foreground/40 mb-2 px-1">Export</p>
        <button
          type="button"
          disabled={pending || !hasRender}
          onClick={exportPdf}
          className="w-full px-3 py-1.5 rounded-md border border-border text-[12px] font-medium hover:bg-[rgb(var(--fg)/0.04)] disabled:opacity-60"
        >
          {pending ? "Building PDF…" : "Export to PDF"}
        </button>
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block text-center px-3 py-1.5 rounded-md bg-[rgb(var(--success)/0.1)] text-[rgb(var(--success))] text-[11px] font-medium"
          >
            Download PDF
          </a>
        )}
      </div>

      {error && (
        <div className="text-[11px] px-2 py-1.5 rounded-md bg-[rgb(var(--error)/0.08)] border border-[rgb(var(--error)/0.2)] text-[rgb(var(--error))]">
          {error}
        </div>
      )}
    </div>
  );
}
