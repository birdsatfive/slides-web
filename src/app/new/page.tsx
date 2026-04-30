import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewDeckForm, type TemplateOption } from "@/components/new/NewDeckForm";

export const dynamic = "force-dynamic";

export default async function NewDeckPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .schema("slides")
    .from("templates")
    .select("id, slug, name, design_spec")
    .in("kind", ["curated", "org"])
    .order("created_at", { ascending: true });

  const templates: TemplateOption[] = (rows ?? []).map((r) => {
    const spec = (r.design_spec as Record<string, unknown> | null) ?? {};
    const colors = (spec.colors as Record<string, string> | undefined) ?? {};
    const fonts = (spec.fonts as Record<string, string> | undefined) ?? {};
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      vibe: (spec.vibe as string | undefined) ?? "",
      bg: colors.bg_primary ?? "#fff",
      fg: colors.text_primary ?? "#111",
      accent: colors.accent_primary ?? "#F58ED3",
      heading: fonts.heading ?? "serif",
      previewSpec: {
        name: r.name,
        vibe: (spec.vibe as string | undefined) ?? "",
        colors: {
          bg_primary: colors.bg_primary ?? "#FFFFFF",
          bg_secondary: colors.bg_secondary ?? "#F5F5F5",
          bg_tertiary: colors.bg_tertiary ?? "#FDECF8",
          text_primary: colors.text_primary ?? "#380527",
          text_secondary: colors.text_secondary ?? "#5e0842",
          text_muted: colors.text_muted ?? "rgba(56,5,39,0.5)",
          accent_primary: colors.accent_primary ?? "#F58ED3",
          accent_secondary: colors.accent_secondary ?? "#A33278",
          accent_gradient: colors.accent_gradient ?? "none",
        },
        fonts: {
          heading: fonts.heading ?? "Rubik",
          body: fonts.body ?? "Rubik",
        },
      },
    };
  });

  return <NewDeckForm templates={templates} />;
}
