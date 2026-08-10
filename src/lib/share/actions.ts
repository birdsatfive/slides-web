"use server";

import { revalidatePath } from "next/cache";
import { customAlphabet } from "nanoid";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveOrgId } from "@/lib/auth/org";
import { safeRelPath } from "@/lib/share/access";

const SLUG_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const slug = customAlphabet(SLUG_ALPHABET, 10);

function expiryFromInput(v?: string): string | null {
  if (!v || v === "never") return null;
  const ms = v === "24h" ? 24 * 3600 * 1000 : v === "7d" ? 7 * 24 * 3600 * 1000 : 30 * 24 * 3600 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

/** Kill a link without touching the file — the URL 404s from the next hit on. */
export async function revokeShareLink(fileId: string, linkSlug: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .schema("slides")
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("slug", linkSlug);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath(`/f/${fileId}`);
}

/**
 * Soft-delete a shared file: the row is archived, so it drops out of the
 * library and its links stop resolving.
 */
export async function deleteSharedFile(fileId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const now = new Date().toISOString();
  const { error } = await supabase
    .schema("slides")
    .from("decks")
    .update({ archived_at: now })
    .eq("id", fileId);
  if (error) throw new Error(error.message);

  // Archiving hides the file from us; revoking is what stops the public link,
  // which is the half a recipient can see.
  await supabase
    .schema("slides")
    .from("share_links")
    .update({ revoked_at: now })
    .eq("deck_id", fileId)
    .is("revoked_at", null);

  revalidatePath("/");
}

/**
 * Store an uploaded artifact (HTML file, raw HTML paste, or PDF) and return a
 * shareable link in one shot.
 */
export async function createSharedFile(input: {
  title: string;
  kind: "html_file" | "html_raw" | "pdf";
  payload: File | string;
  password?: string;
  expiresIn?: "24h" | "7d" | "30d" | "never";
}): Promise<{ slug: string; deckId: string; password?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const orgId = resolveOrgId(user.app_metadata as Record<string, unknown> | undefined);

  // 1) Bytes + content-type + extension based on input kind
  let bytes: Buffer;
  let ext: "html" | "pdf";
  let contentType: string;
  if (input.kind === "html_file") {
    if (!(input.payload instanceof File)) throw new Error("missing file");
    bytes = Buffer.from(await input.payload.arrayBuffer());
    ext = "html";
    contentType = "text/html; charset=utf-8";
  } else if (input.kind === "pdf") {
    if (!(input.payload instanceof File)) throw new Error("missing file");
    bytes = Buffer.from(await input.payload.arrayBuffer());
    ext = "pdf";
    contentType = "application/pdf";
  } else {
    if (typeof input.payload !== "string" || !input.payload.trim()) throw new Error("missing html");
    bytes = Buffer.from(input.payload, "utf-8");
    ext = "html";
    contentType = "text/html; charset=utf-8";
  }

  const svc = createServiceClient();

  // 2) Insert deck row (service-role: avoids any RLS pitfall on share-only
  //    decks; we've already verified auth above)
  const { data: deck, error: dErr } = await svc
    .schema("slides")
    .from("decks")
    .insert({
      org_id: orgId,
      owner_id: user.id,
      title: input.title || "Shared file",
      source_kind: "shared_only",
      source_ref: input.payload instanceof File ? input.payload.name : null,
    })
    .select("id")
    .single();
  if (dErr || !deck) throw new Error(dErr?.message ?? "deck insert failed");

  // 3) Insert empty version (slide_tree is NOT NULL)
  const { data: version, error: vErr } = await svc
    .schema("slides")
    .from("deck_versions")
    .insert({
      deck_id: deck.id,
      label: "Uploaded",
      slide_tree: [],
      generation_meta: { share_only: true, kind: input.kind },
      created_by: user.id,
    })
    .select("id")
    .single();
  if (vErr || !version) throw new Error(vErr?.message ?? "version insert failed");

  // 4) Upload to storage. One bucket (slides-html); extension drives
  //    serving.
  const path = `${deck.id}/${version.id}.${ext}`;
  const { error: upErr } = await svc.storage
    .from("slides-html")
    .upload(path, bytes, { contentType, upsert: true });
  if (upErr) throw new Error(`upload failed: ${upErr.message}`);

  // 5) Patch version with html_path + deck.current_version_id (atomic
  //    via service role — earlier user-scoped UPDATE was silently
  //    rejected by RLS in some cases, leaving html_path NULL → share
  //    viewer 404).
  const { error: vUpdErr } = await svc
    .schema("slides")
    .from("deck_versions")
    .update({ html_path: path })
    .eq("id", version.id);
  if (vUpdErr) throw new Error(`version update failed: ${vUpdErr.message}`);

  const { error: dUpdErr } = await svc
    .schema("slides")
    .from("decks")
    .update({ current_version_id: version.id })
    .eq("id", deck.id);
  if (dUpdErr) throw new Error(`deck update failed: ${dUpdErr.message}`);

  // 6) Share link
  const { data: link, error: lErr } = await svc
    .schema("slides")
    .from("share_links")
    .insert({
      deck_id: deck.id,
      version_id: version.id,
      slug: slug(),
      password_hash: input.password ? createHash("sha256").update(input.password).digest("hex") : null,
      expires_at: expiryFromInput(input.expiresIn),
      created_by: user.id,
    })
    .select("slug")
    .single();
  if (lErr || !link) throw new Error(lErr?.message ?? "share link insert failed");

  revalidatePath("/");
  return { slug: link.slug, deckId: deck.id, password: input.password };
}

/**
 * Folder share, step 1 — reserve the deck, version and link before any bytes
 * move. Files are uploaded one request at a time (see `uploadBundleFile`) so
 * a large folder never rides on a single request body.
 */
export async function createBundleShare(input: {
  title: string;
  entry: string;
  fileCount: number;
  password?: string;
  expiresIn?: "24h" | "7d" | "30d" | "never";
}): Promise<{ slug: string; deckId: string; versionId: string; password?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const entry = sanitizeRelPath(input.entry);
  if (!entry || !/\.html?$/i.test(entry)) throw new Error("entry must be an .html file");

  const orgId = resolveOrgId(user.app_metadata as Record<string, unknown> | undefined);
  const svc = createServiceClient();

  const { data: deck, error: dErr } = await svc
    .schema("slides")
    .from("decks")
    .insert({
      org_id: orgId,
      owner_id: user.id,
      title: input.title || "Shared folder",
      source_kind: "shared_bundle",
      source_ref: entry,
    })
    .select("id")
    .single();
  if (dErr || !deck) throw new Error(dErr?.message ?? "deck insert failed");

  const { data: version, error: vErr } = await svc
    .schema("slides")
    .from("deck_versions")
    .insert({
      deck_id: deck.id,
      label: "Uploaded",
      slide_tree: [],
      generation_meta: {
        share_only: true,
        kind: "html_bundle",
        entry,
        file_count: input.fileCount,
      },
      created_by: user.id,
    })
    .select("id")
    .single();
  if (vErr || !version) throw new Error(vErr?.message ?? "version insert failed");

  // html_path points at the entry document; everything before the last slash
  // is the bundle root the /f/ route serves from.
  const htmlPath = `${deck.id}/${version.id}/${entry}`;
  const { error: vUpdErr } = await svc
    .schema("slides")
    .from("deck_versions")
    .update({ html_path: htmlPath })
    .eq("id", version.id);
  if (vUpdErr) throw new Error(`version update failed: ${vUpdErr.message}`);

  const { error: dUpdErr } = await svc
    .schema("slides")
    .from("decks")
    .update({ current_version_id: version.id })
    .eq("id", deck.id);
  if (dUpdErr) throw new Error(`deck update failed: ${dUpdErr.message}`);

  const { data: link, error: lErr } = await svc
    .schema("slides")
    .from("share_links")
    .insert({
      deck_id: deck.id,
      version_id: version.id,
      slug: slug(),
      password_hash: input.password ? createHash("sha256").update(input.password).digest("hex") : null,
      expires_at: expiryFromInput(input.expiresIn),
      created_by: user.id,
    })
    .select("slug")
    .single();
  if (lErr || !link) throw new Error(lErr?.message ?? "share link insert failed");

  revalidatePath("/");
  return { slug: link.slug, deckId: deck.id, versionId: version.id, password: input.password };
}

/**
 * Folder share, step 2 — upload one file of the bundle at its path relative
 * to the folder root.
 */
export async function uploadBundleFile(input: {
  deckId: string;
  versionId: string;
  relPath: string;
  file: File;
}): Promise<{ ok: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const rel = sanitizeRelPath(input.relPath);
  if (!rel) throw new Error(`invalid path: ${input.relPath}`);

  const svc = createServiceClient();

  // The version must belong to a deck this user owns — the deck id alone is
  // caller-supplied, so it is never trusted on its own.
  //
  // The relationship is named explicitly: decks points back at deck_versions
  // through current_version_id, so a bare `decks(...)` embed is ambiguous and
  // PostgREST rejects the whole query (PGRST201) rather than picking one.
  const { data: version, error: vErr } = await svc
    .schema("slides")
    .from("deck_versions")
    .select("id, deck_id, decks!deck_versions_deck_id_fkey!inner(owner_id)")
    .eq("id", input.versionId)
    .eq("deck_id", input.deckId)
    .single();
  if (vErr) throw new Error(`bundle lookup failed: ${vErr.message}`);
  const deck = (version as { decks?: { owner_id?: string } | { owner_id?: string }[] } | null)?.decks;
  const owner = Array.isArray(deck) ? deck[0]?.owner_id : deck?.owner_id;
  if (!version || owner !== user.id) throw new Error("not your bundle");

  const bytes = Buffer.from(await input.file.arrayBuffer());
  const contentType =
    mimeFromPath(rel) ?? (input.file.type || "application/octet-stream");

  const { error } = await svc.storage
    .from("slides-html")
    .upload(`${input.deckId}/${input.versionId}/${rel}`, bytes, {
      contentType,
      upsert: true,
    });
  if (error) throw new Error(`upload failed (${rel}): ${error.message}`);

  return { ok: true };
}

/**
 * Upload paths come from the client, and the key is interpolated into a URL —
 * so an unchecked `..` would let a caller write over another deck's files.
 * Same gate as the read side.
 */
function sanitizeRelPath(raw: string): string | null {
  return safeRelPath(raw.replace(/\\/g, "/").split("/"));
}

/**
 * Content type by extension. Browsers get the type from Storage metadata on
 * the way back out, and `File.type` is empty for plenty of web assets
 * (.woff2, .mjs) — so the extension decides wherever it can.
 */
function mimeFromPath(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    html: "text/html; charset=utf-8",
    htm: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    mjs: "text/javascript; charset=utf-8",
    json: "application/json; charset=utf-8",
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
    mp4: "video/mp4",
    webm: "video/webm",
    pdf: "application/pdf",
  };
  return map[ext] ?? null;
}
