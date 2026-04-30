import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeckViewer } from "@/components/deck/DeckViewer";
import type { OutlineSlide } from "@/lib/api/slides";

export const dynamic = "force-dynamic";

export default async function DeckPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: deck } = await supabase
    .schema("slides")
    .from("decks")
    .select("id, title, current_version_id")
    .eq("id", deckId)
    .single();
  if (!deck) notFound();

  const { data: version } = await supabase
    .schema("slides")
    .from("deck_versions")
    .select("id, slide_tree, html_path, created_at")
    .eq("id", deck.current_version_id)
    .single();
  if (!version) notFound();

  // Iframe loads through our own /api/decks/[id]/render proxy — Supabase
  // Storage forces text/plain on download, which would render the deck as
  // source code in the iframe.
  const htmlUrl = version.html_path ? `/api/decks/${deck.id}/render` : null;

  const tree = (version.slide_tree as unknown as OutlineSlide[]) ?? [];

  const { data: links } = await supabase
    .schema("slides")
    .from("share_links")
    .select("id, slug, password_hash, expires_at, revoked_at, created_at")
    .eq("deck_id", deck.id)
    .order("created_at", { ascending: false });

  const { data: edits } = await supabase
    .schema("slides")
    .from("deck_text_edits")
    .select("slide_id, element_index, new_text")
    .eq("version_id", version.id);

  return (
    <DeckViewer
      deckId={deck.id}
      title={deck.title}
      versionId={version.id}
      slideTree={tree}
      htmlUrl={htmlUrl}
      shareLinks={links ?? []}
      textEdits={edits ?? []}
    />
  );
}
