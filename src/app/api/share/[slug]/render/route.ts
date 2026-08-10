import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public HTML proxy for /s/[slug] viewer iframe.
 * Validates the share-link is live + password matches, then streams the
 * stored HTML with the correct text/html Content-Type (Supabase Storage's
 * default is text/plain, which causes the browser to render it as source).
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

  // Resolve which version to serve: pinned on the link, else current on the deck.
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
    .select("html_path, generation_meta")
    .eq("id", versionId)
    .single();
  if (!version?.html_path) return NextResponse.json({ error: "not designed" }, { status: 404 });

  // Folder shares must be served from /f/, which acts as their document root.
  // Streaming the entry page from here would strand every relative link.
  const meta = (version.generation_meta ?? {}) as Record<string, unknown>;
  if (meta.kind === "html_bundle") {
    const entry = typeof meta.entry === "string" && meta.entry ? meta.entry : "index.html";
    const target = `/api/share/${slug}/f/${entry}${pw ? `?pw=${encodeURIComponent(pw)}` : ""}`;
    return NextResponse.redirect(new URL(target, request.url), 307);
  }

  // Share-only PDFs: emit a tiny HTML wrapper that embeds the PDF via the
  // sibling /asset route. Same auth (slug + pw) gates both endpoints.
  if (version.html_path.endsWith(".pdf")) {
    const assetUrl = `/api/share/${slug}/asset${pw ? `?pw=${encodeURIComponent(pw)}` : ""}`;
    const wrapper = pdfWrapperHtml(assetUrl);
    return new NextResponse(wrapper, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" },
    });
  }

  const { data: blob, error } = await svc.storage.from("slides-html").download(version.html_path);
  if (error || !blob) {
    return NextResponse.json({ error: error?.message ?? "download failed" }, { status: 502 });
  }

  const html = await blob.text();

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}

function pdfWrapperHtml(src: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Shared PDF</title>
<style>html,body{margin:0;height:100%;background:#0f0d10}embed,iframe{width:100%;height:100%;border:0;display:block}</style>
</head><body><embed src="${src}" type="application/pdf"></body></html>`;
}
