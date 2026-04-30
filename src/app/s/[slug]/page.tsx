import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { ShareViewer } from "@/components/share/ShareViewer";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

export default async function ShareLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pw?: string }>;
}) {
  const { slug } = await params;
  const { pw } = await searchParams;
  const svc = createServiceClient();

  const { data: link } = await svc
    .schema("slides")
    .from("share_links")
    .select("id, deck_id, version_id, password_hash, expires_at, revoked_at")
    .eq("slug", slug)
    .single();
  if (!link || link.revoked_at) notFound();
  if (link.expires_at && new Date(link.expires_at) < new Date()) notFound();

  if (link.password_hash) {
    const supplied = pw ? createHash("sha256").update(pw).digest("hex") : "";
    if (supplied !== link.password_hash) {
      return <PasswordGate slug={slug} />;
    }
  }

  // Resolve which version to show: explicit version on the link, else deck's current.
  let versionId = link.version_id;
  let title = "Slides";
  if (!versionId) {
    const { data: deck } = await svc
      .schema("slides")
      .from("decks")
      .select("title, current_version_id")
      .eq("id", link.deck_id)
      .single();
    versionId = deck?.current_version_id ?? null;
    title = deck?.title ?? "Slides";
  } else {
    const { data: deck } = await svc
      .schema("slides")
      .from("decks")
      .select("title")
      .eq("id", link.deck_id)
      .single();
    title = deck?.title ?? "Slides";
  }

  if (!versionId) notFound();
  const { data: version } = await svc
    .schema("slides")
    .from("deck_versions")
    .select("html_path")
    .eq("id", versionId)
    .single();
  if (!version?.html_path) notFound();

  const { data: signed } = await svc.storage.from("slides-html").createSignedUrl(version.html_path, 60 * 60);
  if (!signed?.signedUrl) notFound();

  return <ShareViewer title={title} htmlUrl={signed.signedUrl} shareLinkId={link.id} />;
}

function PasswordGate({ slug }: { slug: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[rgb(var(--bg))]">
      <form
        action={`/s/${slug}`}
        method="GET"
        className="panel-card p-7 w-[380px] max-w-full"
      >
        <h1 className="text-[18px] font-semibold mb-1">Password protected</h1>
        <p className="text-[12px] text-foreground/55 mb-4">
          Ask the sender for the password to view this deck.
        </p>
        <input
          name="pw"
          type="password"
          required
          autoFocus
          placeholder="Password"
          className="w-full px-3 py-2 rounded-lg border border-border bg-card text-[13px] outline-none focus:border-[rgb(var(--primary))] focus:ring-2 focus:ring-[rgb(var(--primary)/0.2)] transition-smooth"
        />
        <button
          type="submit"
          className="mt-3 w-full px-4 py-2 rounded-lg bg-[rgb(var(--primary))] text-white text-[13px] font-medium"
        >
          View deck
        </button>
      </form>
    </div>
  );
}
