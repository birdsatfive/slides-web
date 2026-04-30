"use client";

import { DollarSign, Palette, Plus, Presentation, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { AppSwitcher } from "@/components/layout/AppSwitcher";

interface Deck {
  id: string;
  title: string;
  updated_at: string;
  template_id: string | null;
  starred: boolean;
}

interface Props {
  decks: Deck[];
  userEmail: string;
}

export function LibraryView({ decks, userEmail }: Props) {
  const [query, setQuery] = useState("");

  const filtered = decks.filter((d) =>
    d.title.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1400px] px-6 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #C72886, #C72886aa)" }}
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
          <span className="text-foreground/60 text-[12px]">{userEmail}</span>
          <AppSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-8">
        {/* Page header */}
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

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search decks…"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-[13px] outline-none focus:border-[rgb(var(--primary))] focus:ring-2 focus:ring-[rgb(var(--primary)/0.2)] transition-smooth"
          />
        </div>

        {/* Deck grid */}
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map((deck) => (
              <DeckCard key={deck.id} deck={deck} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function DeckCard({ deck }: { deck: Deck }) {
  return (
    <a
      href={`/d/${deck.id}`}
      className="panel-card overflow-hidden group transition-smooth hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
    >
      <div className="aspect-video bg-[rgb(var(--muted))] border-b border-border" />
      <div className="p-3">
        <p className="text-[13px] font-medium truncate">{deck.title}</p>
        <p className="text-[11px] text-foreground/40 mt-0.5">
          {new Date(deck.updated_at).toLocaleDateString()}
        </p>
      </div>
    </a>
  );
}

function EmptyState() {
  return (
    <div className="panel-card p-12 flex flex-col items-center text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "linear-gradient(135deg, #C72886, #C7288688)" }}
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
