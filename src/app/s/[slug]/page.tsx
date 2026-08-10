import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { ShareViewer } from "@/components/share/ShareViewer";
import { extractHtmlMeta } from "@/lib/share/access";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

/**
 * Link previews (Teams, Slack, iMessage) read the tags on this page, not the
 * framed document — without these they all fall back to the app-wide title in
 * the root layout, so every share looked identical.
 *
 * The shared document is the better source: whatever it declares about itself
 * wins, with the deck title as the fallback for anything it leaves out.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const svc = createServiceClient();

  const { data: link } = await svc
    .schema("slides")
    .from("share_links")
    .select("deck_id, version_id, password_hash, expires_at, revoked_at")
    .eq("slug", slug)
    .single();

  // A revoked or expired link advertises nothing.
  if (!link || link.revoked_at) return {};
  if (link.expires_at && new Date(link.expires_at) < new Date()) return {};

  const { data: deck } = await svc
    .schema("slides")
    .from("decks")
    .select("title, current_version_id")
    .eq("id", link.deck_id)
    .single();

  // Absolute URLs — link unfurlers reject relative ones.
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? "share.birdsatfive.dk"}`;
  const url = `${origin}/s/${slug}`;

  // A protected share still shows the name it was given — that title is the
  // sender's own label for the link, not something read out of the document.
  // What stays behind the password is the content: no description or image is
  // lifted from inside, since the preview reaches anyone holding the URL.
  if (link.password_hash) {
    const protectedTitle = deck?.title || "Shared file";
    return {
      title: protectedTitle,
      description: "Password protected",
      openGraph: {
        title: protectedTitle,
        description: "Password protected",
        url,
        siteName: "Share — BirdsAtFive",
        type: "website",
      },
    };
  }

  const versionId = link.version_id ?? deck?.current_version_id ?? null;
  if (!versionId) return {};

  const { data: version } = await svc
    .schema("slides")
    .from("deck_versions")
    .select("html_path, generation_meta")
    .eq("id", versionId)
    .single();

  const meta = (version?.generation_meta ?? {}) as Record<string, unknown>;
  const isBundle = meta.kind === "html_bundle";
  const entry = typeof meta.entry === "string" && meta.entry ? meta.entry : "index.html";

  let selfDescribed: { title?: string; description?: string; image?: string } = {};
  if (version?.html_path && !version.html_path.endsWith(".pdf")) {
    const { data: blob } = await svc.storage.from("slides-html").download(version.html_path);
    if (blob) selfDescribed = extractHtmlMeta(await blob.text());
  }

  const title = selfDescribed.title || deck?.title || "Shared file";
  // Skip a description that merely restates the title.
  const description =
    selfDescribed.description && selfDescribed.description !== title
      ? selfDescribed.description
      : deck?.title && deck.title !== title
        ? deck.title
        : undefined;

  // A declared og:image is relative to the document, which for a folder share
  // is served under /f/.
  let image: string | undefined;
  if (selfDescribed.image) {
    if (/^https?:\/\//i.test(selfDescribed.image)) {
      image = selfDescribed.image;
    } else if (isBundle) {
      const base = entry.includes("/") ? `${entry.slice(0, entry.lastIndexOf("/"))}/` : "";
      image = `${origin}/api/share/${slug}/f/${base}${selfDescribed.image.replace(/^\.?\//, "")}`;
    }
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Share — BirdsAtFive",
      type: "website",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

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
  let title = "Shared file";
  if (!versionId) {
    const { data: deck } = await svc
      .schema("slides")
      .from("decks")
      .select("title, current_version_id")
      .eq("id", link.deck_id)
      .single();
    versionId = deck?.current_version_id ?? null;
    title = deck?.title ?? "Shared file";
  } else {
    const { data: deck } = await svc
      .schema("slides")
      .from("decks")
      .select("title")
      .eq("id", link.deck_id)
      .single();
    title = deck?.title ?? "Shared file";
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
          Ask the sender for the password to open this file.
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
          View file
        </button>
      </form>
    </div>
  );
}
