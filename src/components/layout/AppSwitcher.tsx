"use client";

import { useEffect, useRef, useState } from "react";
import { Grid2x2, Check } from "lucide-react";
import { BAF_SERVICES } from "@/lib/services";

export function AppSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Switch service"
        className="w-9 h-9 rounded-lg flex items-center justify-center text-foreground/70 hover:bg-[rgb(var(--primary)/0.08)] hover:text-foreground transition-smooth"
      >
        <Grid2x2 className="w-[18px] h-[18px]" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[420px] rounded-2xl border border-border bg-card p-3 shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
          <div className="px-2 pt-1 pb-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-foreground/40">
              BirdsAtFive
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {BAF_SERVICES.map((svc) => {
              const Icon = svc.icon;
              const content = (
                <>
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${svc.accent}, ${svc.accent}aa)`,
                    }}
                  >
                    <Icon className="w-4 h-4 text-white" strokeWidth={2.25} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <p className="text-[13px] font-medium text-foreground whitespace-nowrap">
                        {svc.name}
                      </p>
                      {svc.self && (
                        <Check className="w-3 h-3 text-[rgb(var(--primary))] shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-foreground/40 truncate">
                      {svc.description}
                    </p>
                  </div>
                </>
              );

              if (svc.self) {
                return (
                  <div
                    key={svc.id}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[rgb(var(--primary)/0.08)] border border-[rgb(var(--primary)/0.25)] cursor-default"
                  >
                    {content}
                  </div>
                );
              }

              return (
                <a
                  key={svc.id}
                  href={svc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-[rgb(var(--primary)/0.06)] transition-smooth border border-transparent hover:border-[rgb(var(--primary)/0.2)]"
                  onClick={() => setOpen(false)}
                >
                  {content}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
