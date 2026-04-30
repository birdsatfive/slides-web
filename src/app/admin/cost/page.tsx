import { redirect } from "next/navigation";
import { ArrowLeft, DollarSign, Layers, Sparkles, Timer } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Event {
  id: string;
  occurred_at: string;
  user_id: string | null;
  org_id: string | null;
  deck_id: string | null;
  kind: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  duration_ms: number;
  cost_usd: number;
  error: string | null;
}

const KIND_LABEL: Record<string, string> = {
  outline: "Outline",
  deck: "Deck",
  slide: "Remix",
  export_pdf: "PDF",
  extract: "Extract",
};

export default async function CostDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Last 30 days
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: rows } = await supabase
    .schema("slides")
    .from("generation_events")
    .select("id, occurred_at, user_id, org_id, deck_id, kind, model, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, duration_ms, cost_usd, error")
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(500);

  const events = (rows ?? []) as Event[];
  const total = events.reduce((s, e) => s + Number(e.cost_usd ?? 0), 0);
  const totalCalls = events.length;
  const totalSeconds = events.reduce((s, e) => s + (e.duration_ms ?? 0), 0) / 1000;
  const cacheReadShare =
    events.reduce((s, e) => s + e.cache_read_input_tokens, 0) /
    Math.max(1, events.reduce((s, e) => s + e.input_tokens + e.cache_read_input_tokens + e.cache_creation_input_tokens, 0));

  const byKind = aggregate(events, (e) => e.kind);
  const byModel = aggregate(events, (e) => e.model);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1100px] px-6 h-14 flex items-center gap-4">
          <a href="/" className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-[13px]">
            <ArrowLeft className="w-4 h-4" /> Library
          </a>
          <span className="font-medium tracking-tight">Cost</span>
          <span className="ml-2 text-[10px] uppercase tracking-wider text-foreground/40">last 30 days</span>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-6 py-8">
        <div className="grid grid-cols-4 gap-3 mb-6">
          <Stat icon={DollarSign} label="Total spend" value={`$${total.toFixed(2)}`} />
          <Stat icon={Sparkles} label="Calls" value={totalCalls.toString()} />
          <Stat icon={Timer} label="Compute time" value={fmtSec(totalSeconds)} />
          <Stat icon={Layers} label="Cache hit rate" value={`${Math.round(cacheReadShare * 100)}%`} />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-8">
          <Breakdown title="By kind" rows={byKind.map((r) => ({ ...r, label: KIND_LABEL[r.key] ?? r.key }))} />
          <Breakdown title="By model" rows={byModel.map((r) => ({ ...r, label: r.key }))} />
        </div>

        <h2 className="text-[14px] font-semibold mb-2">Recent calls</h2>
        {events.length === 0 ? (
          <div className="panel-card p-10 text-center text-[13px] text-foreground/50">
            No generation events yet. Make a deck and the cost rows will populate.
          </div>
        ) : (
          <div className="panel-card overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-[rgb(var(--fg)/0.04)] text-foreground/55">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Time</th>
                  <th className="text-left px-3 py-2 font-medium">Kind</th>
                  <th className="text-left px-3 py-2 font-medium">Model</th>
                  <th className="text-right px-3 py-2 font-medium">Input</th>
                  <th className="text-right px-3 py-2 font-medium">Output</th>
                  <th className="text-right px-3 py-2 font-medium">Cache R/W</th>
                  <th className="text-right px-3 py-2 font-medium">Time</th>
                  <th className="text-right px-3 py-2 font-medium">$</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t border-border/60">
                    <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">{new Date(e.occurred_at).toLocaleString()}</td>
                    <td className="px-3 py-1.5">{KIND_LABEL[e.kind] ?? e.kind}</td>
                    <td className="px-3 py-1.5 text-foreground/65">{e.model}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{e.input_tokens.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{e.output_tokens.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-foreground/55">
                      {e.cache_read_input_tokens.toLocaleString()} / {e.cache_creation_input_tokens.toLocaleString()}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-foreground/55">{fmtMs(e.duration_ms)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium">${Number(e.cost_usd).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function aggregate(events: Event[], by: (e: Event) => string) {
  const map = new Map<string, { key: string; calls: number; cost: number }>();
  for (const e of events) {
    const k = by(e);
    if (!k) continue;
    const cur = map.get(k) ?? { key: k, calls: 0, cost: 0 };
    cur.calls += 1;
    cur.cost += Number(e.cost_usd ?? 0);
    map.set(k, cur);
  }
  return [...map.values()].sort((a, b) => b.cost - a.cost);
}

function Breakdown({ title, rows }: { title: string; rows: Array<{ label: string; calls: number; cost: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.cost));
  return (
    <div className="panel-card p-4">
      <p className="text-[10px] uppercase tracking-wider text-foreground/40 mb-2">{title}</p>
      {rows.length === 0 ? (
        <p className="text-[12px] text-foreground/50">—</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <span className="font-medium truncate mr-2">{r.label}</span>
                <span className="tabular-nums text-foreground/65">${r.cost.toFixed(2)} · {r.calls}</span>
              </div>
              <div className="h-1.5 bg-[rgb(var(--fg)/0.06)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[rgb(var(--primary))]"
                  style={{ width: `${(r.cost / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="panel-card p-4">
      <div className="text-[10px] uppercase tracking-wider text-foreground/40 inline-flex items-center gap-1">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="text-[26px] font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function fmtSec(s: number) {
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60); const r = Math.round(s % 60);
  return r ? `${m}m ${r}s` : `${m}m`;
}
function fmtMs(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
