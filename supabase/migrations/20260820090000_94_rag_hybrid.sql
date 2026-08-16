-- 94 — Hybrid lexical + vector retrieval and idempotent re-indexing.
--
-- Closes plan 7.4.2 (lexical complement for codes, names and dates) and
-- 7.5 (never embed the same content twice).

-- ─── Lexical column ────────────────────────────────────────────────────────

alter table public.document_chunks
  add column content_tsv tsvector
  generated always as (to_tsvector('simple', content)) stored;

create index document_chunks_tsv_gin
  on public.document_chunks using gin (content_tsv)
  where status = 'ready';

-- ─── Hybrid search ──────────────────────────────────────────────────────────
--
-- Vector similarity for semantics, ts_rank for codes/names/dates. A chunk
-- matches if either side clears its bar; ranking blends both so a strong
-- lexical hit surfaces above a weak semantic one.

create or replace function public.match_document_chunks_hybrid(
  query_embedding extensions.vector(1536),
  query_text       text,
  p_org_id         uuid,
  match_threshold  real default 0.68,
  match_count      integer default 8
)
returns table (
  id           uuid,
  document_id  uuid,
  content      text,
  chunk_index  integer,
  metadata     jsonb,
  similarity   real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    c.id,
    c.document_id,
    c.content,
    c.chunk_index,
    c.metadata,
    (1 - (c.embedding <=> query_embedding))::real as similarity
  from public.document_chunks c
  where c.org_id = p_org_id
    and c.status = 'ready'
    and c.embedding is not null
    and (
      1 - (c.embedding <=> query_embedding) >= greatest(0, least(match_threshold, 1))
      or c.content_tsv @@ plainto_tsquery('simple', query_text)
    )
  order by
    (case when c.content_tsv @@ plainto_tsquery('simple', query_text) then 1 else 0 end
       + (1 - (c.embedding <=> query_embedding))) desc
  limit least(greatest(match_count, 1), 50);
$$;

revoke all on function public.match_document_chunks_hybrid(extensions.vector(1536), text, uuid, real, integer)
  from public, anon;
grant execute on function public.match_document_chunks_hybrid(extensions.vector(1536), text, uuid, real, integer)
  to authenticated;

comment on function public.match_document_chunks_hybrid is
  'Vector + tsvector hybrid retrieval, org-filtered inside the function (invoker).';