-- ═══════════════════════════════════════════════════════════════════════════
-- 13 — The document review's verdict, in two columns instead of one.
--
-- `documents.ai_verdict` has existed since migration 03 and nothing ever wrote
-- it. Now that something does, one free-text column is not enough: the screen
-- wants to sort and badge by outcome, and deriving "is this a problem" by
-- pattern-matching a Spanish sentence is how a nice sentence becomes a bug.
--
-- So the verdict splits: `ai_status` is the outcome, constrained to three
-- values the UI can switch on, and `ai_verdict` stays the sentence a person
-- reads. `ai_checked_at` already recorded when, and still does.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.documents
  add column ai_status text
    check (ai_status is null or ai_status in ('Correcto', 'Revisar', 'Incompleto'));

comment on column public.documents.ai_status is
  'Outcome of the last AI review. Null means never reviewed — which is not the '
  'same as reviewed and found correct, and the screen says so.';

-- Reviewed documents that need attention are what the screen filters for, and
-- on a repository of any size that is a small slice of the table.
create index documents_ai_status_idx on public.documents (org_id, ai_status)
  where deleted_at is null and ai_status is not null;
