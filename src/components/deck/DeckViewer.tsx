"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, BarChart2, Check, Loader2, Pencil, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { remixSingleSlide, saveTextEdit } from "@/lib/decks/actions";
import { SharePopover } from "@/components/deck/SharePopover";
import { RegenerateButton } from "@/components/deck/RegenerateButton";
import type { OutlineSlide } from "@/lib/api/slides";

interface TextEdit {
  slide_id: string;
  element_index: number;
  new_text: string;
}

const EDITABLE_SELECTOR =
  "h1, h2, h3, h4, h5, h6, p, li, blockquote, .slide-heading, .slide-label, .slide-stat-label";

interface ShareLink {
  id: string; slug: string; password_hash: string | null;
  expires_at: string | null; revoked_at: string | null; created_at: string;
}

interface Props {
  deckId: string;
  title: string;
  versionId: string;
  slideTree: OutlineSlide[];
  htmlUrl: string | null;
  shareLinks: ShareLink[];
  textEdits: TextEdit[];
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function DeckViewer({ deckId, title, versionId, slideTree, htmlUrl, shareLinks, textEdits }: Props) {
  const [activeSlideId, setActiveSlideId] = useState<string | null>(slideTree[0]?.id ?? null);
  const [remixOpen, setRemixOpen] = useState<string | null>(null);
  const [remixPrompt, setRemixPrompt] = useState("");
  const [remixResult, setRemixResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [editMode, setEditMode] = useState(false);
  const editModeRef = useRef(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const editsRef = useRef<TextEdit[]>(textEdits);

  /**
   * Sidebar click → scroll iframe to the matching slide. Iframe is loaded
   * through our same-origin proxy so contentDocument is reachable. We try a
   * few selectors because rendered decks may use either `data-slide-id` (new
   * prompt) or numeric `data-slide`/index (older renders).
   */
  function gotoSlide(slideId: string, index: number) {
    setActiveSlideId(slideId);
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const target =
      doc.querySelector(`[data-slide-id="${CSS.escape(slideId)}"]`) ??
      doc.querySelector(`[data-slide="${index}"]`) ??
      doc.querySelectorAll(".slide, section.slide, section[class*='slide']")[index] ??
      null;
    (target as HTMLElement | null)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /** Track which slide is in view via IntersectionObserver inside the iframe. */
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !htmlUrl) return;
    let cleanup: (() => void) | null = null;

    function attach() {
      const doc = iframe?.contentDocument;
      if (!doc) return;
      const slides = Array.from(doc.querySelectorAll<HTMLElement>(".slide, section.slide"));
      if (slides.length === 0) return;

      // Tag every editable text element with a stable index within its
      // slide so we can persist edits keyed by (slide, index).
      slides.forEach((slide) => {
        const slideId =
          slide.dataset.slideId ??
          (typeof slide.dataset.slide === "string" && slideTree[Number(slide.dataset.slide)]?.id) ??
          null;
        if (!slideId) return;
        const editable = Array.from(slide.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR));
        editable.forEach((el, idx) => {
          el.dataset.editSlideId = slideId;
          el.dataset.editIndex = String(idx);
        });
      });

      // Apply persisted edits
      for (const edit of editsRef.current) {
        const el = doc.querySelector<HTMLElement>(
          `[data-edit-slide-id="${CSS.escape(edit.slide_id)}"][data-edit-index="${edit.element_index}"]`,
        );
        if (el) el.textContent = edit.new_text;
      }

      // Wire edit mode (idempotent — applyEditMode reads editModeRef)
      applyEditMode(doc);

      const obs = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            const el = e.target as HTMLElement;
            const id = el.dataset.slideId;
            if (id) {
              setActiveSlideId(id);
              return;
            }
            const idx = Number(el.dataset.slide);
            if (!Number.isNaN(idx) && slideTree[idx]) {
              setActiveSlideId(slideTree[idx].id);
              return;
            }
          }
        },
        { root: doc.scrollingElement as unknown as Element | null, threshold: 0.5 },
      );
      slides.forEach((s) => obs.observe(s));
      cleanup = () => obs.disconnect();
    }

    iframe.addEventListener("load", attach);
    if (iframe.contentDocument?.readyState === "complete") attach();
    return () => {
      iframe.removeEventListener("load", attach);
      cleanup?.();
    };
  }, [htmlUrl, slideTree]);

  /**
   * Toggle contenteditable on every editable text element inside the iframe
   * and wire blur-to-save. We capture original text on focus so we only
   * round-trip when something actually changed.
   */
  function applyEditMode(doc: Document) {
    const els = Array.from(doc.querySelectorAll<HTMLElement>("[data-edit-slide-id]"));
    const enabled = editModeRef.current;
    els.forEach((el) => {
      el.contentEditable = enabled ? "true" : "false";
      el.spellcheck = enabled;
      el.style.outline = "none";
      el.style.cursor = enabled ? "text" : "";
      if (enabled) {
        el.style.transition = "box-shadow 120ms ease";
        el.addEventListener("focus", onFocus);
        el.addEventListener("blur", onBlur);
        el.addEventListener("mouseenter", onHover);
        el.addEventListener("mouseleave", offHover);
      } else {
        el.style.boxShadow = "";
        el.removeEventListener("focus", onFocus);
        el.removeEventListener("blur", onBlur);
        el.removeEventListener("mouseenter", onHover);
        el.removeEventListener("mouseleave", offHover);
      }
    });
  }

  function onHover(e: Event) {
    const el = e.currentTarget as HTMLElement;
    el.style.boxShadow = "0 0 0 2px rgba(245, 142, 211, 0.45)";
  }
  function offHover(e: Event) {
    const el = e.currentTarget as HTMLElement;
    if (doc()?.activeElement !== el) el.style.boxShadow = "";
  }
  function onFocus(e: Event) {
    const el = e.currentTarget as HTMLElement;
    el.dataset.editOriginal = el.textContent ?? "";
    el.style.boxShadow = "0 0 0 2px rgba(245, 142, 211, 0.85)";
  }
  function onBlur(e: Event) {
    const el = e.currentTarget as HTMLElement;
    el.style.boxShadow = "";
    const original = el.dataset.editOriginal ?? "";
    const next = (el.textContent ?? "").trim();
    if (next === original.trim()) return;
    const slideId = el.dataset.editSlideId;
    const indexStr = el.dataset.editIndex;
    if (!slideId || indexStr === undefined) return;
    setSaveState("saving");
    saveTextEdit(deckId, versionId, slideId, Number(indexStr), next)
      .then(() => {
        setSaveState("saved");
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
      })
      .catch((err) => {
        setSaveState("error");
        setError(err instanceof Error ? err.message : String(err));
      });
  }
  function doc(): Document | null {
    return iframeRef.current?.contentDocument ?? null;
  }

  // Re-apply edit mode whenever the toggle flips
  useEffect(() => {
    editModeRef.current = editMode;
    const d = iframeRef.current?.contentDocument;
    if (d) applyEditMode(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode]);

  function openRemix(slideId: string) {
    setRemixOpen(slideId);
    setRemixPrompt("");
    setRemixResult(null);
    setError(null);
  }

  function runRemix() {
    if (!remixOpen) return;
    const slide = slideTree.find((s) => s.id === remixOpen);
    if (!slide) return;
    startTransition(async () => {
      try {
        const fragment = await remixSingleSlide(slide, remixPrompt, deckId, versionId);
        setRemixResult(fragment);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card shrink-0">
        <div className="px-6 h-14 flex items-center gap-3">
          <a href="/" className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-[13px] shrink-0">
            <ArrowLeft className="w-4 h-4" /> Library
          </a>
          <span className="font-medium tracking-tight truncate">{title}</span>

          <div className="ml-auto flex items-center gap-2">
            <SaveIndicator state={saveState} />
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              className={
                "px-3 py-1.5 rounded-md text-[12px] inline-flex items-center gap-1.5 transition-smooth border " +
                (editMode
                  ? "bg-[rgb(var(--primary))] text-white border-[rgb(var(--primary))]"
                  : "border-border text-foreground/80 hover:bg-[rgb(var(--fg)/0.04)]")
              }
              title="Toggle inline text editing"
            >
              <Pencil className="w-3.5 h-3.5" /> {editMode ? "Editing" : "Edit text"}
            </button>
            <RegenerateButton deckId={deckId} />
            <a
              href={`/d/${deckId}/outline`}
              className="px-3 py-1.5 rounded-md text-[12px] border border-border hover:bg-[rgb(var(--fg)/0.04)] inline-flex items-center gap-1.5 text-foreground/80"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Edit outline
            </a>
            <a
              href={`/d/${deckId}/stats`}
              className="px-3 py-1.5 rounded-md text-[12px] border border-border hover:bg-[rgb(var(--fg)/0.04)] inline-flex items-center gap-1.5 text-foreground/80"
            >
              <BarChart2 className="w-3.5 h-3.5" /> Stats
            </a>
            <SharePopover
              deckId={deckId}
              versionId={versionId}
              links={shareLinks}
              hasRender={!!htmlUrl}
            />
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-[240px_1fr] min-h-0">
        {/* Slide list */}
        <aside className="border-r border-border bg-card/40 p-3 overflow-y-auto">
          <p className="text-[10px] uppercase tracking-wider text-foreground/40 px-2 pb-2">Slides</p>
          <ol className="space-y-1">
            {slideTree.map((slide, i) => {
              const heading = (slide.blocks.find((b) => b.kind === "heading")?.content as string) ?? `Slide ${i + 1}`;
              const isActive = slide.id === activeSlideId;
              return (
                <li key={slide.id}>
                  <button
                    type="button"
                    onClick={() => gotoSlide(slide.id, i)}
                    className={
                      "w-full text-left px-2.5 py-2 rounded-lg text-[12px] transition-smooth flex items-center gap-2 group " +
                      (isActive
                        ? "bg-[rgb(var(--primary)/0.1)] text-foreground"
                        : "hover:bg-[rgb(var(--fg)/0.04)] text-foreground/70")
                    }
                  >
                    <span className="w-5 text-[10px] text-foreground/40 tabular-nums">{i + 1}</span>
                    <span className="flex-1 truncate">{heading}</span>
                    <span
                      role="button"
                      title="Remix this slide"
                      onClick={(e) => { e.stopPropagation(); openRemix(slide.id); }}
                      className="opacity-0 group-hover:opacity-100 hover:text-[rgb(var(--primary))] transition-smooth"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* Iframe — fills the rest */}
        <main className="bg-[rgb(var(--bg))] min-w-0">
          {htmlUrl ? (
            <iframe
              ref={iframeRef}
              src={htmlUrl}
              className="w-full h-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div className="h-full flex items-center justify-center p-10 text-center text-[13px] text-foreground/55">
              <div className="panel-card p-10 max-w-md">
                <Sparkles className="w-6 h-6 text-[rgb(var(--primary))] mb-3 mx-auto" />
                <p className="font-medium text-foreground mb-1">Not designed yet</p>
                <p className="mb-4">Approve the outline to render the designed deck.</p>
                <a
                  href={`/d/${deckId}/outline`}
                  className="inline-flex px-4 py-2 rounded-lg bg-[rgb(var(--primary))] text-white text-[13px] font-medium"
                >
                  Open outline
                </a>
              </div>
            </div>
          )}
        </main>
      </div>

      {editMode && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 z-40 panel-card px-3 py-1.5 text-[11px] text-foreground/65">
          Click any text to edit. Changes save when you click away.
        </div>
      )}

      {/* Remix modal */}
      {remixOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setRemixOpen(null)}
        >
          <div className="panel-card w-[520px] max-w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-1">Remix this slide</h3>
            <p className="text-[12px] text-foreground/55 mb-4">
              Tell us how to change just this slide. The rest of the deck stays untouched.
            </p>
            <textarea
              value={remixPrompt}
              onChange={(e) => setRemixPrompt(e.target.value)}
              rows={4}
              placeholder="Make this a 3-column comparison instead of bullets."
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-[13px] outline-none focus:border-[rgb(var(--primary))] focus:ring-2 focus:ring-[rgb(var(--primary)/0.2)] transition-smooth"
            />
            {error && <p className="mt-2 text-[12px] text-[rgb(var(--error))]">{error}</p>}
            {remixResult && (
              <div className="mt-3 panel-card p-3 max-h-[200px] overflow-auto text-[11px] font-mono text-foreground/70">
                <p className="text-[10px] uppercase tracking-wider text-foreground/40 mb-1">Preview HTML</p>
                <pre className="whitespace-pre-wrap break-all">{remixResult.slice(0, 2000)}…</pre>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setRemixOpen(null)}
                className="px-3 py-1.5 rounded-md text-[12px] text-foreground/60 hover:bg-[rgb(var(--fg)/0.05)]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={runRemix}
                disabled={pending || !remixPrompt.trim()}
                className="px-3 py-1.5 rounded-md bg-[rgb(var(--primary))] text-white text-[12px] font-medium disabled:opacity-60"
              >
                {pending ? "Remixing…" : "Run remix"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  if (state === "saving")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-foreground/55">
        <Loader2 className="w-3 h-3 animate-spin" /> Saving…
      </span>
    );
  if (state === "saved")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-[rgb(var(--success))]">
        <Check className="w-3 h-3" /> Saved
      </span>
    );
  return <span className="text-[11px] text-[rgb(var(--error))]">Save failed</span>;
}
