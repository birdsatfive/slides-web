import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface Payload {
  share_link_id: string;
  session_id: string;
  event: "open" | "heartbeat" | "slide" | "close";
  active_seconds?: number;
  slide?: number | null;
  referer?: string | null;
  ua?: string | null;
}

export async function POST(request: NextRequest) {
  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch (e) {
    console.warn("[share/track] bad json", e);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body.share_link_id || !body.session_id) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const svc = createServiceClient();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ipHash = ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : null;

  // Upsert by (share_link_id, session_id) — append slide_seen, accumulate active_seconds.
  const { data: existing } = await svc
    .schema("slides")
    .from("share_views")
    .select("id, slides_seen, active_seconds")
    .eq("share_link_id", body.share_link_id)
    .eq("session_id", body.session_id)
    .maybeSingle();

  if (!existing) {
    await svc.schema("slides").from("share_views").insert({
      share_link_id: body.share_link_id,
      session_id: body.session_id,
      ip_hash: ipHash,
      ua: body.ua ?? null,
      referer: body.referer ?? null,
      slides_seen: typeof body.slide === "number" ? [body.slide] : [],
      active_seconds: body.active_seconds ?? 0,
    });
    return NextResponse.json({ ok: true });
  }

  const slidesSeen = Array.isArray(existing.slides_seen) ? [...existing.slides_seen] : [];
  if (typeof body.slide === "number" && !slidesSeen.includes(body.slide)) slidesSeen.push(body.slide);

  await svc
    .schema("slides")
    .from("share_views")
    .update({
      slides_seen: slidesSeen,
      active_seconds: Math.max(existing.active_seconds ?? 0, body.active_seconds ?? 0),
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  return NextResponse.json({ ok: true });
}
