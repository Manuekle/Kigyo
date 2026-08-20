-- 86 — Native document RAG: chunks, vectors and attributable AI cost.
--
-- Escrita para poder volver a pasar por encima de una base donde parte de esto
-- ya existe. No es una preferencia de estilo: esta migración llegó a aplicarse
-- sin quedar anotada en `supabase_migrations.schema_migrations`, y el siguiente
-- `db:push` la reintentó y murió en el primer `create table`. Una migración que
-- solo funciona sobre una base virgen no se puede reintentar, y reintentar es
-- exactamente lo que hace falta cuando algo salió a medias.

create extension if not exists vector with schema extensions;

create table if not exists public.document_chunks (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete cascade,
  document_id      uuid not null references public.documents (id) on delete cascade,
  chunk_index      integer not null check (chunk_index >= 0),
  content          text not null check (length(btrim(content)) > 0),
  content_hash     text not null,
  token_count      integer not null default 0 check (token_count >= 0),
  embedding        extensions.vector(1536),
  embedding_model  text,
  status           text not null default 'pending'
                   check (status in ('pending', 'ready', 'failed', 'stale', 'deleted')),
  error            text,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists document_chunks_org_idx on public.document_chunks (org_id, status);
create index if not exists document_chunks_document_idx on public.document_chunks (document_id, chunk_index);
create index if not exists document_chunks_embedding_hnsw
  on public.document_chunks using hnsw (embedding vector_cosine_ops)
  where embedding is not null and status = 'ready';

drop trigger if exists document_chunks_touch on public.document_chunks;
create trigger document_chunks_touch before update on public.document_chunks
  for each row execute function app.touch_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'document_chunks'
  ) then
    perform app.apply_standard_rls('document_chunks', 'documentos:read', 'documentos:write');
  end if;
end $$;

create table if not exists public.ai_usage_events (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references public.organizations (id) on delete cascade,
  user_id              uuid references public.profiles (id) on delete set null,
  document_id          uuid references public.documents (id) on delete set null,
  operation            text not null check (operation in ('chat', 'embedding', 'retrieval', 'review')),
  model                text not null,
  input_tokens         integer not null default 0 check (input_tokens >= 0),
  output_tokens        integer not null default 0 check (output_tokens >= 0),
  embedding_tokens     integer not null default 0 check (embedding_tokens >= 0),
  estimated_cost_cents bigint not null default 0 check (estimated_cost_cents >= 0),
  metadata             jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now()
);

create index if not exists ai_usage_events_org_month_idx on public.ai_usage_events (org_id, created_at desc);
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'ai_usage_events'
  ) then
    perform app.apply_standard_rls('ai_usage_events', 'ia:use', 'ia:use');
  end if;
end $$;

create table if not exists public.ai_monthly_budgets (
  org_id              uuid not null references public.organizations (id) on delete cascade,
  month_start         date not null,
  limit_cents         bigint not null default 5000 check (limit_cents >= 0),
  reserved_cents      bigint not null default 0 check (reserved_cents >= 0),
  mode                text not null default 'hard' check (mode in ('soft', 'hard')),
  updated_at          timestamptz not null default now(),
  primary key (org_id, month_start)
);

drop trigger if exists ai_monthly_budgets_touch on public.ai_monthly_budgets;
create trigger ai_monthly_budgets_touch before update on public.ai_monthly_budgets
  for each row execute function app.touch_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'ai_monthly_budgets'
  ) then
    perform app.apply_standard_rls('ai_monthly_budgets', 'ia:use', 'configuracion:manage');
  end if;
end $$;

create or replace function public.match_document_chunks(
  query_embedding extensions.vector(1536),
  p_org_id        uuid,
  match_threshold real default 0.72,
  match_count     integer default 8
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
    and 1 - (c.embedding <=> query_embedding) >= greatest(0, least(match_threshold, 1))
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 50);
$$;

revoke all on function public.match_document_chunks(extensions.vector(1536), uuid, real, integer)
  from public, anon;
grant execute on function public.match_document_chunks(extensions.vector(1536), uuid, real, integer)
  to authenticated;

create or replace function public.reserve_ai_budget(
  p_org_id       uuid,
  p_month_start  date,
  p_cost_cents   bigint
)
returns table (allowed boolean, reserved_cents bigint, limit_cents bigint)
language plpgsql
security definer
set search_path = public, app
as $$
declare
  budget public.ai_monthly_budgets%rowtype;
begin
  if p_cost_cents < 0 then
    raise exception 'negative AI cost';
  end if;

  if not exists (
    select 1
    from app.orgs_with('ia:use') as permitted(org_id)
    where permitted.org_id = p_org_id
  ) then
    raise exception 'AI permission required';
  end if;

  insert into public.ai_monthly_budgets (org_id, month_start)
  values (p_org_id, p_month_start)
  on conflict (org_id, month_start) do nothing;

  select * into budget
  from public.ai_monthly_budgets
  where org_id = p_org_id and month_start = p_month_start
  for update;

  if budget.mode = 'hard' and budget.reserved_cents + p_cost_cents > budget.limit_cents then
    return query select false, budget.reserved_cents, budget.limit_cents;
    return;
  end if;

  update public.ai_monthly_budgets b
  set reserved_cents = b.reserved_cents + p_cost_cents,
      updated_at = now()
  where b.org_id = p_org_id and b.month_start = p_month_start;

  return query select true, budget.reserved_cents + p_cost_cents, budget.limit_cents;
end;
$$;

revoke all on function public.reserve_ai_budget(uuid, date, bigint) from public, anon;
grant execute on function public.reserve_ai_budget(uuid, date, bigint) to authenticated;

comment on table public.document_chunks is
  'Tenant-scoped extracted document chunks and embeddings for native RAG.';
comment on table public.ai_usage_events is
  'Immutable cost ledger for chat, retrieval, embeddings and document review.';
comment on table public.ai_monthly_budgets is
  'Per-company monthly AI reservation and hard/soft spending policy.';
