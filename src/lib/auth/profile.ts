import type { User } from "@supabase/supabase-js";

/**
 * Best-effort display name from Supabase user metadata.
 * Microsoft Azure AD OIDC populates: name, full_name, given_name, family_name.
 * Magic-link users typically only have `email`. Falls back through the chain
 * and finally to the local-part of the email.
 */
export function displayName(user: User | null | undefined): string {
  if (!user) return "";
  const m = user.user_metadata as Record<string, unknown> | undefined;
  const candidates = [
    m?.full_name,
    m?.name,
    m?.display_name,
    m?.preferred_name,
    [m?.given_name, m?.family_name].filter(Boolean).join(" ").trim() || undefined,
    user.email?.split("@")[0],
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return user.email ?? "";
}

/** Two-letter initials for avatars (e.g. "Marius Skarpeid" → "MS"). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
