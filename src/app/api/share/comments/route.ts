import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface PostBody {
  share_link_id: string;
  slide_id?: string | null;
  session_id?: string | null;
  author_name?: string;
  body: string;
}

/** GET ?share_link_id=… — list comments scoped to a single live share link. */
export async function GET(request: NextRequest) {
  const shareLinkId = request.nextUrl.searchParams.get("share_link_id");
  const slideId = request.nextUrl.searchParams.get("slide_id");
  if (!shareLinkId) return NextResponse.json({ error: "share_link_id required" }, { status: 400 });

  const svc = createServiceClient();

  // Verify the link is live (not revoked, not expired).
  const { data: link } = await svc
    .schema("slides")
    .from("share_links")
    .select("id, deck_id, revoked_at, expires_at")
    .eq("id", shareLinkId)
    .single();
  if (!link || link.revoked_at) return NextResponse.json({ comments: [] });
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ comments: [] });
  }

  let query = svc
    .schema("slides")
    .from("comments")
    .select("id, slide_id, author_name, body, created_at")
    .eq("deck_id", link.deck_id)
    .order("created_at", { ascending: true })
    .limit(500);
  if (slideId) query = query.eq("slide_id", slideId);

  const { data, error } = await query;
  if (error) {
    console.warn("[share/comments] list error", error);
    return NextResponse.json({ comments: [] }, { status: 500 });
  }
  return NextResponse.json({ comments: data ?? [] });
}

/** POST — anon comment via /s/[slug]; gated to live links only. */
export async function POST(request: NextRequest) {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body.share_link_id || !body.body || body.body.length > 4000) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data: link } = await svc
    .schema("slides")
    .from("share_links")
    .select("id, deck_id, revoked_at, expires_at")
    .eq("id", body.share_link_id)
    .single();
  if (!link || link.revoked_at) return NextResponse.json({ ok: false }, { status: 404 });
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ ok: false }, { status: 410 });
  }

  const { data, error } = await svc
    .schema("slides")
    .from("comments")
    .insert({
      deck_id: link.deck_id,
      share_link_id: body.share_link_id,
      slide_id: body.slide_id ?? null,
      session_id: body.session_id ?? null,
      author_name: (body.author_name ?? "").trim().slice(0, 80) || "Anonymous",
      body: body.body.trim(),
    })
    .select("id, slide_id, author_name, body, created_at")
    .single();
  if (error) {
    console.warn("[share/comments] insert error", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ comment: data });
}
