"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Mail, Send, Presentation } from "lucide-react";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const [magicEmail, setMagicEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get("error");
    if (errorParam === "forbidden") {
      setError("Your account is not authorised. Contact a BirdsAtFive admin.");
    } else if (errorParam === "auth_callback_failed") {
      setError("Login failed. Please try again.");
    }
  }, []);

  async function handleMicrosoftLogin() {
    setError(null);
    setOauthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "openid email profile",
        },
      });
      if (error) {
        setError(error.message);
        setOauthLoading(false);
      }
    } catch {
      setError("Failed to initiate Microsoft login.");
      setOauthLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMagicLinkSent(false);
    setMagicLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: magicEmail,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setError(error.message);
      else setMagicLinkSent(true);
    } catch {
      setError("Failed to send magic link.");
    } finally {
      setMagicLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "rgb(245 245 245)" }}>
      <div className="w-[440px] max-w-full px-4">
        <div
          className="p-8"
          style={{
            background: "#fff",
            borderRadius: "20px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <div className="mb-8 flex flex-col items-center">
            <div
              className="mb-3 flex h-12 w-12 items-center justify-center"
              style={{ borderRadius: "12px", background: "rgba(245,142,211,0.12)" }}
            >
              <Presentation strokeWidth={2} className="text-[#F58ED3]" width={24} height={24} />
            </div>
            <h1 className="text-[24px] font-semibold tracking-tight" style={{ color: "#380527" }}>
              Slides
            </h1>
            <p className="mt-1 text-[13px]" style={{ color: "rgba(56,5,39,0.5)" }}>
              BirdsAtFive — AI decks & presentations
            </p>
          </div>

          {error && (
            <div
              className="mb-4 px-4 py-3 text-[13px]"
              style={{
                borderRadius: "10px",
                background: "rgba(220,38,38,0.08)",
                border: "1px solid rgba(220,38,38,0.2)",
                color: "#dc2626",
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={handleMicrosoftLogin}
            disabled={oauthLoading}
            className="flex w-full items-center justify-center gap-[10px] disabled:opacity-50"
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              background: "#FDECF8",
              color: "#380527",
              fontSize: "12px",
              fontWeight: 600,
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#F58ED3";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#FDECF8";
              e.currentTarget.style.color = "#380527";
            }}
          >
            <svg viewBox="0 0 21 21" className="h-[18px] w-[18px]" aria-hidden="true">
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            {oauthLoading ? "Redirecting…" : "Sign in with Microsoft"}
          </button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: "rgb(217 217 217)" }} />
            <span
              className="uppercase tracking-[0.05em]"
              style={{ fontSize: "11px", fontWeight: 500, color: "rgba(56,5,39,0.35)" }}
            >
              or sign in with email
            </span>
            <div className="h-px flex-1" style={{ background: "rgb(217 217 217)" }} />
          </div>

          {magicLinkSent ? (
            <div
              className="px-4 py-3 text-[13px]"
              style={{
                borderRadius: "10px",
                background: "rgba(143,184,154,0.12)",
                border: "1px solid rgba(90,138,102,0.2)",
                color: "#5a8a66",
              }}
            >
              Check your email for a login link. You can close this tab.
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-3">
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: "rgba(56,5,39,0.3)" }}
                />
                <input
                  type="email"
                  value={magicEmail}
                  onChange={(e) => setMagicEmail(e.target.value)}
                  required
                  placeholder="you@birdsatfive.dk"
                  className="w-full"
                  style={{
                    padding: "10px 12px 10px 40px",
                    borderRadius: "10px",
                    border: "1px solid hsl(0 0% 90%)",
                    fontSize: "13px",
                    background: "rgb(245 245 245)",
                    color: "#380527",
                    outline: "none",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={magicLoading}
                className="flex w-full items-center justify-center gap-2 disabled:opacity-50"
                style={{
                  padding: "10px 18px",
                  borderRadius: "10px",
                  background: "#380527",
                  color: "#F5F5F5",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                <Send className="h-4 w-4" />
                {magicLoading ? "Sending…" : "Send login link"}
              </button>
            </form>
          )}
        </div>

        <p
          className="mt-5 text-center"
          style={{ fontSize: "11px", fontWeight: 500, color: "rgba(56,5,39,0.35)" }}
        >
          Only @birdsatfive.dk and @birdie.studio accounts are authorised.
        </p>
      </div>
    </div>
  );
}
