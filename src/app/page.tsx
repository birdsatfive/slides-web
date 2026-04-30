import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LibraryView } from "@/components/library/LibraryView";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Empty for Phase 1 — real query lands once decks table is migrated.
  const decks: Array<{
    id: string;
    title: string;
    updated_at: string;
    template_id: string | null;
    starred: boolean;
  }> = [];

  return <LibraryView decks={decks} userEmail={user.email ?? ""} />;
}
