"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, FileText, Globe, Link2, Sparkles, Upload } from "lucide-react";
import { createDeck } from "@/lib/decks/actions";

type Tab = "prompt" | "markdown" | "url" | "file" | "sharepoint";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { id: "prompt", label: "Prompt", icon: Sparkles, hint: "Describe the deck you want." },
  { id: "markdown", label: "Outline", icon: FileText, hint: "Paste headings + bullets." },
  { id: "url", label: "URL", icon: Globe, hint: "Article, landing page, doc." },
  { id: "file", label: "Upload", icon: Upload, hint: "PPTX, PDF, DOCX." },
  { id: "sharepoint", label: "SharePoint", icon: Link2, hint: "Paste a SharePoint share link." },
];

export function NewDeckForm() {
  const [tab, setTab] = useState<Tab>("prompt");
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
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
            title,
            goal,
            source: { kind: "file", file } as never, // server action handles File via FormData boundary
          });
          return;
        }
        const kind = tab === "markdown" ? "markdown" : tab;
        await createDeck({
          title,
          goal,
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
        <div className="mx-auto max-w-[900px] px-6 h-14 flex items-center gap-4">
          <a href="/" className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-[13px]">
            <ArrowLeft className="w-4 h-4" /> Library
          </a>
          <span className="font-medium tracking-tight">New deck</span>
        </div>
      </header>

      <main className="mx-auto max-w-[900px] px-6 py-10">
        <div className="panel-card p-6">
          <h1 className="text-[20px] font-semibold mb-1">Where should we start from?</h1>
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
                <input
                  type="file"
                  accept=".pptx,.pdf,.docx"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-[13px] text-foreground/70 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[rgb(var(--primary)/0.1)] file:text-[rgb(var(--primary))] file:text-[12px] file:font-medium hover:file:bg-[rgb(var(--primary)/0.16)]"
                />
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
                className="px-4 py-2 rounded-lg bg-[rgb(var(--primary))] text-white text-[13px] font-medium transition-smooth hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Planning…" : "Plan outline"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
