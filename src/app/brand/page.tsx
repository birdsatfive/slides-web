import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrandKitForm } from "@/components/brand/BrandKitForm";

export const dynamic = "force-dynamic";

interface BrandKit {
  id: string;
  name: string;
  colors: { primary?: string; accent?: string; fg?: string; bg?: string };
  fonts: { heading?: string; body?: string };
}

export default async function BrandPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: kits } = await supabase
    .schema("slides")
    .from("brand_kits")
    .select("id, name, colors, fonts")
    .order("created_at", { ascending: true });

  return <BrandKitForm kits={(kits ?? []) as BrandKit[]} />;
}
