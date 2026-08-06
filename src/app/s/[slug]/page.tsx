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
    .select("html_path, generation_meta")
    .eq("id", versionId)
    .single();
  if (!version?.html_path) notFound();

  const meta = (version.generation_meta ?? {}) as Record<string, unknown>;
  const isBundle = meta.kind === "html_bundle";

  // Iframe through our own proxy so Content-Type is text/html (Supabase
  // Storage serves text/plain by default, breaking the iframe render).
  // Folder shares point at the entry document inside /f/, which makes that
  // path the document root — relative sub-page links and assets then resolve
  // against the bundle instead of against this route.
  const entry = typeof meta.entry === "string" && meta.entry ? meta.entry : "index.html";
  const htmlUrl = isBundle
    ? `/api/share/${slug}/f/${entry}${pw ? `?pw=${encodeURIComponent(pw)}` : ""}`
    : `/api/share/${slug}/render${pw ? `?pw=${encodeURIComponent(pw)}` : ""}`;

  // PDFs are rendered by the browser's built-in PDF viewer, which counts as
  // plugin content. A sandboxed iframe unconditionally blocks plugins (no
  // sandbox token re-enables them), so the viewer would render blank — the
  // ShareViewer must drop the sandbox for PDF-backed shares.
  const isPdf = version.html_path.endsWith(".pdf");

  return (
    <ShareViewer
      title={title}
      htmlUrl={htmlUrl}
      shareLinkId={link.id}
      isPdf={isPdf}
      isBundle={isBundle}
    />
  );
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
          className="input-base w-full"
        />
        <button
          type="submit"
          className="btn-primary mt-3 w-full"
        >
          View deck
        </button>
      </form>
    </div>
  );
}
