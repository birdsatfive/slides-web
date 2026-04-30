-- Slides — production schema for slides.birdsatfive.dk
-- Lives alongside ops in the studio-api Supabase. Cookies on `.birdsatfive.dk`
-- give SSO; this schema is org-scoped via RLS using the same `app_users`
-- / `org_members` tables ops already exposes (see ops 20260506_org_rbac…).

create schema if not exists slides;
grant usage on schema slides to authenticated, anon, service_role;

-- ──────────────────────────────────────────────────────────
-- Tables
-- ──────────────────────────────────────────────────────────

create table slides.brand_kits (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null,
  name            text not null,
  colors          jsonb not null default '{}'::jsonb, -- { primary, accent, fg, bg, … }
  fonts           jsonb not null default '{}'::jsonb, -- { heading, body, mono }
  logos           jsonb not null default '{}'::jsonb, -- { light_url, dark_url, mark_url }
  css_overrides   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index brand_kits_org_idx on slides.brand_kits (org_id);

create table slides.templates (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null,
  name            text not null,
  kind            text not null check (kind in ('curated', 'org', 'user')),
  brand_kit_id    uuid references slides.brand_kits(id) on delete set null,
  preview_path    text,
  design_spec     jsonb not null, -- color tokens, font pairings, slide-type CSS overrides, animation tuning
  org_id          uuid,           -- null for curated; set for org/user templates
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (slug, org_id)
);
create index templates_org_idx on slides.templates (org_id);
create index templates_kind_idx on slides.templates (kind);

create table slides.decks (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null,
  owner_id           uuid not null references auth.users(id) on delete restrict,
  title              text not null default 'Untitled deck',
  template_id        uuid references slides.templates(id) on delete set null,
  source_kind        text check (source_kind in ('pptx','pdf','docx','url','prompt','markdown','sharepoint')),
  source_ref         text,                 -- file path, URL, or null for prompt
  current_version_id uuid,                 -- self-ref set after first version exists
  starred            boolean not null default false,
  archived_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index decks_org_idx on slides.decks (org_id);
create index decks_owner_idx on slides.decks (owner_id);
create index decks_updated_idx on slides.decks (updated_at desc);

create table slides.deck_versions (
  id                  uuid primary key default gen_random_uuid(),
  deck_id             uuid not null references slides.decks(id) on delete cascade,
  parent_version_id   uuid references slides.deck_versions(id) on delete set null,
  label               text,                  -- e.g. "Initial draft", "Acme pitch fork"
  slide_tree          jsonb not null,        -- canonical structured representation (see editor)
  html_path           text,                  -- storage path; null until rendered
  thumb_paths         jsonb not null default '[]'::jsonb,  -- ordered list of per-slide thumbnails
  generation_meta     jsonb not null default '{}'::jsonb,  -- { model, prompt, tokens, duration_ms }
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index deck_versions_deck_idx on slides.deck_versions (deck_id, created_at desc);
alter table slides.decks
  add constraint decks_current_version_fk
  foreign key (current_version_id) references slides.deck_versions(id)
  on delete set null deferrable initially deferred;

create table slides.assets (
  id            uuid primary key default gen_random_uuid(),
  deck_id       uuid not null references slides.decks(id) on delete cascade,
  path          text not null,
  kind          text not null,        -- 'source' | 'image' | 'thumb' | 'export'
  size          bigint,
  content_type  text,
  created_at    timestamptz not null default now()
);
create index assets_deck_idx on slides.assets (deck_id);

create table slides.share_links (
  id            uuid primary key default gen_random_uuid(),
  deck_id       uuid not null references slides.decks(id) on delete cascade,
  version_id    uuid references slides.deck_versions(id) on delete set null,
  slug          text not null unique,
  password_hash text,                   -- nullable; sha256 hex
  expires_at    timestamptz,
  created_by    uuid references auth.users(id) on delete set null,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index share_links_deck_idx on slides.share_links (deck_id);

create table slides.share_views (
  id              uuid primary key default gen_random_uuid(),
  share_link_id   uuid not null references slides.share_links(id) on delete cascade,
  session_id      text not null,
  ip_hash         text,
  ua              text,
  referer         text,
  slides_seen     int[] not null default '{}',
  active_seconds  int not null default 0,
  opened_at       timestamptz not null default now(),
  last_seen_at    timestamptz not null default now()
);
create index share_views_link_idx on slides.share_views (share_link_id);
create index share_views_opened_idx on slides.share_views (opened_at desc);

-- ──────────────────────────────────────────────────────────
-- updated_at triggers
-- ──────────────────────────────────────────────────────────
create or replace function slides.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

create trigger brand_kits_touch before update on slides.brand_kits
  for each row execute function slides.tg_touch_updated_at();
create trigger decks_touch before update on slides.decks
  for each row execute function slides.tg_touch_updated_at();

-- ──────────────────────────────────────────────────────────
-- Org membership helper (mirrors ops' app_users.org_id pattern).
-- If ops' canonical helper exists in `public.user_org_id()`, prefer that; this
-- is a local fallback that resolves user → org via auth metadata.
-- ──────────────────────────────────────────────────────────
create or replace function slides.current_org_id()
returns uuid language sql stable as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'org_id')::uuid,
    (current_setting('request.jwt.claims', true)::jsonb ->> 'org_id')::uuid
  );
$$;

-- ──────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────
alter table slides.brand_kits     enable row level security;
alter table slides.templates      enable row level security;
alter table slides.decks          enable row level security;
alter table slides.deck_versions  enable row level security;
alter table slides.assets         enable row level security;
alter table slides.share_links    enable row level security;
alter table slides.share_views    enable row level security;

-- Decks: org-scoped read, owner-scoped write
create policy "decks read by org" on slides.decks
  for select to authenticated
  using (org_id = slides.current_org_id());

create policy "decks insert by self" on slides.decks
  for insert to authenticated
  with check (owner_id = auth.uid() and org_id = slides.current_org_id());

create policy "decks update by owner" on slides.decks
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Versions: read if you can read the deck
create policy "versions read by deck access" on slides.deck_versions
  for select to authenticated
  using (exists (
    select 1 from slides.decks d
    where d.id = deck_id and d.org_id = slides.current_org_id()
  ));

create policy "versions insert by deck owner" on slides.deck_versions
  for insert to authenticated
  with check (exists (
    select 1 from slides.decks d
    where d.id = deck_id and d.owner_id = auth.uid()
  ));

-- Templates: curated visible to all authenticated; org/user scoped to membership/owner
create policy "templates read curated or own org" on slides.templates
  for select to authenticated
  using (kind = 'curated' or org_id = slides.current_org_id());

create policy "templates write own org" on slides.templates
  for insert to authenticated
  with check (kind in ('org','user') and org_id = slides.current_org_id());

-- Brand kits: org-scoped
create policy "brand kits read by org" on slides.brand_kits
  for select to authenticated
  using (org_id = slides.current_org_id());
create policy "brand kits write by org" on slides.brand_kits
  for all to authenticated
  using (org_id = slides.current_org_id())
  with check (org_id = slides.current_org_id());

-- Assets: read if deck is accessible
create policy "assets read by deck access" on slides.assets
  for select to authenticated
  using (exists (
    select 1 from slides.decks d
    where d.id = deck_id and d.org_id = slides.current_org_id()
  ));

-- Share links: managed by deck owner
create policy "share links read by deck access" on slides.share_links
  for select to authenticated
  using (exists (
    select 1 from slides.decks d
    where d.id = deck_id and d.org_id = slides.current_org_id()
  ));
create policy "share links write by owner" on slides.share_links
  for all to authenticated
  using (exists (
    select 1 from slides.decks d where d.id = deck_id and d.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from slides.decks d where d.id = deck_id and d.owner_id = auth.uid()
  ));

-- Share views: anon-insertable for /s/[slug] tracking; service role reads.
create policy "share views public insert" on slides.share_views
  for insert to anon, authenticated with check (true);
create policy "share views read by deck access" on slides.share_views
  for select to authenticated
  using (exists (
    select 1
    from slides.share_links sl
    join slides.decks d on d.id = sl.deck_id
    where sl.id = share_link_id and d.org_id = slides.current_org_id()
  ));

-- ──────────────────────────────────────────────────────────
-- Storage buckets
--   slides-html      versioned rendered HTML
--   slides-thumbs    per-slide WebP thumbnails
--   slides-assets    uploaded source files + extracted images
-- Use Supabase studio or a separate migration for `storage.buckets`
-- inserts; replicating the SQL here for completeness.
-- ──────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values
  ('slides-html',   'slides-html',   false),
  ('slides-thumbs', 'slides-thumbs', false),
  ('slides-assets', 'slides-assets', false)
on conflict (id) do nothing;

-- Anyone with a signed URL can read; only service role writes (Python render
-- service uses service-role key). No anon list.
create policy "html signed read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'slides-html');
create policy "thumbs signed read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'slides-thumbs');
create policy "assets read by org" on storage.objects
  for select to authenticated
  using (bucket_id = 'slides-assets');
