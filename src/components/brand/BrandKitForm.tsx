"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, Check, Palette, Plus } from "lucide-react";
import { saveBrandKit, type BrandKitInput } from "@/lib/brand/actions";

interface BrandKit {
  id: string;
  name: string;
  colors: { primary?: string; accent?: string; fg?: string; bg?: string };
  fonts: { heading?: string; body?: string };
}

interface Props {
  kits: BrandKit[];
}

const DEFAULT_KIT: BrandKitInput = {
  name: "BirdsAtFive",
  colors: { primary: "#C72886", accent: "#510742", fg: "#380527", bg: "#FFFFFF" },
  fonts: { heading: "Playfair Display", body: "Inter" },
};

export function BrandKitForm({ kits }: Props) {
  const [active, setActive] = useState<BrandKit | null>(kits[0] ?? null);
  const [draft, setDraft] = useState<BrandKitInput>(active ? toDraft(active) : DEFAULT_KIT);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickKit(kit: BrandKit | null) {
    setActive(kit);
    setDraft(kit ? toDraft(kit) : { ...DEFAULT_KIT });
    setSaved(false);
  }

  function update<K extends keyof BrandKitInput>(key: K, value: BrandKitInput[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setColor(slot: keyof BrandKitInput["colors"], v: string) {
    setDraft((d) => ({ ...d, colors: { ...d.colors, [slot]: v } }));
  }

  function setFont(slot: keyof BrandKitInput["fonts"], v: string) {
    setDraft((d) => ({ ...d, fonts: { ...d.fonts, [slot]: v } }));
  }

  function save() {
    setError(null);
    start(async () => {
      try {
        await saveBrandKit({ ...draft, id: active?.id });
        setSaved(true);
        setTimeout(() => setSaved(false), 1600);
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
          <span className="font-medium tracking-tight">Brand Kits</span>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-6 py-8 grid grid-cols-[260px_1fr] gap-6">
        <aside>
          <p className="text-[10px] uppercase tracking-wider text-foreground/40 mb-2 px-2">Kits</p>
          <ul className="space-y-1">
            {kits.map((k) => (
              <li key={k.id}>
                <button
                  type="button"
                  onClick={() => pickKit(k)}
                  className={
                    "w-full text-left px-3 py-2 rounded-lg text-[13px] flex items-center gap-2 " +
                    (active?.id === k.id
                      ? "bg-[rgb(var(--primary)/0.1)] text-foreground"
                      : "hover:bg-[rgb(var(--fg)/0.04)] text-foreground/70")
                  }
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: k.colors.primary ?? "#999" }}
                  />
                  <span className="truncate">{k.name}</span>
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => pickKit(null)}
                className="w-full text-left px-3 py-2 rounded-lg text-[13px] inline-flex items-center gap-2 text-foreground/55 hover:bg-[rgb(var(--fg)/0.04)]"
              >
                <Plus className="w-3.5 h-3.5" /> New kit
              </button>
            </li>
          </ul>
        </aside>

        <section className="panel-card p-6">
          <p className="text-[10px] uppercase tracking-wider text-foreground/40 mb-2 inline-flex items-center gap-1">
            <Palette className="w-3 h-3" />
            {active ? "Edit kit" : "New kit"}
          </p>
          <input
            value={draft.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Kit name"
            className="w-full mb-5 px-3 py-2 rounded-lg border border-border bg-card text-[15px] font-medium outline-none focus:border-[rgb(var(--primary))]"
          />

          <p className="text-[12px] font-medium mb-2">Colors</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {(["primary", "accent", "fg", "bg"] as const).map((slot) => (
              <ColorSlot
                key={slot}
                label={slot}
                value={draft.colors[slot] ?? "#000000"}
                onChange={(v) => setColor(slot, v)}
              />
            ))}
          </div>

          <p className="text-[12px] font-medium mb-2">Fonts</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {(["heading", "body"] as const).map((slot) => (
              <label key={slot} className="block">
                <span className="text-[11px] text-foreground/55 capitalize">{slot}</span>
                <input
                  value={draft.fonts[slot] ?? ""}
                  onChange={(e) => setFont(slot, e.target.value)}
                  placeholder={slot === "heading" ? "Playfair Display" : "Inter"}
                  className="w-full mt-1 px-3 py-1.5 rounded-md border border-border bg-card text-[12px] outline-none focus:border-[rgb(var(--primary))]"
                />
              </label>
            ))}
          </div>

          <div className="panel-card p-5 mb-5"
               style={{
                 background: draft.colors.bg ?? "#fff",
                 color: draft.colors.fg ?? "#111",
                 borderColor: "rgba(0,0,0,0.06)",
               }}>
            <p className="text-[10px] uppercase tracking-wider opacity-60 mb-1">Preview</p>
            <p style={{ fontFamily: draft.fonts.heading || "serif", fontSize: 28, fontWeight: 700 }}>
              {draft.name || "Brand Kit Preview"}
            </p>
            <p style={{ fontFamily: draft.fonts.body || "sans-serif", fontSize: 13, opacity: 0.7 }}>
              Decks using this kit will pick up these colours and fonts on next view.
            </p>
            <span
              className="inline-block mt-3 px-3 py-1.5 rounded-md text-[12px] font-medium"
              style={{ background: draft.colors.primary ?? "#000", color: "#fff" }}
            >
              Primary action
            </span>
          </div>

          {error && (
            <div className="text-[12px] px-3 py-2 rounded-lg bg-[rgb(var(--error)/0.08)] border border-[rgb(var(--error)/0.2)] text-[rgb(var(--error))] mb-3">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            {saved && (
              <span className="inline-flex items-center gap-1 text-[12px] text-[rgb(var(--success))] mr-2">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            )}
            <button
              type="button"
              disabled={pending || !draft.name.trim()}
              onClick={save}
              className="px-4 py-2 rounded-lg bg-[rgb(var(--primary))] text-white text-[13px] font-medium disabled:opacity-60"
            >
              {pending ? "Saving…" : active ? "Save changes" : "Create kit"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function ColorSlot({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="color"
        value={normaliseHex(value)}
        onChange={(e) => onChange(e.target.value)}
        className="w-9 h-9 rounded-md border border-border bg-card cursor-pointer"
      />
      <div className="flex-1">
        <span className="text-[11px] text-foreground/55 capitalize">{label}</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full mt-0.5 px-2 py-1 rounded-md border border-border bg-card text-[11px] font-mono outline-none focus:border-[rgb(var(--primary))]"
        />
      </div>
    </label>
  );
}

function normaliseHex(v: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^#[0-9a-fA-F]{3}$/.test(v)) return "#" + v.slice(1).split("").map((c) => c + c).join("");
  return "#000000";
}

function toDraft(k: BrandKit): BrandKitInput {
  return { id: k.id, name: k.name, colors: { ...k.colors }, fonts: { ...k.fonts } };
}
