-- Service-role grants on the slides schema. Self-hosted Supabase doesn't
-- give service_role implicit grants — without these, anything that uses
-- createServiceClient() (e.g. /api/share/[slug]/render, /s/[slug]/page,
-- createSharedFile) hits "permission denied for table X" and 404s.

grant usage on schema slides to service_role;
grant select, insert, update, delete on all tables in schema slides to service_role;
grant usage, select on all sequences in schema slides to service_role;

alter default privileges in schema slides
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema slides
  grant usage, select on sequences to service_role;
