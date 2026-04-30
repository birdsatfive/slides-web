"use client";

import { DollarSign, ExternalLink, Palette, Plus, Presentation, Search, Sparkles, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { AppSwitcher } from "@/components/layout/AppSwitcher";
import { archiveDeck } from "@/lib/decks/actions";

interface Deck {
  id: string;
  title: string;
  updated_at: string;
  template_id: string | null;
  starred: boolean;
}

interface Props {
  decks: Deck[];
  userName: string;
  userEmail: string;
}

export function LibraryView({ decks, userName, userEmail }: Props) {
  const [query, setQuery] = useState("");

  const filtered = decks.filter((d) =>
    d.title.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1400px] px-6 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #F58ED3, #F58ED3aa)" }}
            >
              <Presentation className="w-4 h-4 text-white" strokeWidth={2.25} />
            </div>
            <span className="font-semibold tracking-tight">Slides</span>
          </div>
          <a
            href="/admin/cost"
            className="ml-auto px-3 py-1.5 rounded-md text-[12px] text-foreground/65 hover:text-foreground hover:bg-[rgb(var(--fg)/0.04)] inline-flex items-center gap-1.5"
          >
            <DollarSign className="w-3.5 h-3.5" /> Cost
          </a>
          <a
            href="/brand"
            className="px-3 py-1.5 rounded-md text-[12px] text-foreground/65 hover:text-foreground hover:bg-[rgb(var(--fg)/0.04)] inline-flex items-center gap-1.5"
          >
            <Palette className="w-3.5 h-3.5" /> Brand Kits
          </a>
          <span
            className="text-foreground/65 text-[12px] truncate max-w-[180px]"
            title={userEmail}
          >
            {userName || userEmail}
          </span>
          <AppSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight">Library</h1>
            <p className="text-[13px] text-foreground/50 mt-1">
              Your team&apos;s decks. Create from a prompt, a doc, or a URL.
            </p>
          </div>
          <a
            href="/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[rgb(var(--primary))] text-white text-[13px] font-medium transition-smooth hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            New deck
          </a>
        </div>

        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search decks…"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-[13px] outline-none focus:border-[rgb(var(--primary))] focus:ring-2 focus:ring-[rgb(var(--primary)/0.2)] transition-smooth"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <DeckTable decks={filtered} />
        )}
      </main>
    </div>
  );
}

function DeckTable({ decks }: { decks: Deck[] }) {
  return (
    <div className="panel-card overflow-hidden">
      <table className="w-full text-[13px]">
        <thead className="bg-[rgb(var(--fg)/0.03)] text-foreground/55">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">Deck</th>
            <th className="text-right px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">Updated</th>
            <th className="w-16 px-2 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {decks.map((deck) => (
            <DeckRow key={deck.id} deck={deck} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeckRow({ deck }: { deck: Deck }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Delete "${deck.title}"? You can restore from the archive.`)) return;
    start(async () => {
      try {
        await archiveDeck(deck.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <tr className="border-t border-border/60 group hover:bg-[rgb(var(--primary)/0.04)] transition-smooth">
      <td className="px-4 py-3">
        <a
          href={`/d/${deck.id}`}
          className="inline-flex items-center gap-2.5 max-w-full"
        >
          <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-[rgb(var(--primary)/0.12)]">
            <Presentation className="w-3.5 h-3.5 text-[rgb(var(--primary))]" />
          </div>
          <span className="font-medium truncate group-hover:text-foreground">{deck.title}</span>
          <ExternalLink className="w-3 h-3 text-foreground/30 opacity-0 group-hover:opacity-100 transition-smooth" />
        </a>
        {error && <p className="mt-1 text-[10px] text-[rgb(var(--error))]">{error}</p>}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-foreground/55 whitespace-nowrap">
        {new Date(deck.updated_at).toLocaleDateString()}
      </td>
      <td className="px-2 py-3 text-right">
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          title="Delete deck"
          className="w-8 h-8 rounded-md inline-flex items-center justify-center text-foreground/45 hover:text-[rgb(var(--error))] hover:bg-[rgb(var(--error)/0.08)] opacity-0 group-hover:opacity-100 transition-smooth disabled:opacity-60"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

function EmptyState() {
  return (
    <div className="panel-card p-12 flex flex-col items-center text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "linear-gradient(135deg, #F58ED3, #F58ED388)" }}
      >
        <Sparkles className="w-6 h-6 text-white" strokeWidth={2} />
      </div>
      <h2 className="text-[16px] font-semibold mb-1">No decks yet</h2>
      <p className="text-[13px] text-foreground/50 mb-6 max-w-md">
        Start from a prompt, paste an outline, drop a PPTX, or point at a URL.
        We&apos;ll generate a designed deck you can edit and share.
      </p>
      <a
        href="/new"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[rgb(var(--primary))] text-white text-[13px] font-medium transition-smooth hover:opacity-90"
      >
        <Plus className="w-4 h-4" />
        Create your first deck
      </a>
    </div>
  );
}
