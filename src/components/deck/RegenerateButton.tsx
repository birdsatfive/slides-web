"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Sparkles, X } from "lucide-react";
import { regenerateDeck } from "@/lib/decks/actions";

interface Props {
  deckId: string;
}

export function RegenerateButton({ deckId }: Props) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    start(async () => {
      try {
        await regenerateDeck(deckId, feedback.trim() || undefined);
        setOpen(false);
        setFeedback("");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Regenerate"
        className="px-3 py-1.5 rounded-md text-[12px] inline-flex items-center gap-1.5 border border-border hover:bg-[rgb(var(--fg)/0.04)] text-foreground/80"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Regenerate
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="panel-card w-[520px] max-w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-[16px] font-semibold inline-flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[rgb(var(--primary))]" /> Regenerate deck
                </h3>
                <p className="text-[12px] text-foreground/55 mt-0.5">
                  Optional: tell us what to change. Saved as a new version — the old
                  one stays browsable.
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-md flex items-center justify-center text-foreground/60 hover:bg-[rgb(var(--fg)/0.05)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              autoFocus
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              placeholder="More bullets, fewer paragraphs. Lead with the stat slide. Drop the timeline."
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-[13px] outline-none focus:border-[rgb(var(--primary))] focus:ring-2 focus:ring-[rgb(var(--primary)/0.2)] transition-smooth"
            />
            {error && (
              <p className="mt-2 text-[12px] text-[rgb(var(--error))]">{error}</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded-md text-[12px] text-foreground/65 hover:bg-[rgb(var(--fg)/0.05)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={run}
                className="px-4 py-1.5 rounded-md bg-[rgb(var(--primary))] text-white text-[12px] font-medium inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                <RefreshCw className={"w-3.5 h-3.5 " + (pending ? "animate-spin" : "")} />
                {pending ? "Regenerating…" : "Regenerate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
