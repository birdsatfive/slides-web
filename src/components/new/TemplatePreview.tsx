"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState } from "react";

export interface TemplatePreviewSpec {
  name: string;
  vibe: string;
  colors: {
    bg_primary: string;
    bg_secondary: string;
    bg_tertiary: string;
    text_primary: string;
    text_secondary: string;
    text_muted: string;
    accent_primary: string;
    accent_secondary: string;
    accent_gradient: string;
  };
  fonts: { heading: string; body: string };
}

interface Props {
  open: boolean;
  spec: TemplatePreviewSpec | null;
  onClose: () => void;
}

const SLIDES = [
  { kind: "hero" as const, label: "Hero" },
  { kind: "stats" as const, label: "Stats" },
  { kind: "cards" as const, label: "Cards" },
  { kind: "two_col" as const, label: "Two-column" },
  { kind: "quote" as const, label: "Quote" },
  { kind: "cta" as const, label: "CTA" },
];

export function TemplatePreview({ open, spec, onClose }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!open) return;
    setIdx(0);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => Math.min(i + 1, SLIDES.length - 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !spec) return null;

  const slide = SLIDES[idx];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[1100px] h-[680px] rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <header className="absolute top-0 left-0 right-0 z-10 h-12 px-4 flex items-center justify-between bg-black/30 backdrop-blur-md text-white text-[12px]">
          <div className="flex items-center gap-3">
            <span className="font-medium">{spec.name}</span>
            <span className="text-white/50">{slide.label}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIdx((i) => Math.max(i - 1, 0))}
              disabled={idx === 0}
              className="w-7 h-7 rounded-md flex items-center justify-center text-white/70 hover:bg-white/10 disabled:opacity-30"
              title="Previous (←)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-white/55 tabular-nums px-1 text-[11px]">{idx + 1} / {SLIDES.length}</span>
            <button
              type="button"
              onClick={() => setIdx((i) => Math.min(i + 1, SLIDES.length - 1))}
              disabled={idx === SLIDES.length - 1}
              className="w-7 h-7 rounded-md flex items-center justify-center text-white/70 hover:bg-white/10 disabled:opacity-30"
              title="Next (→)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ml-2 w-7 h-7 rounded-md flex items-center justify-center text-white/70 hover:bg-white/10"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Slide canvas */}
        <SlideCanvas spec={spec} kind={slide.kind} />

        {/* Slide nav dots */}
        <nav className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
          {SLIDES.map((s, i) => (
            <button
              key={s.kind}
              type="button"
              onClick={() => setIdx(i)}
              className={
                "w-2 h-2 rounded-full transition-smooth " +
                (i === idx ? "bg-white scale-125" : "bg-white/40 hover:bg-white/70")
              }
            />
          ))}
        </nav>
      </div>
    </div>
  );
}

function SlideCanvas({ spec, kind }: { spec: TemplatePreviewSpec; kind: typeof SLIDES[number]["kind"] }) {
  const c = spec.colors;
  const fontHeading = `${spec.fonts.heading}, system-ui, sans-serif`;
  const fontBody = `${spec.fonts.body}, system-ui, sans-serif`;
  const bg = kind === "hero" || kind === "cta" ? c.bg_primary : c.bg_secondary;
  const isLight = isLightHex(bg);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center px-16 pt-12"
      style={{ background: bg, color: c.text_primary, fontFamily: fontBody }}
    >
      {kind === "hero" && (
        <Hero spec={spec} fontHeading={fontHeading} fontBody={fontBody} />
      )}
      {kind === "stats" && <Stats spec={spec} fontHeading={fontHeading} />}
      {kind === "cards" && <Cards spec={spec} fontHeading={fontHeading} />}
      {kind === "two_col" && <TwoCol spec={spec} fontHeading={fontHeading} />}
      {kind === "quote" && <Quote spec={spec} fontHeading={fontHeading} />}
      {kind === "cta" && <CTA spec={spec} fontHeading={fontHeading} isLight={isLight} />}
    </div>
  );
}

// ── Slide kinds ─────────────────────────────────────────────────────────

function Hero({ spec, fontHeading }: { spec: TemplatePreviewSpec; fontHeading: string; fontBody: string }) {
  const c = spec.colors;
  const useGradient = c.accent_gradient && c.accent_gradient !== "none";
  return (
    <>
      {useGradient && (
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: `radial-gradient(ellipse at 30% 50%, ${c.accent_primary}30 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, ${c.accent_secondary}25 0%, transparent 60%)`,
          }}
        />
      )}
      <div className="relative z-1 max-w-[800px] text-center">
        <p
          className="text-[12px] font-semibold uppercase tracking-[0.2em] mb-4"
          style={{ color: c.accent_primary }}
        >
          Q3 Update
        </p>
        <h1
          className="text-[64px] leading-[1.05] font-bold tracking-tight"
          style={{ fontFamily: fontHeading, color: c.text_primary }}
        >
          The work that mattered
        </h1>
        <p
          className="mt-6 text-[20px] leading-relaxed max-w-[560px] mx-auto"
          style={{ color: c.text_secondary }}
        >
          Five wins, three risks, and a 2026 plan worth defending.
        </p>
      </div>
    </>
  );
}

function Stats({ spec, fontHeading }: { spec: TemplatePreviewSpec; fontHeading: string }) {
  const c = spec.colors;
  const stats = [
    { value: "47", suffix: "%", label: "Pipeline growth" },
    { value: "$1.2", suffix: "M", label: "ARR added" },
    { value: "99.9", suffix: "%", label: "Uptime" },
  ];
  const useGradient = c.accent_gradient && c.accent_gradient !== "none";
  return (
    <div className="w-full max-w-[1000px]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: c.accent_primary }}>
        By the numbers
      </p>
      <h2 className="text-[36px] font-bold tracking-tight mb-12" style={{ fontFamily: fontHeading, color: c.text_primary }}>
        Q3 in three figures
      </h2>
      <div className="grid grid-cols-3 gap-12">
        {stats.map((s) => (
          <div key={s.label}>
            <p
              className="text-[88px] leading-none font-extrabold tracking-tight"
              style={
                useGradient
                  ? {
                      backgroundImage: c.accent_gradient,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      fontFamily: fontHeading,
                    }
                  : { color: c.accent_primary, fontFamily: fontHeading }
              }
            >
              {s.value}
              <span className="text-[44px]">{s.suffix}</span>
            </p>
            <p className="mt-2 text-[14px]" style={{ color: c.text_muted }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Cards({ spec, fontHeading }: { spec: TemplatePreviewSpec; fontHeading: string }) {
  const c = spec.colors;
  const cards = [
    { title: "Faster", body: "P95 latency down 38% after the cache rewrite." },
    { title: "Smarter", body: "AI agents now resolve 64% of inbound tickets without escalation." },
    { title: "Safer", body: "SOC 2 Type II completed; zero critical findings." },
  ];
  return (
    <div className="w-full max-w-[1000px]">
      <h2 className="text-[36px] font-bold tracking-tight mb-10" style={{ fontFamily: fontHeading, color: c.text_primary }}>
        Three pillars of Q3
      </h2>
      <div className="grid grid-cols-3 gap-5">
        {cards.map((card) => (
          <div
            key={card.title}
            className="p-6 rounded-2xl"
            style={{
              background: c.bg_tertiary,
              border: `1px solid ${c.text_primary}1a`,
            }}
          >
            <div
              className="w-9 h-9 rounded-lg mb-4"
              style={{ background: c.accent_primary }}
            />
            <h3
              className="text-[20px] font-bold mb-2"
              style={{ fontFamily: fontHeading, color: c.text_primary }}
            >
              {card.title}
            </h3>
            <p className="text-[14px] leading-relaxed" style={{ color: c.text_secondary }}>
              {card.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TwoCol({ spec, fontHeading }: { spec: TemplatePreviewSpec; fontHeading: string }) {
  const c = spec.colors;
  return (
    <div className="w-full max-w-[1000px] grid grid-cols-2 gap-16 items-center">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: c.accent_primary }}>
          The shift
        </p>
        <h2 className="text-[44px] font-bold tracking-tight leading-[1.05] mb-6" style={{ fontFamily: fontHeading, color: c.text_primary }}>
          From dashboards to decisions
        </h2>
        <p className="text-[16px] leading-relaxed" style={{ color: c.text_secondary }}>
          The old stack drowned in data. The new one ranks the next-best action automatically and tells you why.
        </p>
      </div>
      <div
        className="aspect-[4/3] rounded-2xl flex items-center justify-center"
        style={{
          background: c.accent_gradient && c.accent_gradient !== "none" ? c.accent_gradient : c.accent_primary,
        }}
      >
        <span className="text-[14px] font-semibold uppercase tracking-[0.15em] text-white/85">Diagram</span>
      </div>
    </div>
  );
}

function Quote({ spec, fontHeading }: { spec: TemplatePreviewSpec; fontHeading: string }) {
  const c = spec.colors;
  return (
    <div className="max-w-[800px] text-center">
      <p
        className="text-[44px] leading-[1.2] font-semibold"
        style={{ fontFamily: fontHeading, color: c.text_primary }}
      >
        “The new flow saved us six hours a week. It pays for itself before lunch on Monday.”
      </p>
      <div className="mt-10 flex items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-full" style={{ background: c.accent_primary }} />
        <div className="text-left">
          <p className="text-[14px] font-semibold" style={{ color: c.text_primary }}>Lena Park</p>
          <p className="text-[12px]" style={{ color: c.text_muted }}>VP Operations, Atlas Foods</p>
        </div>
      </div>
    </div>
  );
}

function CTA({ spec, fontHeading, isLight }: { spec: TemplatePreviewSpec; fontHeading: string; isLight: boolean }) {
  const c = spec.colors;
  return (
    <div className="text-center max-w-[700px]">
      <h2 className="text-[56px] font-bold tracking-tight leading-[1.05]" style={{ fontFamily: fontHeading, color: c.text_primary }}>
        Approve the 2026 plan?
      </h2>
      <p className="mt-6 text-[18px]" style={{ color: c.text_secondary }}>
        We need a green-light by Friday to lock the hiring pipeline.
      </p>
      <button
        type="button"
        className="mt-10 inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-[14px] font-semibold tracking-wide"
        style={{
          background:
            c.accent_gradient && c.accent_gradient !== "none" ? c.accent_gradient : c.accent_primary,
          color: isLight ? "#fff" : c.text_primary,
        }}
      >
        Schedule the decision call →
      </button>
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────

function isLightHex(hex: string): boolean {
  const m = /^#?([a-f\d]{6})$/i.exec(hex);
  if (!m) return true;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  // Perceived luminance (rec.601-ish)
  return (0.299 * r + 0.587 * g + 0.114 * b) > 140;
}
