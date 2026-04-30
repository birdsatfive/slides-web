"use server";

import { revalidatePath } from "next/cache";
import { customAlphabet } from "nanoid";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { slidesApi } from "@/lib/api/slides";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveOrgId } from "@/lib/auth/org";

const SLUG_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const slug = customAlphabet(SLUG_ALPHABET, 10);

interface CreateShareLinkInput {
  deckId: string;
  versionId?: string;        // pin to a specific version; null = always-current
  password?: string;
  expiresIn?: "24h" | "7d" | "30d" | "never";
}

function expiryFromInput(v?: string): string | null {
  if (!v || v === "never") return null;
  const ms = v === "24h" ? 24 * 3600 * 1000 : v === "7d" ? 7 * 24 * 3600 * 1000 : 30 * 24 * 3600 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

export async function createShareLink(input: CreateShareLinkInput): Promise<{ slug: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const { data, error } = await supabase
    .schema("slides")
    .from("share_links")
    .insert({
      deck_id: input.deckId,
      version_id: input.versionId ?? null,
      slug: slug(),
      password_hash: input.password ? createHash("sha256").update(input.password).digest("hex") : null,
      expires_at: expiryFromInput(input.expiresIn),
      created_by: user.id,
    })
    .select("slug")
    .single();
  if (error || !data) throw new Error(error?.message);

  revalidatePath(`/d/${input.deckId}`);
  return { slug: data.slug };
}

export async function revokeShareLink(deckId: string, slug: string) {
  const supabase = await createClient();
  await supabase
    .schema("slides")
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("slug", slug);
  revalidatePath(`/d/${deckId}`);
}

/**
 * Create a deck from a pre-built artifact (HTML file, raw HTML paste, or
 * PDF) and return a shareable link in one shot. No AI generation involved
 * — the user already has a finished file and just wants a hosted URL with
 * optional password + expiry.
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

  // 2) Insert deck row
  const { data: deck, error: dErr } = await supabase
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
  const { data: version, error: vErr } = await supabase
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

  // 4) Upload to storage. We keep one bucket (slides-html) — the path's
  //    extension tells the share render route how to serve it.
  const path = `${deck.id}/${version.id}.${ext}`;
  const svc = createServiceClient();
  const { error: upErr } = await svc.storage
    .from("slides-html")
    .upload(path, bytes, { contentType, upsert: true });
  if (upErr) throw new Error(`upload failed: ${upErr.message}`);

  // 5) Patch version with html_path + deck.current_version_id
  await supabase
    .schema("slides")
    .from("deck_versions")
    .update({ html_path: path })
    .eq("id", version.id);
  await supabase
    .schema("slides")
    .from("decks")
    .update({ current_version_id: version.id })
    .eq("id", deck.id);

  // 6) Share link
  const { data: link, error: lErr } = await supabase
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

export async function exportDeckToPdf(deckId: string, versionId: string): Promise<{ url: string }> {
  // Fetch the rendered HTML from storage, ship it to /v1/export/pdf, return signed URL.
  const svc = createServiceClient();
  const supabase = await createClient();

  const { data: version, error } = await supabase
    .schema("slides")
    .from("deck_versions")
    .select("html_path")
    .eq("id", versionId)
    .single();
  if (error || !version?.html_path) throw new Error("no rendered HTML — render the deck first");

  const { data: blob, error: dlErr } = await svc.storage.from("slides-html").download(version.html_path);
  if (dlErr || !blob) throw new Error(`download failed: ${dlErr?.message}`);
  const html = await blob.text();

  const { path } = await slidesApi.exportPdf({ deck_id: deckId, version_id: versionId, html });

  const { data: signed } = await svc.storage.from("slides-assets").createSignedUrl(path, 60 * 60);
  if (!signed?.signedUrl) throw new Error("signed url not generated");
  return { url: signed.signedUrl };
}
