"use client";

import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  FolderTree,
  Link2,
  Lock,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useState, useTransition } from "react";
import { AppSwitcher } from "@/components/layout/AppSwitcher";
import { deleteSharedFile } from "@/lib/share/actions";
import { fileKindLabel, type FileKind } from "@/lib/share/kind";

export interface SharedFileRow {
  id: string;
  title: string;
  updated_at: string;
  kind: FileKind;
  /** Files inside a folder share; null for single files. */
  file_count: number | null;
  /** Slug of the current live link, or null once every link is dead. */
  slug: string | null;
  protected: boolean;
  expires_at: string | null;
  live: boolean;
  total_views: number;
}

interface Props {
  files: SharedFileRow[];
  userName: string;
  userEmail: string;
}

export function FileLibrary({ files, userName, userEmail }: Props) {
  const [query, setQuery] = useState("");

  const filtered = files.filter((f) =>
    f.title.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1400px] px-6 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #76195c, #5e0842)" }}
            >
              <Link2 className="w-4 h-4 text-white" strokeWidth={2.25} />
            </div>
            <span className="font-semibold tracking-tight">Share</span>
          </div>
          <span className="ml-auto text-foreground/65 text-[12px] truncate max-w-[180px]" title={userEmail}>
            {userName || userEmail}
          </span>
          <AppSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight">Shared files</h1>
            <p className="text-[13px] text-foreground/50 mt-1">
              Everything your team has put behind a link.
            </p>
          </div>
          <a href="/share/new" className="btn-primary">
            <Upload className="w-4 h-4" />
            Share a file
          </a>
        </div>

        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files…"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-[13px] outline-none focus:border-[rgb(var(--primary))] focus:ring-2 focus:ring-[rgb(var(--primary)/0.2)] transition-smooth"
          />
        </div>

        {filtered.length === 0 ? <EmptyState searching={query.length > 0} /> : <FileTable files={filtered} />}
      </main>
    </div>
  );
}

function FileTable({ files }: { files: SharedFileRow[] }) {
  return (
    <div className="panel-card overflow-hidden">
      <table className="w-full text-[13px]">
        <thead className="bg-[rgb(var(--fg)/0.03)] text-foreground/55">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">File</th>
            <th className="text-left px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider w-[220px]">Link</th>
            <th className="text-right px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider w-[80px]">Views</th>
            <th className="text-right px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider w-[120px]">Updated</th>
            <th className="w-[220px] px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <FileTr key={file.id} file={file} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FileTr({ file }: { file: SharedFileRow }) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icon = file.kind === "folder" ? FolderTree : FileText;

  function onDelete() {
    if (!window.confirm(`Delete "${file.title}"? The link stops working immediately.`)) return;
    start(async () => {
      try { await deleteSharedFile(file.id); }
      catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    });
  }

  function onCopy() {
    if (!file.slug) return;
    navigator.clipboard?.writeText(`${window.location.origin}/s/${file.slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <tr className="border-t border-border/60 group hover:bg-[rgb(var(--primary)/0.04)] transition-smooth">
      <td className="px-4 py-3">
        <a href={`/f/${file.id}`} className="inline-flex items-center gap-2.5 max-w-full">
          <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-[rgb(var(--primary)/0.12)]">
            <Icon className="w-3.5 h-3.5 text-[rgb(var(--primary))]" />
          </div>
          <span className="min-w-0">
            <span className="font-medium truncate group-hover:text-foreground block">{file.title}</span>
            <span className="text-[11px] text-foreground/45">
              {fileKindLabel(file.kind)}
              {file.file_count ? ` · ${file.file_count} files` : ""}
            </span>
          </span>
        </a>
        {error && <p className="mt-1 text-[10px] text-[rgb(var(--error))]">{error}</p>}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1">
          {file.live ? <Pill tone="success">Live</Pill> : <Pill tone="muted">Link off</Pill>}
          {file.protected && (
            <Pill tone="primary">
              <Lock className="w-2.5 h-2.5" /> Password
            </Pill>
          )}
          {file.live && file.expires_at && (
            <Pill tone="muted">Until {new Date(file.expires_at).toLocaleDateString()}</Pill>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-foreground/70">
        {file.total_views > 0 ? (
          <span className="inline-flex items-center gap-1 text-foreground/75">
            <Eye className="w-3 h-3 text-foreground/40" />
            {file.total_views}
          </span>
        ) : (
          <span className="text-foreground/30">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-foreground/55 whitespace-nowrap">
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3 h-3 text-foreground/30" />
          {fmtDate(file.updated_at)}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-1">
          {file.slug && (
            <>
              <button type="button" onClick={onCopy} className="btn-secondary btn-sm whitespace-nowrap">
                {copied ? <Check className="w-3.5 h-3.5 text-[rgb(var(--success))]" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy link"}
              </button>
              <a
                href={`/s/${file.slug}`}
                target="_blank"
                rel="noreferrer"
                title="Open the shared link"
                className="w-7 h-7 rounded-md inline-flex items-center justify-center text-foreground/45 hover:text-foreground hover:bg-[rgb(var(--fg)/0.06)] transition-smooth"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </>
          )}
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            title="Delete file"
            className="w-7 h-7 rounded-md inline-flex items-center justify-center text-foreground/45 hover:text-[rgb(var(--error))] hover:bg-[rgb(var(--error)/0.08)] opacity-0 group-hover:opacity-100 transition-smooth disabled:opacity-60"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function Pill({ tone, children }: { tone: "muted" | "primary" | "success"; children: React.ReactNode }) {
  const styles = {
    muted:   { bg: "rgb(var(--fg) / 0.07)", color: "rgb(var(--fg) / 0.55)" },
    primary: { bg: "rgb(var(--primary) / 0.14)", color: "rgb(var(--primary))" },
    success: { bg: "rgb(var(--success) / 0.14)", color: "rgb(var(--success))" },
  }[tone];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ background: styles.bg, color: styles.color }}
    >
      {children}
    </span>
  );
}

function fmtDate(s: string): string {
  const d = new Date(s);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

function EmptyState({ searching }: { searching: boolean }) {
  if (searching) {
    return (
      <div className="panel-card p-10 text-center text-[13px] text-foreground/50">
        No file matches that search.
      </div>
    );
  }
  return (
    <div className="panel-card p-12 flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg, #76195c, #5e0842)" }}>
        <Link2 className="w-6 h-6 text-white" strokeWidth={2} />
      </div>
      <h2 className="text-[16px] font-semibold mb-1">Nothing shared yet</h2>
      <p className="text-[13px] text-foreground/50 mb-6 max-w-md">
        Drop in an HTML file, a whole folder of pages, or a PDF. You get a link
        that opens in any browser, with an optional password and expiry.
      </p>
      <a href="/share/new" className="btn-primary">
        <Upload className="w-4 h-4" />
        Share your first file
      </a>
    </div>
  );
}
