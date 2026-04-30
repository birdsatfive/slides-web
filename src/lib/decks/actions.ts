"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slidesApi, type OutlineSlide } from "@/lib/api/slides";

type TextSourceKind = "url" | "markdown" | "sharepoint" | "prompt";

interface CreateDeckInput {
  title: string;
  goal?: string;
  templateId?: string | null;
  source: { kind: TextSourceKind; payload: string } | { kind: "file"; file: File };
}

/**
 * Phase-3 happy-path: extract → outline → insert deck + initial version → redirect to outline review.
 * The designed render is deferred until the user approves the outline (saves cost).
 */
export async function createDeck(input: CreateDeckInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId =
    (user.app_metadata as Record<string, unknown> | undefined)?.org_id as string | undefined ??
    "birdsatfive";

  const extraction =
    "file" in input.source
      ? await slidesApi.extractFile(input.source.file)
      : await slidesApi.extractText(input.source.kind, input.source.payload);

  const { slide_tree } = await slidesApi.outline(extraction, input.goal || "");

  const { data: deck, error: deckErr } = await supabase
    .schema("slides")
    .from("decks")
    .insert({
      org_id: orgId,
      owner_id: user.id,
      title: input.title || extraction.source.ref?.slice(0, 80) || "Untitled deck",
      source_kind: extraction.source.kind,
      source_ref: extraction.source.ref,
      template_id: input.templateId ?? null,
    })
    .select("id")
    .single();
  if (deckErr || !deck) throw new Error(`deck insert failed: ${deckErr?.message}`);

  const { data: version, error: verErr } = await supabase
    .schema("slides")
    .from("deck_versions")
    .insert({
      deck_id: deck.id,
      label: "Initial outline",
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

  revalidatePath("/");
  redirect(`/d/${deck.id}/outline`);
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

/** Run the designed deck render. Looks up the deck's template + brand kit
 * design_specs and composes them into a single payload sent to slides-api. */
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

  let designSpec: Record<string, unknown> | undefined;
  if (deck.template_id) {
    const { data: tpl } = await supabase
      .schema("slides")
      .from("templates")
      .select("design_spec")
      .eq("id", deck.template_id)
      .single();
    if (tpl?.design_spec) designSpec = tpl.design_spec as Record<string, unknown>;
  }

  // Compose org brand kit on top of template (kit wins for any matching keys).
  if (deck.org_id) {
    const { data: kits } = await supabase
      .schema("slides")
      .from("brand_kits")
      .select("colors, fonts")
      .eq("org_id", deck.org_id)
      .limit(1);
    const kit = kits?.[0];
    if (kit) {
      designSpec = {
        ...(designSpec ?? {}),
        brand_kit: { colors: kit.colors, fonts: kit.fonts },
      };
    }
  }

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
