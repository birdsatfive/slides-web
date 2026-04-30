-- slides.generation_events — append-only telemetry for every Claude call.
-- Powers /admin/cost (per-org/user/deck/kind/model attribution).
-- We compute cost in slides-api from a price table; rates are USD per million
-- tokens at time-of-call so we can keep historical accuracy when prices change.

create table if not exists slides.generation_events (
  id                          uuid primary key default gen_random_uuid(),
  occurred_at                 timestamptz not null default now(),
  user_id                     uuid references auth.users(id) on delete set null,
  org_id                      text,
  deck_id                     uuid references slides.decks(id) on delete set null,
  version_id                  uuid references slides.deck_versions(id) on delete set null,
  kind                        text not null check (kind in ('outline','deck','slide','export_pdf','extract')),
  model                       text not null,
  input_tokens                integer not null default 0,
  output_tokens               integer not null default 0,
  cache_creation_input_tokens integer not null default 0,
  cache_read_input_tokens     integer not null default 0,
  duration_ms                 integer not null default 0,
  cost_usd                    numeric(10, 6) not null default 0,  -- 6 decimals = $0.000001 precision
  error                       text
);
create index gen_events_occurred_idx on slides.generation_events (occurred_at desc);
create index gen_events_org_idx      on slides.generation_events (org_id, occurred_at desc);
create index gen_events_user_idx     on slides.generation_events (user_id, occurred_at desc);
create index gen_events_deck_idx     on slides.generation_events (deck_id, occurred_at desc);
create index gen_events_kind_idx     on slides.generation_events (kind, occurred_at desc);

alter table slides.generation_events enable row level security;

-- Org members read their org's cost data
create policy "events read by org" on slides.generation_events
  for select to authenticated
  using (org_id = current_setting('request.jwt.claims', true)::jsonb->>'org_id'
         or org_id = (current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'org_id')
         or org_id = 'birdsatfive');  -- default tenant during single-org rollout

-- Only service role inserts (slides-api). No anon/authenticated insert path.
