import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  bundleEntry,
  contentTypeFor,
  hashSharePassword,
  isBundle,
  resolveShare,
  safeRelPath,
  sharePasswordCookie,
} from "@/lib/share/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public file server for folder shares.
 *
 * Every file in the bundle is served under `/api/share/{slug}/f/…`, which
 * makes that path the document root: `href="spec-builder.html"` and
 * `src="assets/oterra.css"` inside the entry page resolve back through this
 * same route, so an uploaded folder works exactly as it does on disk.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string; path: string[] }> },
) {
  const { slug, path } = await context.params;
  const pw = request.nextUrl.searchParams.get("pw");
  const cookie = sharePasswordCookie(slug);
  const cookieHash = request.cookies.get(cookie.name)?.value ?? null;

  const access = await resolveShare(slug, { pw, cookieHash });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { share } = access;
  if (!isBundle(share.meta)) {
    return NextResponse.json({ error: "not a folder share" }, { status: 404 });
  }

  // An unusable path is rejected outright — falling back to the entry
  // document would answer 200 for requests that never named a real file.
  const rel = (path ?? []).length === 0 ? bundleEntry(share.meta) : safeRelPath(path);
  if (!rel) return NextResponse.json({ error: "bad path" }, { status: 400 });

  // `{deck_id}/{version_id}` — the bundle's storage root.
  const root = share.htmlPath.slice(0, share.htmlPath.lastIndexOf("/"));

  const svc = createServiceClient();
  let key = `${root}/${rel}`;
  let download = await svc.storage.from("slides-html").download(key);

  // Directory-style URL (`/f/reports`) — fall back to its index document.
  if (download.error && !rel.split("/").pop()?.includes(".")) {
    key = `${root}/${rel.replace(/\/$/, "")}/index.html`;
    download = await svc.storage.from("slides-html").download(key);
  }

  if (download.error || !download.data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const contentType = contentTypeFor(key);
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    // Password-gated bundles must never land in a shared cache.
    "Cache-Control": share.protectedLink ? "private, max-age=60" : "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
  };

  // Note: bundles are served from this app's own origin, so their scripts can
  // reach the viewer's session the same way an uploaded deck's HTML already
  // can. Forcing an opaque origin here (CSP `sandbox`, or dropping
  // `allow-same-origin` from the viewer's iframe) does close that, but it
  // also blanks the framed document and blocks @font-face, since a bundle's
  // requests for its own files then count as cross-origin. Isolating this on
  // a separate host is the fix that does not cost the render.

  const response = new NextResponse(download.data, { status: 200, headers });

  // The password rides the query string only on the entry request. Persist it
  // so the relative asset and sub-page requests that follow stay authorised.
  if (access.unlockedByQuery && pw) {
    response.cookies.set({
      name: cookie.name,
      value: hashSharePassword(pw),
      path: cookie.path,
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      maxAge: 12 * 60 * 60,
    });
  }

  return response;
}
