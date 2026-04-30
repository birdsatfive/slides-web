"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveOrgId } from "@/lib/auth/org";
import { slidesApi, type OutlineSlide } from "@/lib/api/slides";

type TextSourceKind = "url" | "markdown" | "sharepoint" | "prompt";

interface CreateDeckInput {
  title: string;
  goal?: string;
  templateId?: string | null;
  source: { kind: TextSourceKind; payload: string } | { kind: "file"; file: File };
}

/**
 * Single-shot create: extract → outline → insert deck/version → designed
 * render → land on viewer. Outline editing is still available from
 * /d/[id]/outline but is not part of the default flow.
 */
export async function createDeck(input: CreateDeckInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = resolveOrgId(user.app_metadata as Record<string, unknown> | undefined);

  // 1) Extract from chosen source
  const extraction =
    "file" in input.source
      ? await slidesApi.extractFile(input.source.file)
      : await slidesApi.extractText(input.source.kind, input.source.payload);

  // 2) Plan outline (Haiku)
  const { slide_tree } = await slidesApi.outline(extraction, input.goal || "");

  // 3) Insert deck
  const finalTitle = input.title || extraction.source.ref?.slice(0, 80) || "Untitled deck";
  const { data: deck, error: deckErr } = await supabase
    .schema("slides")
    .from("decks")
    .insert({
      org_id: orgId,
      owner_id: user.id,
      title: finalTitle,
      source_kind: extraction.source.kind,
      source_ref: extraction.source.ref,
      template_id: input.templateId ?? null,
    })
    .select("id, template_id")
    .single();
  if (deckErr || !deck) throw new Error(`deck insert failed: ${deckErr?.message}`);

  // 4) Insert version
  const { data: version, error: verErr } = await supabase
    .schema("slides")
    .from("deck_versions")
    .insert({
      deck_id: deck.id,
      label: "Initial",
      slide_tree: slide_tree as unknown as object,
      generation_meta: { source: extraction.source, goal: input.goal ?? "" },
      created_by: user.id,
    })
    .select("id")
    .single();
  if (verErr || !version) throw new Error(`version insert failed: ${verErr?.message}`);

  await supabase
    .schema("slides")
    .from("decks")
    .update({ current_version_id: version.id })
    .eq("id", deck.id);

  // 5) Resolve template + brand kit → design_spec
  const designSpec = await composeDesignSpec(supabase, deck.template_id, orgId);

  // 6) Designed render (Opus)
  const { html_path } = await slidesApi.renderDeck({
    deck_id: deck.id,
    version_id: version.id,
    title: finalTitle,
    slide_tree,
    design_spec: designSpec,
  });

  await supabase
    .schema("slides")
    .from("deck_versions")
    .update({ html_path })
    .eq("id", version.id);

  revalidatePath("/");
  redirect(`/d/${deck.id}`);
}

/** Mutate the slide_tree on a version (inline edits, reorder). Creates a new version row. */
export async function saveOutlineEdit(deckId: string, parentVersionId: string, slide_tree: OutlineSlide[], label?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: version, error } = await supabase
    .schema("slides")
    .from("deck_versions")
    .insert({
      deck_id: deckId,
      parent_version_id: parentVersionId,
      label: label ?? "Edit",
      slide_tree: slide_tree as unknown as object,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !version) throw new Error(error?.message);

  await supabase.schema("slides").from("decks").update({ current_version_id: version.id }).eq("id", deckId);
  revalidatePath(`/d/${deckId}`);
  return version.id;
}

/** Re-render an existing version (used from /d/[id]/outline after edits). */
export async function renderDesignedDeck(deckId: string, versionId: string, title: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: version, error: vErr }, { data: deck, error: dErr }] = await Promise.all([
    supabase.schema("slides").from("deck_versions").select("slide_tree").eq("id", versionId).single(),
    supabase.schema("slides").from("decks").select("template_id, org_id").eq("id", deckId).single(),
  ]);
  if (vErr || !version) throw new Error(vErr?.message);
  if (dErr || !deck) throw new Error(dErr?.message);

  const designSpec = await composeDesignSpec(supabase, deck.template_id, deck.org_id);

  const { html_path } = await slidesApi.renderDeck({
    deck_id: deckId,
    version_id: versionId,
    title,
    slide_tree: (version.slide_tree as unknown as OutlineSlide[]) ?? [],
    design_spec: designSpec,
  });

  await supabase
    .schema("slides")
    .from("deck_versions")
    .update({ html_path })
    .eq("id", versionId);

  revalidatePath(`/d/${deckId}`);
}

/** Soft-delete: set archived_at. Library filters them out by default. */
export async function archiveDeck(deckId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .schema("slides")
    .from("decks")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", deckId);
  if (error) throw new Error(error.message);

  revalidatePath("/");
}

/** Per-slide remix. Returns the new HTML fragment; caller can splice into iframe. */
export async function remixSingleSlide(slide: OutlineSlide, remixPrompt: string, deckId?: string, versionId?: string) {
  const { fragment } = await slidesApi.remixSlide({
    slide,
    remix_prompt: remixPrompt,
    deck_id: deckId,
    version_id: versionId,
  });
  return fragment;
}

// ── helpers ─────────────────────────────────────────────────────────────

type Sb = Awaited<ReturnType<typeof createClient>>;

async function composeDesignSpec(
  supabase: Sb,
  templateId: string | null | undefined,
  orgId: string | null | undefined,
): Promise<Record<string, unknown> | undefined> {
  let spec: Record<string, unknown> | undefined;

  if (templateId) {
    const { data: tpl } = await supabase
      .schema("slides")
      .from("templates")
      .select("design_spec")
      .eq("id", templateId)
      .single();
    if (tpl?.design_spec) spec = tpl.design_spec as Record<string, unknown>;
  }

  if (orgId) {
    const { data: kits } = await supabase
      .schema("slides")
      .from("brand_kits")
      .select("colors, fonts")
      .eq("org_id", orgId)
      .limit(1);
    const kit = kits?.[0];
    if (kit) {
      spec = { ...(spec ?? {}), brand_kit: { colors: kit.colors, fonts: kit.fonts } };
    }
  }

  return spec;
}
