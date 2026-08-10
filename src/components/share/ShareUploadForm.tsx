"use client";

import { ArrowLeft, Check, Clock, Code, Copy, ExternalLink, FileText, FolderTree, Lock, Share2, Sparkles, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { createBundleShare, createSharedFile, uploadBundleFile } from "@/lib/share/actions";

type Tab = "html_file" | "html_raw" | "pdf" | "folder";

interface ShareResult {
  url: string;
  password?: string;
  title: string;
  kind: Tab;
  expiry: "never" | "24h" | "7d" | "30d";
  fileCount?: number;
}

interface BundleFile {
  /** Path relative to the folder root, e.g. `assets/img/hero.jpg`. */
  path: string;
  file: File;
}

/** Editor droppings and dependency folders never belong in a share. */
const IGNORED = /(^|\/)(\.[^/]+|__MACOSX|node_modules)(\/|$)/;

/** Concurrent uploads — enough to keep a folder quick, gentle on storage. */
const UPLOAD_LANES = 4;

/**
 * Drop the wrapper directory the picker prepends ("Oterra/index.html"), so
 * the entry document sits at the bundle root. Repeats while the whole
 * selection still shares one top-level folder.
 */
function stripCommonRoot(items: BundleFile[]): BundleFile[] {
  let out = items;
  for (let depth = 0; depth < 5; depth++) {
    if (out.length === 0) return out;
    const [first] = out[0].path.split("/");
    const shared = out.every((i) => {
      const parts = i.path.split("/");
      return parts.length > 1 && parts[0] === first;
    });
    if (!shared) return out;
    out = out.map((i) => ({ ...i, path: i.path.split("/").slice(1).join("/") }));
  }
  return out;
}

function cleanBundle(items: BundleFile[]): BundleFile[] {
  return stripCommonRoot(items.filter((i) => !IGNORED.test(i.path)));
}

/** The page the share opens on: index.html, or the one root-level HTML file. */
function pickEntry(items: BundleFile[]): string | null {
  const roots = items.filter((i) => !i.path.includes("/"));
  const index = roots.find((i) => i.path.toLowerCase() === "index.html");
  if (index) return index.path;
  const htmls = roots.filter((i) => /\.html?$/i.test(i.path));
  return htmls.length === 1 ? htmls[0].path : null;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Walk a dropped directory. `dataTransfer.files` is empty for folders, so the
 * entries API is the only way to read one that was dragged in.
 */
async function readDropEntry(entry: FileSystemEntry, prefix: string, out: BundleFile[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    );
    out.push({ path: prefix + entry.name, file });
    return;
  }
  if (!entry.isDirectory) return;
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  // readEntries returns at most 100 per call — keep reading until it dries up.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (batch.length === 0) return;
    for (const child of batch) {
      await readDropEntry(child, `${prefix}${entry.name}/`, out);
    }
  }
}

export function ShareUploadForm() {
  const [tab, setTab] = useState<Tab>("html_file");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rawHtml, setRawHtml] = useState("");
  const [pwd, setPwd] = useState("");
  const [expiry, setExpiry] = useState<"never" | "24h" | "7d" | "30d">("never");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShareResult | null>(null);
  const [copied, setCopied] = useState<"url" | "password" | null>(null);
  const dragRef = useRef(false);
  const [drag, setDrag] = useState(false);
  const [bundle, setBundle] = useState<BundleFile[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const bundleEntry = bundle.length > 0 ? pickEntry(bundle) : null;
  const bundleBytes = bundle.reduce((sum, i) => sum + i.file.size, 0);

  function pickName(f: File): string {
    return f.name.replace(/\.[^.]+$/, "");
  }

  /** Upload the bundle over a few lanes, reporting progress as files land. */
  async function uploadBundle(deckId: string, versionId: string) {
    let next = 0;
    let done = 0;
    setProgress({ done: 0, total: bundle.length });
    const lanes = Array.from({ length: Math.min(UPLOAD_LANES, bundle.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= bundle.length) return;
        await uploadBundleFile({
          deckId,
          versionId,
          relPath: bundle[i].path,
          file: bundle[i].file,
        });
        done++;
        setProgress({ done, total: bundle.length });
      }
    });
    await Promise.all(lanes);
  }

  function onSubmitFolder() {
    setError(null);
    start(async () => {
      try {
        const entry = pickEntry(bundle);
        if (!entry) throw new Error("No index.html at the folder root");
        const t = title.trim() || "Shared folder";
        const out = await createBundleShare({
          title: t,
          entry,
          fileCount: bundle.length,
          password: pwd || undefined,
          expiresIn: expiry,
        });
        await uploadBundle(out.deckId, out.versionId);
        setResult({
          url: `${window.location.origin}/s/${out.slug}`,
          password: out.password,
          title: t,
          kind: "folder",
          expiry,
          fileCount: bundle.length,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setProgress(null);
      }
    });
  }

  function onSubmit() {
    if (tab === "folder") return onSubmitFolder();
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
          title: t,
          kind: tab,
          expiry,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function copyUrl() {
    if (!result) return;
    navigator.clipboard?.writeText(result.url);
    setCopied("url");
    setTimeout(() => setCopied(null), 1500);
  }
  function copyPassword() {
    if (!result?.password) return;
    navigator.clipboard?.writeText(result.password);
    setCopied("password");
    setTimeout(() => setCopied(null), 1500);
  }
  function expiryLabel(v: ShareResult["expiry"]): string {
    if (v === "never") return "Never expires";
    if (v === "24h") return "Expires in 24 hours";
    if (v === "7d") return "Expires in 7 days";
    return "Expires in 30 days";
  }
  function kindLabel(k: Tab): string {
    if (k === "pdf") return "PDF";
    if (k === "html_raw") return "Raw HTML";
    if (k === "folder") return "Folder";
    return "HTML file";
  }

  function onPickFolder(files: FileList | null) {
    if (!files || files.length === 0) return;
    const items = Array.from(files).map((f) => ({
      path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
      file: f,
    }));
    setBundle(cleanBundle(items));
    setError(null);
  }

  /** A dropped folder arrives as directory entries, not as files. */
  async function onDropBundle(dt: DataTransfer) {
    const entries = Array.from(dt.items)
      .map((i) => i.webkitGetAsEntry?.())
      .filter((e): e is FileSystemEntry => Boolean(e));
    if (entries.length === 0) return onPickFolder(dt.files);
    try {
      const out: BundleFile[] = [];
      for (const entry of entries) await readDropEntry(entry, "", out);
      setBundle(cleanBundle(out));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that folder");
    }
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
            <ArrowLeft className="w-4 h-4" /> Files
          </a>
          <span className="font-medium tracking-tight">Share a file</span>
        </div>
      </header>

      <main className="mx-auto max-w-[920px] px-6 py-10">
        {result ? (
          <div className="space-y-5">
            {/* Hero card */}
            <div
              className="relative overflow-hidden rounded-3xl p-8 text-white shadow-[0_20px_60px_-20px_rgba(94,8,66,0.45)]"
              style={{ background: "linear-gradient(135deg, #76195c 0%, #5e0842 55%, #3a0428 100%)" }}
            >
              <div
                aria-hidden
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    "radial-gradient(60% 60% at 80% 0%, rgba(255,255,255,0.35), transparent 60%), radial-gradient(40% 40% at 0% 100%, rgba(255,255,255,0.2), transparent 60%)",
                }}
              />
              <div className="relative">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-[11px] font-medium tracking-wide">
                  <Sparkles className="w-3 h-3" /> Live
                </div>
                <h1 className="mt-4 text-[28px] font-semibold tracking-tight leading-tight">
                  Your link is ready to share.
                </h1>
                <p className="mt-1 text-[13px] text-white/75 max-w-md">
                  Send <span className="font-medium text-white">{result.title}</span> to anyone — it opens in any browser, no login required{result.password ? " (password-gated)" : ""}.
                </p>

                {/* URL pill */}
                <div className="mt-6 flex items-center gap-2 p-1.5 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/15">
                  <div className="flex-1 px-3 py-2 text-[13px] font-mono truncate select-all">
                    {result.url}
                  </div>
                  <button
                    type="button"
                    onClick={copyUrl}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-[#5e0842] text-[12px] font-semibold hover:bg-white/90 transition-smooth"
                  >
                    {copied === "url" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied === "url" ? "Copied" : "Copy link"}
                  </button>
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 transition-smooth"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                {/* Meta chips */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <Chip icon={result.kind === "folder" ? <FolderTree className="w-3 h-3" /> : <FileText className="w-3 h-3" />}>
                    {kindLabel(result.kind)}
                    {result.fileCount ? ` · ${result.fileCount} files` : ""}
                  </Chip>
                  <Chip icon={<Clock className="w-3 h-3" />}>{expiryLabel(result.expiry)}</Chip>
                  <Chip icon={<Lock className="w-3 h-3" />}>{result.password ? "Password protected" : "Public link"}</Chip>
                </div>
              </div>
            </div>

            {/* Password reveal — only when set */}
            {result.password && (
              <div className="panel-card p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[rgb(var(--primary)/0.12)] text-[rgb(var(--primary))] inline-flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-foreground/45">Password</p>
                  <p className="font-mono text-[14px] text-foreground truncate">{result.password}</p>
                </div>
                <button
                  type="button"
                  onClick={copyPassword}
                  className="btn-secondary btn-sm"
                >
                  {copied === "password" ? <Check className="w-3.5 h-3.5 text-[rgb(var(--success))]" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied === "password" ? "Copied" : "Copy"}
                </button>
              </div>
            )}

            {/* Footer actions */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="btn-primary"
              >
                <ExternalLink className="w-4 h-4" /> Open
              </a>
              <a
                href="/"
                className="btn-secondary btn-sm"
              >
                <ArrowLeft className="w-4 h-4" /> Back to files
              </a>
              <div className="ml-auto" />
              <button
                type="button"
                onClick={() => { setResult(null); setFile(null); setRawHtml(""); setPwd(""); setTitle(""); setBundle([]); }}
                className="px-4 py-2 rounded-lg text-[13px] text-foreground/70 hover:text-foreground inline-flex items-center gap-1.5"
              >
                <Share2 className="w-4 h-4" /> Share another file
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-[24px] font-semibold tracking-tight">Share a file</h1>
              <p className="text-[13px] text-foreground/55 mt-1">
                Upload an HTML file, a whole folder of pages, raw HTML or a PDF — protected by an optional password and expiry.
              </p>
            </div>

            <div className="panel-card p-5 space-y-5">
              {/* Source tabs */}
              <div className="flex gap-1 p-1 rounded-lg bg-[rgb(var(--fg)/0.04)] w-fit">
                <TabBtn active={tab === "html_file"} onClick={() => setTab("html_file")}><Upload className="w-3.5 h-3.5" /> HTML file</TabBtn>
                <TabBtn active={tab === "folder"} onClick={() => setTab("folder")}><FolderTree className="w-3.5 h-3.5" /> Folder</TabBtn>
                <TabBtn active={tab === "pdf"} onClick={() => setTab("pdf")}><FileText className="w-3.5 h-3.5" /> PDF</TabBtn>
                <TabBtn active={tab === "html_raw"} onClick={() => setTab("html_raw")}><Code className="w-3.5 h-3.5" /> Raw HTML</TabBtn>
              </div>

              {/* Source input */}
              {tab === "folder" ? (
                <div
                  onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => { e.preventDefault(); setDrag(false); void onDropBundle(e.dataTransfer); }}
                  className={
                    "rounded-xl border-2 border-dashed p-8 text-center transition-smooth " +
                    (drag ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary)/0.04)]" : "border-border bg-[rgb(var(--fg)/0.02)]")
                  }
                >
                  <FolderTree className="w-6 h-6 text-foreground/40 mx-auto mb-2" />
                  {bundle.length > 0 ? (
                    <>
                      <p className="text-[13px] mb-1">
                        <span className="font-medium">{bundle.length} files</span> · {formatBytes(bundleBytes)}
                      </p>
                      <p className="text-[11px] text-foreground/45 mb-3">
                        {bundleEntry
                          ? <>Opens on <span className="font-mono">{bundleEntry}</span> — relative links and assets keep working</>
                          : <span className="text-[rgb(var(--error))]">No index.html at the folder root — pick the folder that contains it</span>}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[13px] mb-1">Drop a folder here</p>
                      <p className="text-[11px] text-foreground/45 mb-3">
                        Every file is served together, so sub-pages and assets resolve as they do on disk
                      </p>
                    </>
                  )}
                  <label className="inline-flex items-center px-3 py-1.5 rounded-md border border-border bg-card hover:bg-[rgb(var(--fg)/0.04)] text-[12px] cursor-pointer">
                    {bundle.length > 0 ? "Choose a different folder" : "Choose folder"}
                    <input
                      ref={(el) => {
                        // React has no typed prop for these; the picker needs
                        // both spellings to select a directory across browsers.
                        if (el) {
                          el.setAttribute("webkitdirectory", "");
                          el.setAttribute("directory", "");
                        }
                      }}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => onPickFolder(e.target.files)}
                    />
                  </label>
                </div>
              ) : tab === "html_raw" ? (
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
                  disabled={
                    pending ||
                    (tab === "html_raw"
                      ? !rawHtml.trim()
                      : tab === "folder"
                        ? !bundleEntry
                        : !file)
                  }
                  className="btn-primary"
                >
                  <Share2 className="w-4 h-4" />
                  {progress
                    ? `Uploading ${progress.done} / ${progress.total}…`
                    : pending
                      ? "Creating link…"
                      : "Create share link"}
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/15 text-[11px] font-medium">
      {icon}
      {children}
    </span>
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
