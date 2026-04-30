import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewDeckForm } from "@/components/new/NewDeckForm";

export const dynamic = "force-dynamic";

export default async function NewDeckPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <NewDeckForm />;
}
