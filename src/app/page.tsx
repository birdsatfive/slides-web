import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FileLibrary, type SharedFileRow } from "@/components/library/FileLibrary";
import { displayName } from "@/lib/auth/profile";
import { fileKindFrom } from "@/lib/share/kind";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: decks } = await supabase
    .schema("slides")
    .from("decks")
    .select("id, title, updated_at, source_kind, current_version_id")
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  const fileList = decks ?? [];
  const versionIds = fileList
    .map((d) => d.current_version_id)
    .filter((v): v is string => Boolean(v));

  const [versionsRes, linksRes] = await Promise.all([
    versionIds.length
      ? supabase
          .schema("slides")
          .from("deck_versions")
          .select("id, html_path, generation_meta")
          .in("id", versionIds)
      : Promise.resolve({ data: [] as VersionRow[] }),
    fileList.length
      ? supabase
          .schema("slides")
          .from("share_links")
          .select("id, deck_id, slug, password_hash, expires_at, revoked_at, created_at")
          .in(
            "deck_id",
            fileList.map((d) => d.id),
          )
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as LinkRow[] }),
  ]);

  const linkRows = (linksRes.data ?? []) as LinkRow[];
  const isLive = (l: LinkRow) =>
    !l.revoked_at && (!l.expires_at || new Date(l.expires_at) > new Date());

  const { data: viewRows } = linkRows.length
    ? await supabase
        .schema("slides")
        .from("share_views")
        .select("share_link_id")
        .in(
          "share_link_id",
          linkRows.map((l) => l.id),
        )
    : { data: [] as { share_link_id: string }[] };

  const versionsById = new Map(
    ((versionsRes.data ?? []) as VersionRow[]).map((v) => [v.id, v] as const),
  );

  // Links are already newest-first, so the first live one per file is the
  // current link — the one worth putting a copy button next to.
  const linksByFile = new Map<string, LinkRow[]>();
  for (const l of linkRows) {
    const arr = linksByFile.get(l.deck_id);
    if (arr) arr.push(l);
    else linksByFile.set(l.deck_id, [l]);
  }

  const viewsByLink = new Map<string, number>();
  for (const v of viewRows ?? []) {
    viewsByLink.set(v.share_link_id, (viewsByLink.get(v.share_link_id) ?? 0) + 1);
  }

  const rows: SharedFileRow[] = [];
  for (const file of fileList) {
    const links = linksByFile.get(file.id) ?? [];
    // A row without a link was never shared — nothing to list under a
    // file-sharing service. (Decks left over from the generator land here.)
    if (links.length === 0) continue;

    const version = file.current_version_id ? versionsById.get(file.current_version_id) : undefined;
    const current = links.find(isLive) ?? null;
    const meta = (version?.generation_meta ?? {}) as Record<string, unknown>;

    rows.push({
      id: file.id,
      title: file.title,
      updated_at: file.updated_at,
      kind: fileKindFrom(meta, version?.html_path ?? null),
      file_count: typeof meta.file_count === "number" ? meta.file_count : null,
      slug: current?.slug ?? null,
      protected: Boolean(current?.password_hash),
      expires_at: current?.expires_at ?? null,
      live: Boolean(current),
      total_views: links.reduce((sum, l) => sum + (viewsByLink.get(l.id) ?? 0), 0),
    });
  }

  return (
    <FileLibrary
      files={rows}
      userName={displayName(user)}
      userEmail={user.email ?? ""}
    />
  );
}

interface VersionRow {
  id: string;
  html_path: string | null;
  generation_meta: Record<string, unknown> | null;
}

interface LinkRow {
  id: string;
  deck_id: string;
  slug: string;
  password_hash: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}
