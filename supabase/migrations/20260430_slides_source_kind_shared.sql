-- Allow share-only uploads (no AI involved). The /share/new flow uses
-- source_kind='shared_only' to flag a deck whose payload is a finished
-- HTML / PDF the user dropped in.

alter table slides.decks
  drop constraint if exists decks_source_kind_check;

alter table slides.decks
  add constraint decks_source_kind_check
  check (source_kind in ('pptx','pdf','docx','url','prompt','markdown','sharepoint','shared_only'));
