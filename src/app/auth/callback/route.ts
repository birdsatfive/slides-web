import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedDomain } from "@/lib/auth/domain-gate";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth] code exchange failed:", error.message);
      return NextResponse.redirect(
        new URL("/login?error=auth_callback_failed", origin),
      );
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "email" | "magiclink",
    });
    if (error) {
      console.error("[auth] OTP verify failed:", error.message);
      return NextResponse.redirect(
        new URL("/login?error=auth_callback_failed", origin),
      );
    }
  } else {
    return NextResponse.redirect(
      new URL("/login?error=auth_callback_failed", origin),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !isAllowedDomain(user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=forbidden", origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
