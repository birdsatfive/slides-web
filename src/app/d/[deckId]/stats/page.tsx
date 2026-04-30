import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Eye, Clock, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DeckStats({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: deck } = await supabase
    .schema("slides")
    .from("decks")
    .select("id, title")
    .eq("id", deckId)
    .single();
  if (!deck) notFound();

  const { data: links } = await supabase
    .schema("slides")
    .from("share_links")
    .select("id, slug, created_at, revoked_at, expires_at")
    .eq("deck_id", deckId);

  const linkIds = (links ?? []).map((l) => l.id);
  const { data: views } = linkIds.length
    ? await supabase
        .schema("slides")
        .from("share_views")
        .select("share_link_id, session_id, slides_seen, active_seconds, opened_at, last_seen_at, referer, ua")
        .in("share_link_id", linkIds)
        .order("opened_at", { ascending: false })
    : { data: [] };

  const sessions = views?.length ?? 0;
  const totalSeconds = (views ?? []).reduce((sum, v) => sum + (v.active_seconds ?? 0), 0);
  const avgSeconds = sessions ? Math.round(totalSeconds / sessions) : 0;
  const uniqueSlides = new Set<number>();
  for (const v of views ?? []) for (const s of (v.slides_seen ?? [])) uniqueSlides.add(s);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1100px] px-6 h-14 flex items-center gap-4">
          <a href={`/d/${deckId}`} className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-[13px]">
            <ArrowLeft className="w-4 h-4" /> Back to deck
          </a>
          <span className="font-medium tracking-tight truncate">{deck.title}</span>
          <span className="ml-2 text-[10px] uppercase tracking-wider text-foreground/40">Stats</span>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-6 py-8">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat icon={Eye} label="Sessions" value={sessions.toString()} />
          <Stat icon={Users} label="Slides explored" value={uniqueSlides.size.toString()} />
          <Stat icon={Clock} label="Avg active time" value={fmtSec(avgSeconds)} />
        </div>

        <h2 className="text-[14px] font-semibold mb-2">Recent views</h2>
        {views && views.length > 0 ? (
          <div className="panel-card overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-[rgb(var(--fg)/0.04)] text-foreground/55">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Opened</th>
                  <th className="text-left px-3 py-2 font-medium">Active</th>
                  <th className="text-left px-3 py-2 font-medium">Slides seen</th>
                  <th className="text-left px-3 py-2 font-medium">Referer</th>
                </tr>
              </thead>
              <tbody>
                {views.map((v) => (
                  <tr key={v.session_id} className="border-t border-border/60">
                    <td className="px-3 py-2 tabular-nums">{new Date(v.opened_at).toLocaleString()}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtSec(v.active_seconds ?? 0)}</td>
                    <td className="px-3 py-2 tabular-nums">{(v.slides_seen ?? []).length}</td>
                    <td className="px-3 py-2 truncate max-w-[260px] text-foreground/55">{v.referer ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="panel-card p-10 text-center text-[13px] text-foreground/50">
            No views yet. Share the deck to start collecting stats.
          </div>
        )}
      </main>
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
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}
