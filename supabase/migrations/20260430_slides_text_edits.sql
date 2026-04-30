-- Inline text edits, layered on top of the rendered HTML at view time.
-- Keyed by (version_id, slide_id, element_index) so edits travel with a
-- specific version's DOM. A regen creates a new version → indices reset,
-- which is the right semantic (the layout may have changed).

create table if not exists slides.deck_text_edits (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null references slides.deck_versions(id) on delete cascade,
  slide_id      text not null,
  element_index int  not null,
  new_text      text not null,
  updated_at    timestamptz not null default now(),
  unique (version_id, slide_id, element_index)
);

create index if not exists deck_text_edits_version_idx
  on slides.deck_text_edits(version_id);

alter table slides.deck_text_edits enable row level security;

-- Owner of the parent deck can read/write their edits. Public share viewers
-- read via service-role through the share render proxy, so anon does not
-- need a policy here.
drop policy if exists "text edits by deck owner" on slides.deck_text_edits;
create policy "text edits by deck owner" on slides.deck_text_edits
  for all to authenticated
  using (exists (
    select 1 from slides.deck_versions v
    join slides.decks d on d.id = v.deck_id
    where v.id = version_id and d.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from slides.deck_versions v
    join slides.decks d on d.id = v.deck_id
    where v.id = version_id and d.owner_id = auth.uid()
  ));

grant select, insert, update, delete on slides.deck_text_edits to authenticated;
grant select on slides.deck_text_edits to anon;
