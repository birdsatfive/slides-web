import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock, Eye, MessageSquare, Timer } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LinkCard } from "@/components/library/LinkCard";
import { fileKindFrom, fileKindLabel } from "@/lib/share/kind";

export const dynamic = "force-dynamic";

/**
 * Everything about one shared file: its links, who opened them, and what
 * viewers said. The file itself is served from /s/[slug] — this page is the
 * owner's side of it.
 */
export default async function SharedFilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: file } = await supabase
    .schema("slides")
    .from("decks")
    .select("id, title, current_version_id, created_at")
    .eq("id", id)
    .is("archived_at", null)
    .single();
  if (!file) notFound();

  const { data: version } = file.current_version_id
    ? await supabase
        .schema("slides")
        .from("deck_versions")
        .select("html_path, generation_meta")
        .eq("id", file.current_version_id)
        .single()
    : { data: null };

  const meta = (version?.generation_meta ?? {}) as Record<string, unknown>;
  const kind = fileKindFrom(meta, version?.html_path ?? null);
  const fileCount = typeof meta.file_count === "number" ? meta.file_count : null;

  const { data: links } = await supabase
    .schema("slides")
    .from("share_links")
    .select("id, slug, password_hash, created_at, revoked_at, expires_at")
    .eq("deck_id", id)
    .order("created_at", { ascending: false });

  const linkIds = (links ?? []).map((l) => l.id);
  const { data: views } = linkIds.length
    ? await supabase
        .schema("slides")
        .from("share_views")
        .select("share_link_id, session_id, active_seconds, opened_at, referer")
        .in("share_link_id", linkIds)
        .order("opened_at", { ascending: false })
    : { data: [] as ViewRow[] };

  const viewRows = (views ?? []) as ViewRow[];
  const sessions = viewRows.length;
  const totalSeconds = viewRows.reduce((sum, v) => sum + (v.active_seconds ?? 0), 0);
  const avgSeconds = sessions ? Math.round(totalSeconds / sessions) : 0;

  const { data: comments } = await supabase
    .schema("slides")
    .from("comments")
    .select("id, author_name, body, created_at")
    .eq("deck_id", id)
    .order("created_at", { ascending: false })
    .limit(200);

  const viewsByLink = new Map<string, number>();
  for (const v of viewRows) {
    viewsByLink.set(v.share_link_id, (viewsByLink.get(v.share_link_id) ?? 0) + 1);
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1100px] px-6 h-14 flex items-center gap-4">
          <a href="/" className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-[13px]">
            <ArrowLeft className="w-4 h-4" /> Files
          </a>
          <span className="font-medium tracking-tight truncate">{file.title}</span>
          <span className="text-[10px] uppercase tracking-wider text-foreground/40">
            {fileKindLabel(kind)}
            {fileCount ? ` · ${fileCount} files` : ""}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-6 py-8">
        <h2 className="text-[14px] font-semibold mb-2">Links</h2>
        <div className="space-y-2 mb-8">
          {(links ?? []).map((l) => (
            <LinkCard
              key={l.id}
              fileId={id}
              slug={l.slug}
              createdAt={l.created_at}
              revokedAt={l.revoked_at}
              expiresAt={l.expires_at}
              hasPassword={Boolean(l.password_hash)}
              views={viewsByLink.get(l.id) ?? 0}
            />
          ))}
          {(links ?? []).length === 0 && (
            <div className="panel-card p-6 text-center text-[12px] text-foreground/50">
              This file has no link.
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat icon={Eye} label="Sessions" value={sessions.toString()} />
          <Stat icon={Timer} label="Avg active time" value={fmtSec(avgSeconds)} />
          <Stat icon={MessageSquare} label="Comments" value={(comments?.length ?? 0).toString()} />
        </div>

        <h2 className="text-[14px] font-semibold mb-2">Recent views</h2>
        {viewRows.length > 0 ? (
          <div className="panel-card overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-[rgb(var(--fg)/0.04)] text-foreground/55">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Opened</th>
                  <th className="text-left px-3 py-2 font-medium">Active</th>
                  <th className="text-left px-3 py-2 font-medium">Referer</th>
                </tr>
              </thead>
              <tbody>
                {viewRows.map((v) => (
                  <tr key={v.session_id} className="border-t border-border/60">
                    <td className="px-3 py-2 tabular-nums">{new Date(v.opened_at).toLocaleString()}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtSec(v.active_seconds ?? 0)}</td>
                    <td className="px-3 py-2 truncate max-w-[320px] text-foreground/55">{v.referer ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="panel-card p-10 text-center text-[13px] text-foreground/50">
            <Clock className="w-4 h-4 mx-auto mb-2 text-foreground/30" />
            No views yet. Send the link to start collecting stats.
          </div>
        )}

        <h2 className="text-[14px] font-semibold mb-2 mt-8">Comments</h2>
        {comments && comments.length > 0 ? (
          <ul className="space-y-2">
            {comments.map((c) => (
              <li key={c.id} className="panel-card p-3">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[12px] font-medium">{c.author_name}</span>
                  <span className="text-[10px] text-foreground/40">
                    {new Date(c.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-[12px] text-foreground/85 whitespace-pre-wrap">{c.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="panel-card p-6 text-center text-[12px] text-foreground/50">
            No comments yet.
          </div>
        )}
      </main>
    </div>
  );
}

interface ViewRow {
  share_link_id: string;
  session_id: string;
  active_seconds: number | null;
  opened_at: string;
  referer: string | null;
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
