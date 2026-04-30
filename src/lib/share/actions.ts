"use server";

import { revalidatePath } from "next/cache";
import { customAlphabet } from "nanoid";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { slidesApi } from "@/lib/api/slides";
import { createServiceClient } from "@/lib/supabase/server";

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
