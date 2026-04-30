"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ArrowDown, ArrowUp, Plus, Sparkles, Trash2 } from "lucide-react";
import { renderDesignedDeck, saveOutlineEdit } from "@/lib/decks/actions";
import type { OutlineSlide } from "@/lib/api/slides";

interface Props {
  deckId: string;
  title: string;
  versionId: string;
  slideTree: OutlineSlide[];
  hasRender: boolean;
}

const SLIDE_TYPE_LABEL: Record<string, string> = {
  hero: "Hero",
  statement: "Statement",
  two_col: "Two columns",
  stats: "Stats",
  cards: "Cards",
  timeline: "Timeline",
  quote: "Quote",
  cta: "CTA",
  divider: "Divider",
};

export function OutlineEditor({ deckId, title, versionId, slideTree, hasRender }: Props) {
  const [tree, setTree] = useState<OutlineSlide[]>(slideTree);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function patchSlide(idx: number, patch: Partial<OutlineSlide>) {
    setTree((t) => t.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function move(idx: number, dir: -1 | 1) {
    setTree((t) => {
      const next = [...t];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return next;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  function remove(idx: number) {
    setTree((t) => t.filter((_, i) => i !== idx));
  }

  function add() {
    setTree((t) => [
      ...t,
      {
        id: Math.random().toString(36).slice(2, 10),
        type: "statement",
        blocks: [{ id: Math.random().toString(36).slice(2, 10), kind: "heading", content: "New slide" }],
      },
    ]);
  }

  function persistThenRender() {
    setError(null);
    startTransition(async () => {
      try {
        const newVersionId = await saveOutlineEdit(deckId, versionId, tree, "Approved outline");
        await renderDesignedDeck(deckId, newVersionId, title);
        window.location.href = `/d/${deckId}`;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1100px] px-6 h-14 flex items-center gap-4">
          <a href="/" className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-[13px]">
            <ArrowLeft className="w-4 h-4" /> Library
          </a>
          <span className="font-medium tracking-tight truncate">{title}</span>
          <span className="ml-2 text-[10px] uppercase tracking-wider text-foreground/40">Outline review</span>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-6 py-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-[20px] font-semibold">Review the outline</h1>
            <p className="text-[13px] text-foreground/50 mt-1">
              Reorder, retitle, or remove slides before we design them. Cheap to iterate here.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={add}
              className="px-3 py-2 rounded-lg text-[13px] inline-flex items-center gap-1 border border-border hover:bg-[rgb(var(--fg)/0.04)] transition-smooth"
            >
              <Plus className="w-3.5 h-3.5" /> Add slide
            </button>
            <button
              type="button"
              disabled={pending || tree.length === 0}
              onClick={persistThenRender}
              className="px-4 py-2 rounded-lg bg-[rgb(var(--primary))] text-white text-[13px] font-medium inline-flex items-center gap-1.5 transition-smooth hover:opacity-90 disabled:opacity-60"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {pending ? "Designing…" : hasRender ? "Re-render deck" : "Render deck"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-[12px] px-3 py-2 rounded-lg bg-[rgb(var(--error)/0.08)] border border-[rgb(var(--error)/0.2)] text-[rgb(var(--error))]">
            {error}
          </div>
        )}

        <ol className="space-y-2">
          {tree.map((slide, idx) => {
            const heading = (slide.blocks.find((b) => b.kind === "heading")?.content as string) ?? "(no heading)";
            return (
              <li key={slide.id} className="panel-card p-4 flex items-start gap-3">
                <span className="text-[11px] text-foreground/40 mt-1 w-6 tabular-nums">{idx + 1}.</span>
                <div className="flex-1 min-w-0">
                  <input
                    value={heading}
                    onChange={(e) => {
                      const v = e.target.value;
                      const blocks = slide.blocks.map((b) =>
                        b.kind === "heading" ? { ...b, content: v } : b,
                      );
                      patchSlide(idx, { blocks });
                    }}
                    className="w-full bg-transparent text-[15px] font-medium outline-none focus:underline"
                  />
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <select
                      value={slide.type}
                      onChange={(e) => patchSlide(idx, { type: e.target.value })}
                      className="px-2 py-0.5 rounded-md border border-border bg-card text-[11px] text-foreground/70"
                    >
                      {Object.entries(SLIDE_TYPE_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                    <span className="text-[11px] text-foreground/40">
                      {slide.blocks.length} block{slide.blocks.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => move(idx, -1)} className="icon-btn" title="Move up">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => move(idx, 1)} className="icon-btn" title="Move down">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => remove(idx)} className="icon-btn" title="Remove">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>

        {tree.length === 0 && (
          <div className="panel-card p-10 text-center text-[13px] text-foreground/50">
            Outline is empty. Add a slide to start, or go back and try a different prompt.
          </div>
        )}
      </main>
    </div>
  );
}
