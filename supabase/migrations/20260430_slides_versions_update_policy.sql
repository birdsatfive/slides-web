-- Allow the deck owner to update their own version rows. Without this,
-- slides-web's `update({ html_path }).eq('id', version.id)` was silently
-- rejected by RLS — left versions with html_path NULL and the viewer stuck
-- on "Not designed yet" even though slides-api had uploaded the HTML.

drop policy if exists "versions update by deck owner" on slides.deck_versions;
create policy "versions update by deck owner" on slides.deck_versions
  for update to authenticated
  using (exists (
    select 1 from slides.decks d
    where d.id = deck_id and d.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from slides.decks d
    where d.id = deck_id and d.owner_id = auth.uid()
  ));
