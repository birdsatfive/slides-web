import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
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

  // Sign a one-hour URL for the rendered HTML (service-role; bucket is private).
  let signedUrl: string | null = null;
  if (version.html_path) {
    const svc = createServiceClient();
    const { data: signed } = await svc.storage
      .from("slides-html")
      .createSignedUrl(version.html_path, 60 * 60);
    signedUrl = signed?.signedUrl ?? null;
  }

  const tree = (version.slide_tree as unknown as OutlineSlide[]) ?? [];

  const { data: links } = await supabase
    .schema("slides")
    .from("share_links")
    .select("id, slug, password_hash, expires_at, revoked_at, created_at")
    .eq("deck_id", deck.id)
    .order("created_at", { ascending: false });

  return (
    <DeckViewer
      deckId={deck.id}
      title={deck.title}
      versionId={version.id}
      slideTree={tree}
      htmlUrl={signedUrl}
      shareLinks={links ?? []}
    />
  );
}
