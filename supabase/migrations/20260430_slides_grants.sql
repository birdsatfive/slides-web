-- Table-level grants for the slides schema. Without these, even with RLS
-- policies in place, PostgREST queries fail with "permission denied for
-- table X". RLS narrows what rows you see; GRANT decides whether you can
-- look at all.

grant select, insert, update, delete on all tables in schema slides to authenticated;
grant select, insert on slides.share_views to anon;
grant select, insert on slides.comments  to anon;
grant select          on slides.share_links to anon;   -- for /s/[slug] gate
grant select          on slides.decks to anon;         -- title only via API; RLS still hides everything else
grant select          on slides.deck_versions to anon; -- read html_path via signed URL flow
grant select          on slides.templates to anon;     -- harmless: only curated visible

-- Apply to future tables in this schema as well
alter default privileges in schema slides grant select, insert, update, delete on tables to authenticated;

-- Sequences (uuid pk default doesn't need this, but if any are added)
grant usage, select on all sequences in schema slides to authenticated;
alter default privileges in schema slides grant usage, select on sequences to authenticated;
