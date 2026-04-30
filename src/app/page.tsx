import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LibraryView, type DeckRow } from "@/components/library/LibraryView";
import { displayName } from "@/lib/auth/profile";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: decks } = await supabase
    .schema("slides")
    .from("decks")
    .select("id, title, updated_at, template_id, starred, current_version_id")
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  const deckList = decks ?? [];
  const versionIds = deckList
    .map((d) => d.current_version_id)
    .filter((v): v is string => Boolean(v));

  const [versionsRes, linksRes] = await Promise.all([
    versionIds.length
      ? supabase
          .schema("slides")
          .from("deck_versions")
          .select("id, html_path")
          .in("id", versionIds)
      : Promise.resolve({ data: [] as { id: string; html_path: string | null }[] }),
    deckList.length
      ? supabase
          .schema("slides")
          .from("share_links")
          .select("id, deck_id, expires_at, revoked_at")
          .in(
            "deck_id",
            deckList.map((d) => d.id),
          )
      : Promise.resolve({ data: [] as { id: string; deck_id: string; expires_at: string | null; revoked_at: string | null }[] }),
  ]);

  const linkRows = linksRes.data ?? [];
  const liveLinks = linkRows.filter(
    (l) => !l.revoked_at && (!l.expires_at || new Date(l.expires_at) > new Date()),
  );
  const liveLinkIds = liveLinks.map((l) => l.id);

  const { data: viewRows } = liveLinkIds.length
    ? await supabase
        .schema("slides")
        .from("share_views")
        .select("share_link_id")
        .in("share_link_id", liveLinkIds)
    : { data: [] as { share_link_id: string }[] };

  const versionsById = new Map(
    (versionsRes.data ?? []).map((v) => [v.id, v.html_path] as const),
  );
  const liveLinksByDeck = new Map<string, number>();
  for (const l of liveLinks) {
    liveLinksByDeck.set(l.deck_id, (liveLinksByDeck.get(l.deck_id) ?? 0) + 1);
  }
  const linkIdToDeck = new Map(linkRows.map((l) => [l.id, l.deck_id] as const));
  const viewsByDeck = new Map<string, number>();
  for (const v of viewRows ?? []) {
    const deckId = linkIdToDeck.get(v.share_link_id);
    if (!deckId) continue;
    viewsByDeck.set(deckId, (viewsByDeck.get(deckId) ?? 0) + 1);
  }

  const rows: DeckRow[] = deckList.map((d) => ({
    id: d.id,
    title: d.title,
    updated_at: d.updated_at,
    template_id: d.template_id,
    starred: d.starred,
    is_designed: d.current_version_id ? Boolean(versionsById.get(d.current_version_id)) : false,
    live_links: liveLinksByDeck.get(d.id) ?? 0,
    total_views: viewsByDeck.get(d.id) ?? 0,
  }));

  return (
    <LibraryView
      decks={rows}
      userName={displayName(user)}
      userEmail={user.email ?? ""}
    />
  );
}
