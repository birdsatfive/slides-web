-- Convert all slides.* org_id columns from uuid → text.
-- Reason: single-tenant deploy uses tenant slug "birdsatfive" (matches
-- TENANT_ID env), and there's no real per-user org_id claim seeded yet.
-- text is also forward-compatible: a future multi-org switch can keep
-- using uuid strings or move to slug-style ids.

-- 1) Drop policies that reference slides.current_org_id() (uuid return type)
drop policy if exists "decks read by org"            on slides.decks;
drop policy if exists "decks insert by self"         on slides.decks;
drop policy if exists "versions read by deck access" on slides.deck_versions;
drop policy if exists "templates read curated or own org" on slides.templates;
drop policy if exists "templates write own org"      on slides.templates;
drop policy if exists "brand kits read by org"       on slides.brand_kits;
drop policy if exists "brand kits write by org"      on slides.brand_kits;
drop policy if exists "assets read by deck access"   on slides.assets;
drop policy if exists "share links read by deck access" on slides.share_links;
drop policy if exists "share views read by deck access" on slides.share_views;
drop policy if exists "comments read by deck access" on slides.comments;
drop policy if exists "comments write by org"        on slides.comments;
drop policy if exists "comments update by org"       on slides.comments;

-- 2) Change column types
alter table slides.brand_kits alter column org_id type text using org_id::text;
alter table slides.templates  alter column org_id type text using org_id::text;
alter table slides.decks      alter column org_id type text using org_id::text;
-- generation_events.org_id is already text

-- 3) Recreate helper to return text
drop function if exists slides.current_org_id();
create or replace function slides.current_org_id()
returns text language sql stable as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'org_id'),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'org_id'),
    'birdsatfive'  -- single-tenant default until per-user org claims land
  );
$$;

-- 4) Recreate the policies, now comparing text-to-text

-- Decks
create policy "decks read by org" on slides.decks
  for select to authenticated
  using (org_id = slides.current_org_id());
create policy "decks insert by self" on slides.decks
  for insert to authenticated
  with check (owner_id = auth.uid() and org_id = slides.current_org_id());

-- Versions: same as before (no org_id on the row; goes through the deck)
create policy "versions read by deck access" on slides.deck_versions
  for select to authenticated
  using (exists (
    select 1 from slides.decks d
    where d.id = deck_id and d.org_id = slides.current_org_id()
  ));

-- Templates
create policy "templates read curated or own org" on slides.templates
  for select to authenticated
  using (kind = 'curated' or org_id = slides.current_org_id());
create policy "templates write own org" on slides.templates
  for insert to authenticated
  with check (kind in ('org','user') and org_id = slides.current_org_id());

-- Brand kits
create policy "brand kits read by org" on slides.brand_kits
  for select to authenticated
  using (org_id = slides.current_org_id());
create policy "brand kits write by org" on slides.brand_kits
  for all to authenticated
  using (org_id = slides.current_org_id())
  with check (org_id = slides.current_org_id());

-- Assets / share_links / share_views (deck-scoped, no direct change)
create policy "assets read by deck access" on slides.assets
  for select to authenticated
  using (exists (
    select 1 from slides.decks d
    where d.id = deck_id and d.org_id = slides.current_org_id()
  ));
create policy "share links read by deck access" on slides.share_links
  for select to authenticated
  using (exists (
    select 1 from slides.decks d
    where d.id = deck_id and d.org_id = slides.current_org_id()
  ));
create policy "share views read by deck access" on slides.share_views
  for select to authenticated
  using (exists (
    select 1
    from slides.share_links sl
    join slides.decks d on d.id = sl.deck_id
    where sl.id = share_link_id and d.org_id = slides.current_org_id()
  ));

-- Comments (auth side; anon policies were not org-scoped, leave them)
create policy "comments read by deck access" on slides.comments
  for select to authenticated
  using (exists (
    select 1 from slides.decks d
    where d.id = deck_id and d.org_id = slides.current_org_id()
  ));
create policy "comments write by org" on slides.comments
  for insert to authenticated
  with check (exists (
    select 1 from slides.decks d
    where d.id = deck_id and d.org_id = slides.current_org_id()
  ));
create policy "comments update by org" on slides.comments
  for update to authenticated
  using (exists (
    select 1 from slides.decks d
    where d.id = deck_id and d.org_id = slides.current_org_id()
  ));
