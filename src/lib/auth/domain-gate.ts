export const ALLOWED_DOMAINS = ["birdsatfive.dk", "birdie.studio"];

export function isAllowedDomain(email?: string | null): boolean {
  if (!email || !email.includes("@")) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && ALLOWED_DOMAINS.includes(domain);
}
