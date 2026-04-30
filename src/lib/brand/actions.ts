"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveOrgId } from "@/lib/auth/org";

export interface BrandKitInput {
  id?: string;
  name: string;
  colors: { primary?: string; accent?: string; fg?: string; bg?: string };
  fonts: { heading?: string; body?: string };
}

export async function saveBrandKit(input: BrandKitInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const orgId = resolveOrgId(user.app_metadata as Record<string, unknown> | undefined);

  if (input.id) {
    const { error } = await supabase
      .schema("slides")
      .from("brand_kits")
      .update({
        name: input.name,
        colors: input.colors,
        fonts: input.fonts,
      })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .schema("slides")
      .from("brand_kits")
      .insert({
        org_id: orgId,
        name: input.name,
        colors: input.colors,
        fonts: input.fonts,
      });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/brand");
}
