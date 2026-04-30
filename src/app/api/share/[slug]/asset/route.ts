import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves the underlying file (currently PDF) for share-only decks. Same
 * password + expiry checks as /render. Used by the wrapper HTML the
 * /render route emits when the version's html_path ends in `.pdf`.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const pw = request.nextUrl.searchParams.get("pw") ?? "";

  const svc = createServiceClient();
  const { data: link } = await svc
    .schema("slides")
    .from("share_links")
    .select("id, deck_id, version_id, password_hash, expires_at, revoked_at")
    .eq("slug", slug)
    .single();
  if (!link || link.revoked_at) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }
  if (link.password_hash) {
    const supplied = pw ? createHash("sha256").update(pw).digest("hex") : "";
    if (supplied !== link.password_hash) {
      return NextResponse.json({ error: "password required" }, { status: 401 });
    }
  }

  let versionId = link.version_id;
  if (!versionId) {
    const { data: deck } = await svc
      .schema("slides")
      .from("decks")
      .select("current_version_id")
      .eq("id", link.deck_id)
      .single();
    versionId = deck?.current_version_id ?? null;
  }
  if (!versionId) return NextResponse.json({ error: "no version" }, { status: 404 });

  const { data: version } = await svc
    .schema("slides")
    .from("deck_versions")
    .select("html_path")
    .eq("id", versionId)
    .single();
  if (!version?.html_path) return NextResponse.json({ error: "no asset" }, { status: 404 });

  const { data: blob, error } = await svc.storage.from("slides-html").download(version.html_path);
  if (error || !blob) return NextResponse.json({ error: error?.message ?? "download failed" }, { status: 502 });

  const isPdf = version.html_path.endsWith(".pdf");
  return new NextResponse(blob, {
    status: 200,
    headers: {
      "Content-Type": isPdf ? "application/pdf" : "application/octet-stream",
      "Cache-Control": "public, max-age=60",
    },
  });
}
