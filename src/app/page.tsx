import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LibraryView } from "@/components/library/LibraryView";
import { displayName } from "@/lib/auth/profile";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: decks } = await supabase
    .schema("slides")
    .from("decks")
    .select("id, title, updated_at, template_id, starred")
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  return (
    <LibraryView
      decks={decks ?? []}
      userName={displayName(user)}
      userEmail={user.email ?? ""}
    />
  );
}
