import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Auth-gated HTML proxy for the deck viewer iframe.
 *
 * Why proxy instead of iframing the Supabase signed URL? Supabase Storage
 * serves objects with `Content-Type: text/plain` regardless of what we
 * uploaded, so the browser renders the deck as source code in the iframe.
 * We re-emit the bytes with `text/html; charset=utf-8`.
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
  if (!deck?.current_version_id) {
    return NextResponse.json({ error: "deck not found" }, { status: 404 });
  }

  const { data: version } = await supabase
    .schema("slides")
    .from("deck_versions")
    .select("html_path")
    .eq("id", deck.current_version_id)
    .single();
  if (!version?.html_path) {
    return NextResponse.json({ error: "not designed yet" }, { status: 404 });
  }

  const svc = createServiceClient();

  if (version.html_path.endsWith(".pdf")) {
    const wrapper = `<!doctype html><html><head><meta charset="utf-8"><title>PDF</title>
<style>html,body{margin:0;height:100%;background:#0f0d10}embed{width:100%;height:100%;border:0;display:block}</style>
</head><body><embed src="/api/decks/${deckId}/asset" type="application/pdf"></body></html>`;
    return new NextResponse(wrapper, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, max-age=60" },
    });
  }

  const { data: blob, error } = await svc.storage.from("slides-html").download(version.html_path);
  if (error || !blob) {
    return NextResponse.json({ error: error?.message ?? "storage download failed" }, { status: 502 });
  }

  return new NextResponse(blob, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=60",
    },
  });
}
