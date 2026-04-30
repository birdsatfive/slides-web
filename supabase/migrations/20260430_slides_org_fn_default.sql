-- Match the slides-web fallback (src/lib/auth/org.ts resolveOrgId) so the
-- RLS `with check (org_id = current_org_id())` succeeds in single-tenant mode.
-- The UUID below is `uuid.uuid5(NAMESPACE_DNS, 'birdsatfive')`. When a real
-- per-user `app_metadata.org_id` UUID claim is seeded later, that wins.
create or replace function slides.current_org_id()
returns uuid language sql stable as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'org_id')::uuid,
    (current_setting('request.jwt.claims', true)::jsonb ->> 'org_id')::uuid,
    '9ea0efc9-9699-5c0a-9d71-c3338c2b7c40'::uuid
  );
$$;
