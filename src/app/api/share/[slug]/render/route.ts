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
    .select("html_path")
    .eq("id", versionId)
    .single();
  if (!version?.html_path) return NextResponse.json({ error: "not designed" }, { status: 404 });

  const { data: blob, error } = await svc.storage.from("slides-html").download(version.html_path);
  if (error || !blob) {
    return NextResponse.json({ error: error?.message ?? "download failed" }, { status: 502 });
  }

  const { data: edits } = await svc
    .schema("slides")
    .from("deck_text_edits")
    .select("slide_id, element_index, new_text")
    .eq("version_id", versionId);

  let html = await blob.text();
  if (edits && edits.length > 0) {
    html = injectEditsScript(html, edits);
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}

/**
 * Apply persisted inline text edits to the served HTML by appending a
 * tiny in-page script. The script tags every editable element with its
 * index inside the slide (the same scheme the editor uses) and then
 * patches textContent for any matching edit.
 */
function injectEditsScript(
  html: string,
  edits: { slide_id: string; element_index: number; new_text: string }[],
): string {
  const payload = JSON.stringify(edits);
  const script = `<script>(function(){
    var EDITS = ${payload};
    var SEL = "h1,h2,h3,h4,h5,h6,p,li,blockquote,.slide-heading,.slide-label,.slide-stat-label";
    function apply(){
      var slides = document.querySelectorAll(".slide, section.slide");
      slides.forEach(function(slide){
        var sid = slide.getAttribute("data-slide-id");
        if (!sid) return;
        var els = slide.querySelectorAll(SEL);
        els.forEach(function(el, i){
          el.setAttribute("data-edit-slide-id", sid);
          el.setAttribute("data-edit-index", String(i));
        });
      });
      EDITS.forEach(function(e){
        var el = document.querySelector("[data-edit-slide-id='" + e.slide_id + "'][data-edit-index='" + e.element_index + "']");
        if (el) el.textContent = e.new_text;
      });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
    else apply();
  })();</script>`;
  if (html.includes("</body>")) return html.replace("</body>", script + "</body>");
  return html + script;
}
