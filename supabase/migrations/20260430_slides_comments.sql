-- slides.comments — viewer + author feedback per slide
--
-- Comments can be left by:
--   - Authenticated org members on /d/[id] (then share_link_id is NULL)
--   - Anonymous viewers on /s/[slug] (share_link_id set; gated by RLS through the link)
--
-- Slide id matches the slide_tree id keyed in `slides.deck_versions.slide_tree`.

create table if not exists slides.comments (
  id              uuid primary key default gen_random_uuid(),
  deck_id         uuid not null references slides.decks(id) on delete cascade,
  share_link_id   uuid references slides.share_links(id) on delete set null,
  slide_id        text,
  session_id      text,         -- nullable; matches share_views.session_id when anon
  author_name     text not null default 'Anonymous',
  author_user_id  uuid references auth.users(id) on delete set null,
  body            text not null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index comments_deck_idx on slides.comments (deck_id, created_at desc);
create index comments_share_idx on slides.comments (share_link_id);
create index comments_slide_idx on slides.comments (deck_id, slide_id);

alter table slides.comments enable row level security;

-- Org members read all deck comments
create policy "comments read by deck access" on slides.comments
  for select to authenticated
  using (exists (
    select 1 from slides.decks d
    where d.id = deck_id and d.org_id = slides.current_org_id()
  ));

-- Org members can post + resolve on their decks
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

-- Anon viewers (with a valid live share link) can read comments tied to that link
-- and post new ones. We rely on the API route to scope by share_link_id since
-- anon JWT lacks org claims; route handlers use service role with explicit checks.
create policy "comments read by share link" on slides.comments
  for select to anon
  using (share_link_id is not null);

create policy "comments insert by share link" on slides.comments
  for insert to anon
  with check (share_link_id is not null and body is not null and length(body) <= 4000);
