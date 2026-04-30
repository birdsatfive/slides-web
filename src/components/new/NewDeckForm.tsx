"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, Check, Eye, FileText, Globe, Link2, Sparkles, Upload, Wand2 } from "lucide-react";
import { createDeck } from "@/lib/decks/actions";
import { TemplatePreview, type TemplatePreviewSpec } from "@/components/new/TemplatePreview";
import { FileDropzone } from "@/components/new/FileDropzone";

type Tab = "prompt" | "markdown" | "url" | "file" | "sharepoint";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { id: "prompt", label: "Prompt", icon: Sparkles, hint: "Describe the deck you want." },
  { id: "markdown", label: "Outline", icon: FileText, hint: "Paste headings + bullets." },
  { id: "url", label: "URL", icon: Globe, hint: "Article, landing page, doc." },
  { id: "file", label: "Upload", icon: Upload, hint: "PPTX, PDF, DOCX." },
  { id: "sharepoint", label: "SharePoint", icon: Link2, hint: "Paste a SharePoint share link." },
];

export interface TemplateOption {
  id: string;
  slug: string;
  name: string;
  vibe: string;
  bg: string;
  fg: string;
  accent: string;
  heading: string;
  previewSpec: TemplatePreviewSpec;
}

interface Props {
  templates: TemplateOption[];
}

export function NewDeckForm({ templates }: Props) {
  const [tab, setTab] = useState<Tab>("prompt");
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [previewSpec, setPreviewSpec] = useState<TemplatePreviewSpec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        if (tab === "file") {
          if (!file) { setError("Pick a file first."); return; }
          await createDeck({
            title, goal, templateId,
            source: { kind: "file", file } as never,
          });
          return;
        }
        const kind = tab === "markdown" ? "markdown" : tab;
        await createDeck({
          title, goal, templateId,
          source: { kind, payload: text },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const active = TABS.find((t) => t.id === tab)!;
  const ActiveIcon = active.icon;

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))]">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1100px] px-6 h-14 flex items-center gap-4">
          <a href="/" className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-[13px]">
            <ArrowLeft className="w-4 h-4" /> Library
          </a>
          <span className="font-medium tracking-tight">New deck</span>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-6 py-10">
        {/* Template gallery */}
        <section className="panel-card p-6 mb-5">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-foreground/40 inline-flex items-center gap-1">
                <Wand2 className="w-3 h-3" /> Template
              </p>
              <h2 className="text-[16px] font-semibold mt-0.5">Pick a starting point</h2>
            </div>
            <button
              type="button"
              onClick={() => setTemplateId(null)}
              aria-pressed={templateId === null}
              className={
                "inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-smooth " +
                (templateId === null
                  ? "bg-[rgb(var(--primary))] border-[rgb(var(--primary))] text-white font-medium shadow-[0_2px_8px_rgba(245,142,211,0.35)]"
                  : "border-border text-foreground/55 hover:text-foreground hover:border-[rgb(var(--primary)/0.5)]")
              }
            >
              {templateId === null && <Check className="w-3.5 h-3.5" />}
              Auto (derive from input)
            </button>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {templates.map((t) => (
              <div
                key={t.id}
                className={
                  "group relative rounded-xl overflow-hidden border transition-smooth " +
                  (templateId === t.id
                    ? "border-[rgb(var(--primary))] ring-2 ring-[rgb(var(--primary)/0.3)]"
                    : "border-border hover:border-[rgb(var(--primary)/0.4)]")
                }
              >
                <button
                  type="button"
                  onClick={() => setTemplateId(t.id)}
                  className="block w-full text-left"
                >
                  <div
                    className="aspect-[4/3] flex flex-col items-start justify-end p-3"
                    style={{ background: t.bg, color: t.fg }}
                  >
                    <span
                      className="inline-block w-6 h-6 rounded mb-2"
                      style={{ background: t.accent }}
                    />
                    <p
                      className="text-[15px] font-bold leading-none"
                      style={{ fontFamily: t.heading }}
                    >
                      {t.name}
                    </p>
                  </div>
                  <div className="p-3 bg-card border-t border-border">
                    <p className="text-[11px] text-foreground/65 line-clamp-2">{t.vibe}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewSpec(t.previewSpec)}
                  className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-black/55 text-white text-[10px] font-medium opacity-0 group-hover:opacity-100 backdrop-blur-sm transition-smooth hover:bg-black/75"
                  title="Preview"
                >
                  <Eye className="w-3 h-3" /> Preview
                </button>
              </div>
            ))}
          </div>
          {templates.length === 0 && (
            <p className="text-[12px] text-foreground/50">No templates seeded yet.</p>
          )}
        </section>

        {/* Source picker */}
        <div className="panel-card p-6">
          <h1 className="text-[18px] font-semibold mb-1">Where should we start from?</h1>
          <p className="text-[13px] text-foreground/50 mb-5">
            We&apos;ll pull content from the source, plan an outline, then design the deck.
          </p>

          <div className="flex gap-1 border-b border-border mb-5">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={
                    "px-3 py-2 text-[13px] inline-flex items-center gap-2 border-b-2 -mb-px transition-smooth " +
                    (isActive
                      ? "border-[rgb(var(--primary))] text-foreground font-medium"
                      : "border-transparent text-foreground/55 hover:text-foreground")
                  }
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] text-foreground/60 mb-1.5">Deck title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q3 product update"
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-[13px] outline-none focus:border-[rgb(var(--primary))] focus:ring-2 focus:ring-[rgb(var(--primary)/0.2)] transition-smooth"
              />
            </div>

            <div>
              <label className="block text-[12px] text-foreground/60 mb-1.5 inline-flex items-center gap-1.5">
                <ActiveIcon className="w-3.5 h-3.5" />
                {active.hint}
              </label>

              {tab === "file" ? (
                <FileDropzone file={file} onChange={setFile} />
              ) : (
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={tab === "url" || tab === "sharepoint" ? 2 : 10}
                  placeholder={
                    tab === "prompt"
                      ? "Create a 7-slide investor update covering Q3 numbers, product wins, and 2026 priorities."
                      : tab === "markdown"
                      ? "## Intro\n- one\n- two\n\n## Stats\n- 42 users\n- 99% uptime"
                      : tab === "url"
                      ? "https://example.com/article"
                      : "https://contoso.sharepoint.com/:p:/r/sites/…"
                  }
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-[13px] outline-none focus:border-[rgb(var(--primary))] focus:ring-2 focus:ring-[rgb(var(--primary)/0.2)] transition-smooth font-mono"
                />
              )}
            </div>

            <div>
              <label className="block text-[12px] text-foreground/60 mb-1.5">Goal (optional)</label>
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Convince the board to approve the 2026 hiring plan"
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-[13px] outline-none focus:border-[rgb(var(--primary))] focus:ring-2 focus:ring-[rgb(var(--primary)/0.2)] transition-smooth"
              />
              <p className="text-[11px] text-foreground/40 mt-1">
                Helps the planner decide tone and structure.
              </p>
            </div>

            {error && (
              <div className="text-[12px] px-3 py-2 rounded-lg bg-[rgb(var(--error)/0.08)] border border-[rgb(var(--error)/0.2)] text-[rgb(var(--error))]">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <a href="/" className="px-4 py-2 rounded-lg text-[13px] text-foreground/60 hover:bg-[rgb(var(--fg)/0.05)] transition-smooth">
                Cancel
              </a>
              <button
                type="submit"
                disabled={pending}
                className="px-4 py-2 rounded-lg bg-[rgb(var(--primary))] text-white text-[13px] font-medium transition-smooth hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {pending ? "Generating…" : "Generate deck"}
              </button>
            </div>
          </form>
        </div>
      </main>

      <TemplatePreview
        open={previewSpec !== null}
        spec={previewSpec}
        onClose={() => setPreviewSpec(null)}
      />
    </div>
  );
}
