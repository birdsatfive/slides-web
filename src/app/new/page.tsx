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
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      vibe: (spec.vibe as string | undefined) ?? "",
      bg: colors.bg_primary ?? "#fff",
      fg: colors.text_primary ?? "#111",
      accent: colors.accent_primary ?? "#C72886",
      heading: ((spec.fonts as Record<string, string> | undefined)?.heading) ?? "serif",
    };
  });

  return <NewDeckForm templates={templates} />;
}
