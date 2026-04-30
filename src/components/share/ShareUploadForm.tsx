"use client";

import { ArrowLeft, Check, Code, Copy, FileText, Lock, Share2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { createSharedFile } from "@/lib/share/actions";

type Tab = "html_file" | "html_raw" | "pdf";

export function ShareUploadForm() {
  const [tab, setTab] = useState<Tab>("html_file");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rawHtml, setRawHtml] = useState("");
  const [pwd, setPwd] = useState("");
  const [expiry, setExpiry] = useState<"never" | "24h" | "7d" | "30d">("never");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; password?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const dragRef = useRef(false);
  const [drag, setDrag] = useState(false);

  function pickName(f: File): string {
    return f.name.replace(/\.[^.]+$/, "");
  }

  function onSubmit() {
    setError(null);
    start(async () => {
      try {
        const payload =
          tab === "html_raw"
            ? rawHtml
            : file;
        if (!payload) throw new Error(tab === "html_raw" ? "Paste HTML first" : "Pick a file first");
        const t = title.trim() || (file ? pickName(file) : "Shared file");
        const out = await createSharedFile({
          title: t,
          kind: tab,
          payload: payload as File | string,
          password: pwd || undefined,
          expiresIn: expiry,
        });
        const origin = window.location.origin;
        setResult({
          url: `${origin}/s/${out.slug}`,
          password: out.password,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function copyUrl() {
    if (!result) return;
    navigator.clipboard?.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function onDropFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const f = files[0];
    setFile(f);
    if (tab === "html_file" && !f.name.toLowerCase().endsWith(".html") && !f.name.toLowerCase().endsWith(".htm")) {
      setTab("pdf");
    }
    if (tab === "pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setTab("html_file");
    }
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))]">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-[920px] px-6 h-14 flex items-center gap-3">
          <a href="/" className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-[13px]">
            <ArrowLeft className="w-4 h-4" /> Library
          </a>
          <span className="font-medium tracking-tight">Share a file</span>
        </div>
      </header>

      <main className="mx-auto max-w-[920px] px-6 py-10">
        {result ? (
          <div className="panel-card p-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-[rgb(var(--success)/0.12)]">
              <Check className="w-6 h-6 text-[rgb(var(--success))]" />
            </div>
            <h1 className="text-[20px] font-semibold mb-1">Your link is ready</h1>
            <p className="text-[13px] text-foreground/55 mb-5">Anyone with this URL can open it{result.password ? " — they will be prompted for the password" : ""}.</p>
            <div className="flex items-center gap-2 mb-3">
              <input
                readOnly
                value={result.url}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-[13px] font-mono"
              />
              <button
                type="button"
                onClick={copyUrl}
                className="px-3 py-2 rounded-lg bg-[rgb(var(--primary))] text-white text-[13px] font-medium inline-flex items-center gap-1.5"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {result.password && (
              <div className="text-[12px] text-foreground/65 mb-5 inline-flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Password: <code className="bg-[rgb(var(--fg)/0.06)] px-1.5 py-0.5 rounded font-mono">{result.password}</code>
              </div>
            )}
            <div className="flex gap-2">
              <a href="/" className="px-4 py-2 rounded-lg border border-border text-[13px] hover:bg-[rgb(var(--fg)/0.04)]">Back to library</a>
              <button
                type="button"
                onClick={() => { setResult(null); setFile(null); setRawHtml(""); setPwd(""); setTitle(""); }}
                className="px-4 py-2 rounded-lg bg-[rgb(var(--primary))] text-white text-[13px] font-medium"
              >
                Share another
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-[24px] font-semibold tracking-tight">Share a file</h1>
              <p className="text-[13px] text-foreground/55 mt-1">
                Upload an existing deck, paste raw HTML, or share a PDF — protected by an optional password and expiry. No AI involved.
              </p>
            </div>

            <div className="panel-card p-5 space-y-5">
              {/* Source tabs */}
              <div className="flex gap-1 p-1 rounded-lg bg-[rgb(var(--fg)/0.04)] w-fit">
                <TabBtn active={tab === "html_file"} onClick={() => setTab("html_file")}><Upload className="w-3.5 h-3.5" /> HTML file</TabBtn>
                <TabBtn active={tab === "pdf"} onClick={() => setTab("pdf")}><FileText className="w-3.5 h-3.5" /> PDF</TabBtn>
                <TabBtn active={tab === "html_raw"} onClick={() => setTab("html_raw")}><Code className="w-3.5 h-3.5" /> Raw HTML</TabBtn>
              </div>

              {/* Source input */}
              {tab === "html_raw" ? (
                <textarea
                  value={rawHtml}
                  onChange={(e) => setRawHtml(e.target.value)}
                  rows={12}
                  placeholder="<!doctype html><html>…"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-[12px] font-mono outline-none focus:border-[rgb(var(--primary))]"
                />
              ) : (
                <div
                  onDragEnter={(e) => { e.preventDefault(); dragRef.current = true; setDrag(true); }}
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => { dragRef.current = false; setDrag(false); }}
                  onDrop={(e) => { e.preventDefault(); setDrag(false); onDropFiles(e.dataTransfer.files); }}
                  className={
                    "rounded-xl border-2 border-dashed p-8 text-center transition-smooth " +
                    (drag ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary)/0.04)]" : "border-border bg-[rgb(var(--fg)/0.02)]")
                  }
                >
                  <Upload className="w-6 h-6 text-foreground/40 mx-auto mb-2" />
                  <p className="text-[13px] mb-1">
                    {file ? <span className="font-medium">{file.name}</span> : "Drop your file here"}
                  </p>
                  <p className="text-[11px] text-foreground/45 mb-3">
                    {tab === "html_file" ? ".html / .htm — served as-is" : ".pdf — embedded full-screen"}
                  </p>
                  <label className="inline-flex items-center px-3 py-1.5 rounded-md border border-border bg-card hover:bg-[rgb(var(--fg)/0.04)] text-[12px] cursor-pointer">
                    Choose file
                    <input
                      type="file"
                      accept={tab === "html_file" ? ".html,.htm,text/html" : ".pdf,application/pdf"}
                      className="hidden"
                      onChange={(e) => onDropFiles(e.target.files)}
                    />
                  </label>
                </div>
              )}

              {/* Title (optional) */}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-foreground/45">Title (optional)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={file ? pickName(file) : "Shared file"}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-card text-[13px] outline-none focus:border-[rgb(var(--primary))]"
                />
              </div>

              {/* Protection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-foreground/45 inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Password (optional)</label>
                  <input
                    type="text"
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    placeholder="Leave empty for public"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-card text-[13px] outline-none focus:border-[rgb(var(--primary))]"
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-foreground/45">Expiry</label>
                  <select
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value as typeof expiry)}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-card text-[13px]"
                  >
                    <option value="never">Never expires</option>
                    <option value="24h">24 hours</option>
                    <option value="7d">7 days</option>
                    <option value="30d">30 days</option>
                  </select>
                </div>
              </div>

              {error && <p className="text-[12px] text-[rgb(var(--error))]">{error}</p>}

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <a href="/" className="px-4 py-2 rounded-lg text-[13px] text-foreground/65 hover:bg-[rgb(var(--fg)/0.04)]">
                  Cancel
                </a>
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={pending || (tab === "html_raw" ? !rawHtml.trim() : !file)}
                  className="px-4 py-2 rounded-lg bg-[rgb(var(--primary))] text-white text-[13px] font-medium inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Share2 className="w-4 h-4" />
                  {pending ? "Creating link…" : "Create share link"}
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3 py-1.5 rounded-md text-[12px] font-medium inline-flex items-center gap-1.5 transition-smooth " +
        (active ? "bg-card shadow-sm text-foreground" : "text-foreground/60 hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}
