import "server-only";

/**
 * Tenants → stable UUIDs for `slides.*.org_id`.
 *
 * The DB schema declares `org_id uuid` (forward-compatible with multi-org).
 * Single-tenant rollout maps the `birdsatfive` slug to a deterministic
 * UUIDv5 derived from `uuid.uuid5(NAMESPACE_DNS, 'birdsatfive')`. When a
 * future user gets a real `app_metadata.org_id` UUID, we use that instead.
 */
export const BAF_ORG_UUID = "9ea0efc9-9699-5c0a-9d71-c3338c2b7c40";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveOrgId(appMetadata: Record<string, unknown> | undefined | null): string {
  const claim = appMetadata?.org_id;
  if (typeof claim === "string" && UUID_RE.test(claim)) return claim;
  return BAF_ORG_UUID;
}
