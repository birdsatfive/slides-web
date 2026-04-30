"use client";

import { useEffect, useState } from "react";
import { Check, FileSearch, Layout, Sparkles } from "lucide-react";

const STAGES = [
  { id: "extract", label: "Extracting source", icon: FileSearch, durationMs: 8000 },
  { id: "outline", label: "Planning the outline", icon: Layout, durationMs: 7000 },
  { id: "design",  label: "Designing the deck",   icon: Sparkles, durationMs: 999_999_000 }, // open-ended
];

interface Props {
  open: boolean;
  templateName?: string | null;
  deckTitle?: string;
}

/**
 * Full-screen overlay while createDeck is running. Server action is one
 * round-trip with no progress events — we time-advance through the stages
 * as a believable cue. Stage 3 stays active until the redirect lands.
 */
export function GenerationOverlay({ open, templateName, deckTitle }: Props) {
  const [stageIdx, setStageIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!open) return;
    setStageIdx(0);
    setElapsed(0);
    const startedAt = Date.now();

    const tick = setInterval(() => setElapsed(Date.now() - startedAt), 200);

    let acc = 0;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < STAGES.length - 1; i++) {
      acc += STAGES[i].durationMs;
      timeouts.push(setTimeout(() => setStageIdx(i + 1), acc));
    }

    return () => {
      clearInterval(tick);
      timeouts.forEach(clearTimeout);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[rgb(var(--bg))]/85 backdrop-blur-md flex items-center justify-center px-6">
      <div className="panel-card w-[460px] max-w-full p-7">
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #F58ED3, #D159A3)",
              boxShadow: "0 8px 24px rgba(245,142,211,0.45)",
            }}
          >
            <Sparkles className="w-5 h-5 text-white animate-pulse" strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-foreground/40 mb-0.5">
              {templateName ? `${templateName} · ` : ""}Generating
            </p>
            <h2 className="text-[16px] font-semibold truncate">
              {deckTitle || "Your deck"}
            </h2>
          </div>
        </div>

        <ul className="space-y-2 mb-5">
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            const isDone = i < stageIdx;
            const isActive = i === stageIdx;
            return (
              <li key={s.id} className="flex items-center gap-3">
                <div
                  className={
                    "w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-smooth " +
                    (isDone
                      ? "bg-[rgb(var(--success)/0.18)] text-[rgb(var(--success))]"
                      : isActive
                      ? "bg-[rgb(var(--primary)/0.15)] text-[rgb(var(--primary))]"
                      : "bg-[rgb(var(--fg)/0.05)] text-foreground/35")
                  }
                >
                  {isDone ? (
                    <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                  ) : isActive ? (
                    <span className="w-2 h-2 rounded-full bg-[rgb(var(--primary))] animate-pulse" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                </div>
                <span
                  className={
                    "text-[13px] " +
                    (isDone
                      ? "text-foreground/55 line-through decoration-foreground/15"
                      : isActive
                      ? "text-foreground font-medium"
                      : "text-foreground/40")
                  }
                >
                  {s.label}
                </span>
                {isActive && (
                  <span className="ml-auto text-[10px] text-foreground/40 tabular-nums">
                    {fmtSec(elapsed)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="h-1 rounded-full bg-[rgb(var(--fg)/0.06)] overflow-hidden">
          <div
            className="h-full"
            style={{
              width: `${Math.min(95, (stageIdx / (STAGES.length - 1)) * 60 + (elapsed / 1000) * 0.8)}%`,
              background: "linear-gradient(90deg, #F58ED3, #D159A3)",
              transition: "width 200ms linear",
            }}
          />
        </div>

        <p className="mt-5 text-[11px] text-foreground/45 leading-relaxed">
          Designing typically takes 30–60 seconds. We&apos;ll redirect you to the
          deck when it&apos;s ready. Cost shows up on{" "}
          <span className="font-mono">/admin/cost</span>.
        </p>
      </div>
    </div>
  );
}

function fmtSec(ms: number): string {
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}
