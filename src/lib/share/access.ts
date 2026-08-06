import "server-only";

import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Shared gate for the public share endpoints: resolve a slug to the version
 * it serves, after checking revocation, expiry and password.
 *
 * Folder shares need this in a helper rather than inline (as /render and
 * /asset do it) because every file in the bundle — sub-pages, CSS, images —
 * comes back through the same gate on its own request.
 */

export interface ResolvedShare {
  linkId: string;
  deckId: string;
  versionId: string;
  /** Storage key of the entry document, e.g. `{deck}/{version}/index.html`. */
  htmlPath: string;
  meta: Record<string, unknown>;
  /** True when the link carries a password — responses must not be cached publicly. */
  protectedLink: boolean;
}

export type ShareAccess =
  | { ok: true; share: ResolvedShare; unlockedByQuery: boolean }
  | { ok: false; status: 401 | 404 | 410; error: string };

export function hashSharePassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

/**
 * Cookie holding the accepted password hash. Scoped to this share's API path
 * so one unlocked link never grants access to another.
 */
export function sharePasswordCookie(slug: string): { name: string; path: string } {
  return { name: `share_pw_${slug}`, path: `/api/share/${slug}` };
}

export async function resolveShare(
  slug: string,
  auth: { pw?: string | null; cookieHash?: string | null },
): Promise<ShareAccess> {
  const svc = createServiceClient();

  const { data: link } = await svc
    .schema("slides")
    .from("share_links")
    .select("id, deck_id, version_id, password_hash, expires_at, revoked_at")
    .eq("slug", slug)
    .single();

  if (!link || link.revoked_at) return { ok: false, status: 404, error: "not found" };
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return { ok: false, status: 410, error: "expired" };
  }

  // A password may arrive on the query string (first hit, from the gate) or
  // in the cookie (every relative request the page makes afterwards).
  let unlockedByQuery = false;
  if (link.password_hash) {
    const fromQuery = auth.pw ? hashSharePassword(auth.pw) : null;
    if (fromQuery && fromQuery === link.password_hash) {
      unlockedByQuery = true;
    } else if (auth.cookieHash !== link.password_hash) {
      return { ok: false, status: 401, error: "password required" };
    }
  }

  let versionId = link.version_id as string | null;
  if (!versionId) {
    const { data: deck } = await svc
      .schema("slides")
      .from("decks")
      .select("current_version_id")
      .eq("id", link.deck_id)
      .single();
    versionId = deck?.current_version_id ?? null;
  }
  if (!versionId) return { ok: false, status: 404, error: "no version" };

  const { data: version } = await svc
    .schema("slides")
    .from("deck_versions")
    .select("html_path, generation_meta")
    .eq("id", versionId)
    .single();
  if (!version?.html_path) return { ok: false, status: 404, error: "not designed" };

  return {
    ok: true,
    unlockedByQuery,
    share: {
      linkId: link.id,
      deckId: link.deck_id,
      versionId,
      htmlPath: version.html_path,
      meta: (version.generation_meta ?? {}) as Record<string, unknown>,
      protectedLink: Boolean(link.password_hash),
    },
  };
}

export function isBundle(meta: Record<string, unknown>): boolean {
  return meta?.kind === "html_bundle";
}

/** Entry document of a bundle, relative to its root. */
export function bundleEntry(meta: Record<string, unknown>): string {
  const entry = meta?.entry;
  return typeof entry === "string" && entry ? entry : "index.html";
}

/**
 * Reject anything that could climb out of the bundle's storage prefix.
 * Returns the cleaned relative path, or null when the path is unusable.
 *
 * The storage key is interpolated into a URL, so a separator that survives
 * this function is resolved downstream: `a/b//../../x` addresses `x` at the
 * bucket root, i.e. another deck's files. Each segment is therefore decoded
 * to a fixed point *before* it is checked — decoding after a `/` split would
 * let `%252f%252e%252e` unfold into `/..` once the checks had already run.
 */
function cleanSegment(raw: string): string | null {
  let s = raw;
  for (let round = 0; round < 4; round++) {
    let next: string;
    try {
      next = decodeURIComponent(s);
    } catch {
      return null; // malformed escape — never a real filename
    }
    if (next === s) break;
    s = next;
  }
  if (s.length === 0 || s === ".") return "";
  if (s === ".." || s.includes("/") || s.includes("\\") || s.includes("\0")) return null;
  return s;
}

export function safeRelPath(segments: string[]): string | null {
  const parts: string[] = [];
  for (const raw of segments.flatMap((s) => s.split("/"))) {
    const clean = cleanSegment(raw);
    if (clean === null) return null;
    if (clean.length > 0) parts.push(clean);
  }

  if (parts.length === 0) return null;
  const path = parts.join("/");
  return path.length > 1024 ? null : path;
}

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  md: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  pdf: "application/pdf",
  zip: "application/zip",
};

export function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

export interface HtmlMeta {
  title?: string;
  description?: string;
  image?: string;
}

/**
 * Pull the tags a shared document declares about itself, so a link preview
 * describes the content rather than the app hosting it. Open Graph wins over
 * the plain tags, which is the precedence a crawler would apply.
 *
 * Only the head is scanned — the body can be megabytes and holds nothing
 * relevant.
 */
export function extractHtmlMeta(html: string): HtmlMeta {
  const head = html.slice(0, Math.max(html.search(/<\/head>/i), 0) || 16384);

  const meta = (attr: "property" | "name", key: string): string | undefined => {
    // content= may sit on either side of the identifying attribute.
    const patterns = [
      new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]*content=["']([^"']*)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${key}["']`, "i"),
    ];
    for (const re of patterns) {
      const m = head.match(re);
      if (m?.[1]?.trim()) return decodeEntities(m[1].trim());
    }
    return undefined;
  };

  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();

  return {
    title: meta("property", "og:title") ?? (titleTag ? decodeEntities(titleTag) : undefined),
    description: meta("property", "og:description") ?? meta("name", "description"),
    image: meta("property", "og:image"),
  };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
