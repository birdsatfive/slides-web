-- Folder shares: a whole static site (index + sub-pages + assets) uploaded
-- as one bundle rather than a single self-contained file. Files live under
-- `slides-html/{deck_id}/{version_id}/…` and are served by
-- /api/share/[slug]/f/[...path], which gives relative links a real root.

alter table slides.decks
  drop constraint if exists decks_source_kind_check;

alter table slides.decks
  add constraint decks_source_kind_check
  check (source_kind in ('pptx','pdf','docx','url','prompt','markdown','sharepoint','shared_only','shared_bundle'));
