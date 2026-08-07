-- ═══════════════════════════════════════════════════════════════════════════
-- 04 — AI assistant: conversations, messages and their retrieval citations.
--
-- Unlike the rest of the schema, these rows are scoped to a single user as
-- well as an organization: a conversation is private to whoever started it.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null default 'Nueva conversación',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index ai_conversations_owner_idx
  on public.ai_conversations (org_id, user_id, updated_at desc) where deleted_at is null;

create trigger ai_conversations_touch before update on public.ai_conversations
  for each row execute function app.touch_updated_at();

alter table public.ai_conversations enable row level security;
alter table public.ai_conversations force  row level security;

-- Note the deliberate difference from app.apply_standard_rls: membership alone
-- is not enough, the row must also belong to the caller.
create policy ai_conversations_select on public.ai_conversations
  for select to authenticated
  using (user_id = (select auth.uid()) and org_id in (select app.orgs_with('ia:use')));

create policy ai_conversations_insert on public.ai_conversations
  for insert to authenticated
  with check (user_id = (select auth.uid()) and org_id in (select app.orgs_with('ia:use')));

create policy ai_conversations_update on public.ai_conversations
  for update to authenticated
  using      (user_id = (select auth.uid()) and org_id in (select app.orgs_with('ia:use')))
  with check (user_id = (select auth.uid()) and org_id in (select app.orgs_with('ia:use')));

create policy ai_conversations_delete on public.ai_conversations
  for delete to authenticated
  using (user_id = (select auth.uid()) and org_id in (select app.orgs_with('ia:use')));

create table public.ai_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.ai_conversations (id) on delete cascade,
  role             text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content          text not null default '',
  -- Foundry IQ references[] plus any tool results, kept verbatim so a stored
  -- answer can still be traced back to what grounded it.
  citations        jsonb not null default '[]'::jsonb,
  -- Token counts and retrieval activity records, for cost attribution.
  usage            jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index ai_messages_conversation_idx
  on public.ai_messages (conversation_id, created_at);

alter table public.ai_messages enable row level security;
alter table public.ai_messages force  row level security;

create policy ai_messages_select on public.ai_messages
  for select to authenticated
  using (exists (
    select 1 from public.ai_conversations c
    where c.id = public.ai_messages.conversation_id
      and c.user_id = (select auth.uid())
  ));

create policy ai_messages_insert on public.ai_messages
  for insert to authenticated
  with check (exists (
    select 1 from public.ai_conversations c
    where c.id = public.ai_messages.conversation_id
      and c.user_id = (select auth.uid())
  ));

create policy ai_messages_delete on public.ai_messages
  for delete to authenticated
  using (exists (
    select 1 from public.ai_conversations c
    where c.id = public.ai_messages.conversation_id
      and c.user_id = (select auth.uid())
  ));

-- Cached dashboard insights. Regenerating on every page view was both slow and
-- expensive; the route reuses a row until it goes stale.
create table public.ai_insights (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  kind         text not null check (kind in ('dashboard', 'riesgos')),
  payload      jsonb not null,
  generated_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  unique (org_id, kind)
);

alter table public.ai_insights enable row level security;
alter table public.ai_insights force  row level security;

create policy ai_insights_select on public.ai_insights
  for select to authenticated
  using (org_id in (select app.orgs_with('dashboard:read')));

create policy ai_insights_write on public.ai_insights
  for all to authenticated
  using      (org_id in (select app.orgs_with('ia:use')))
  with check (org_id in (select app.orgs_with('ia:use')));
