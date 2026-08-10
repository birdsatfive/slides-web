import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * The service moved from slides.birdsatfive.dk to share.birdsatfive.dk. Both
 * hostnames stay attached to the app so every link already sent still
 * resolves; the old one redirects here, path and query intact.
 */
const LEGACY_HOST = "slides.birdsatfive.dk";
const CANONICAL_HOST = "share.birdsatfive.dk";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0].toLowerCase();
  if (host === LEGACY_HOST) {
    const url = request.nextUrl.clone();
    url.host = CANONICAL_HOST;
    url.port = "";
    url.protocol = "https";
    return NextResponse.redirect(url, 308);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
