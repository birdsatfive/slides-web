import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Owner-only proxy for the underlying file (PDF) of a share-only deck.
 * The /render route emits an HTML wrapper that points <embed> at this.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ deckId: string }> },
) {
  const { deckId } = await context.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data: deck } = await supabase
    .schema("slides")
    .from("decks")
    .select("current_version_id")
    .eq("id", deckId)
    .single();
  if (!deck?.current_version_id) return NextResponse.json({ error: "deck not found" }, { status: 404 });

  const { data: version } = await supabase
    .schema("slides")
    .from("deck_versions")
    .select("html_path")
    .eq("id", deck.current_version_id)
    .single();
  if (!version?.html_path) return NextResponse.json({ error: "no asset" }, { status: 404 });

  const svc = createServiceClient();
  const { data: blob, error } = await svc.storage.from("slides-html").download(version.html_path);
  if (error || !blob) return NextResponse.json({ error: error?.message ?? "download failed" }, { status: 502 });

  const isPdf = version.html_path.endsWith(".pdf");
  return new NextResponse(blob, {
    status: 200,
    headers: {
      "Content-Type": isPdf ? "application/pdf" : "application/octet-stream",
      "Cache-Control": "private, max-age=60",
    },
  });
}
