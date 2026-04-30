import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OutlineEditor } from "@/components/outline/OutlineEditor";
import type { OutlineSlide } from "@/lib/api/slides";

export const dynamic = "force-dynamic";

export default async function OutlinePage({ params }: { params: Promise<{ deckId: string }> }) {
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
    .select("id, slide_tree, html_path")
    .eq("id", deck.current_version_id)
    .single();
  if (!version) notFound();

  const tree = (version.slide_tree as unknown as OutlineSlide[]) ?? [];

  return (
    <OutlineEditor
      deckId={deck.id}
      title={deck.title}
      versionId={version.id}
      slideTree={tree}
      hasRender={!!version.html_path}
    />
  );
}
