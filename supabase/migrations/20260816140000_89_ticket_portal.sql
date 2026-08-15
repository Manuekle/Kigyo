-- ═══════════════════════════════════════════════════════════════════════════
-- 89 — Portal público de tickets (plan CRM/ERP/POS 6.2)
--
-- `/soporte/[token]`: el cliente consulta y abre tickets sin cuenta. Todo
-- pasa por un token opaco entregado una sola vez por `create_ticket_portal_token`.
--
-- Diferencias deliberadas con el enlace firmado de la mig. 62:
--  - El token se guarda **hasheado** (sha256): el plan 6.2 lo exige, y un
--    ticket puede quedar activo meses — un leak de la base no debe reabrir
--    el canal de soporte de un cliente.
--  - El token es por cliente, no por entidad: la consulta queda limitada al
--    `client_id` del token. Nunca se expone `org_id` ni ids internos; el
--    público solo ve `code` (TK-0001), asunto, estado y fechas.
--  - Rate limit en dos buckets (lectura y escritura) por token + mínimo de
--    2s entre peticiones. Sin captcha: se deja como decisión de activación
--    posterior («prueba de abuso antes de activar»), con los límites ya en
--    marcha.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.ticket_portal_tokens (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations (id) on delete cascade,
  client_id         uuid not null references public.clients (id) on delete cascade,
  token_hash        text not null unique,
  expires_on        timestamptz not null,
  revoked_at        timestamptz,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  last_used_at      timestamptz,
  -- Rate limit de lectura: ventana de 60s con contador, por token.
  read_bucket_min   int not null default 0,
  read_bucket_count int not null default 0,
  -- Rate limit de escritura (abrir/responder): ventana de 60s, por token.
  write_bucket_min  int not null default 0,
  write_bucket_count int not null default 0
);

create index ticket_portal_tokens_org_idx
  on public.ticket_portal_tokens (org_id, created_at desc);

comment on table public.ticket_portal_tokens is
  'Tokens del portal público de tickets. Hash sha256 del token crudo; '
  'el crudo solo se entrega una vez en create_ticket_portal_token. '
  'Sin políticas RLS: solo los RPC security definer lo tocan.';

alter table public.ticket_portal_tokens enable row level security;
alter table public.ticket_portal_tokens force  row level security;

revoke all on public.ticket_portal_tokens from public, anon, authenticated;

-- ─── Consumo común: valida token + tasa, avanza la ventana ──────────────────

create or replace function app.consume_portal_ticket_token(
  p_token text,
  p_read boolean,
  out v_id uuid,
  out v_org_id uuid,
  out v_client_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash    text := encode(extensions.digest(p_token, 'sha256'), 'hex');
  v_row     public.ticket_portal_tokens%rowtype;
  v_now     timestamptz := now();
  v_min     int := (extract(epoch from v_now) / 60)::int;
  v_ok_read boolean;
  v_ok_write boolean;
begin
  select * into v_row
  from public.ticket_portal_tokens
  where token_hash = v_hash;

  if v_row.id is null then
    raise exception 'token inválido' using errcode = 'KG201';
  end if;
  if v_row.expires_on < v_now then
    raise exception 'token vencido' using errcode = 'KG202';
  end if;
  if v_row.revoked_at is not null then
    raise exception 'token revocado' using errcode = 'KG203';
  end if;

  -- Mínimo 2s entre peticiones del mismo token.
  if v_row.last_used_at is not null and v_now - v_row.last_used_at < interval '2 seconds' then
    raise exception 'demasiadas peticiones' using errcode = 'KG204';
  end if;

  -- Ventana de 60s: 120 lecturas o 10 escrituras por hora real.
  if p_read then
    v_ok_read :=
      case when v_row.read_bucket_min <> v_min then true
           else v_row.read_bucket_count < 120 end;
  else
    v_ok_write :=
      case when v_row.write_bucket_min <> v_min then true
           else v_row.write_bucket_count < 10 end;
  end if;
  if not v_ok_read or not v_ok_write then
    raise exception 'demasiadas peticiones' using errcode = 'KG204';
  end if;

  update public.ticket_portal_tokens
  set last_used_at = v_now,
      read_bucket_min  = case when p_read then v_min else read_bucket_min end,
      read_bucket_count = case
        when p_read and read_bucket_min = v_min then read_bucket_count + 1
        when p_read then 1 else read_bucket_count end,
      write_bucket_min = case when not p_read then v_min else write_bucket_min end,
      write_bucket_count = case
        when not p_read and write_bucket_min = v_min then write_bucket_count + 1
        when not p_read then 1 else write_bucket_count end
  where id = v_row.id;

  v_id        := v_row.id;
  v_org_id    := v_row.org_id;
  v_client_id := v_row.client_id;
end;
$$;

-- ─── Crear token (solo administrador) ───────────────────────────────────────

create or replace function public.create_ticket_portal_token(
  p_client_id uuid,
  p_days int default 30
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org       uuid;
  v_token     text;
  v_expires   timestamptz;
begin
  select org_id into v_org
  from public.clients c
  where c.id = p_client_id and c.deleted_at is null;

  if v_org is null or not app.is_org_admin(v_org) then
    raise exception 'solo un administrador genera tokens' using errcode = 'KG205';
  end if;
  if not exists (
    select 1 from public.clients c
    where c.id = p_client_id and c.org_id = v_org and c.deleted_at is null
  ) then
    raise exception 'el cliente debe pertenecer a tu empresa' using errcode = 'KG206';
  end if;

  v_token := rtrim(
    translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_'),
    '='
  );
  v_expires := now() + make_interval(days => greatest(1, least(p_days, 365)));

  insert into public.ticket_portal_tokens (org_id, client_id, token_hash, expires_on, created_by)
  values (v_org, p_client_id, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_expires, auth.uid());

  return v_token;
end;
$$;

-- ─── Revocar (solo administrador) ───────────────────────────────────────────

create or replace function public.revoke_ticket_portal_tokens(p_client_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org  uuid;
  v_n    int;
begin
  select org_id into v_org
  from public.clients c
  where c.id = p_client_id and c.deleted_at is null;

  if v_org is null or not app.is_org_admin(v_org) then
    raise exception 'solo un administrador revoca tokens' using errcode = 'KG211';
  end if;

  update public.ticket_portal_tokens
  set revoked_at = now()
  where client_id = p_client_id and revoked_at is null and expires_on > now();

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ─── Consultas públicas (anónimas, autenticadas por token) ──────────────────

create or replace function public.portal_tickets(p_token text)
returns table (
  code text, subject text, status text,
  created_at timestamptz, body text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org     uuid;
  v_client  uuid;
begin
  select t.v_org_id, t.v_client_id into v_org, v_client
  from app.consume_portal_ticket_token(p_token, true) t;

  return query
  select tk.code, tk.subject, tk.status, tk.created_at, tk.body
  from public.tickets tk
  where tk.org_id = v_org
    and tk.client_id = v_client
    and tk.origin = 'Cliente'
    and tk.deleted_at is null
  order by tk.created_at desc;
end;
$$;

create or replace function public.portal_ticket_comments(p_token text, p_code text)
returns table (
  author text, body text, created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org     uuid;
  v_client  uuid;
  v_ticket  uuid;
begin
  select t.v_org_id, t.v_client_id into v_org, v_client
  from app.consume_portal_ticket_token(p_token, true) t;

  select tk.id into v_ticket
  from public.tickets tk
  where tk.org_id = v_org
    and tk.client_id = v_client
    and tk.origin = 'Cliente'
    and tk.deleted_at is null
    and tk.code = p_code;

  if v_ticket is null then
    raise exception 'ticket no encontrado' using errcode = 'KG207';
  end if;

  return query
  select
    case when c.author_id is null then 'Cliente' else e.full_name end as author,
    c.body, c.created_at
  from public.ticket_comments c
  left join public.employees e on e.id = c.author_id
  where c.ticket_id = v_ticket
  order by c.created_at asc;
end;
$$;

create or replace function public.portal_open_ticket(
  p_token text,
  p_subject text,
  p_body text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org     uuid;
  v_client  uuid;
  v_subject text := btrim(p_subject);
  v_body    text := btrim(p_body);
  v_code    text;
begin
  select t.v_org_id, t.v_client_id into v_org, v_client
  from app.consume_portal_ticket_token(p_token, false) t;

  if length(v_subject) < 1 or length(v_subject) > 200 then
    raise exception 'el asunto debe tener entre 1 y 200 caracteres' using errcode = 'KG208';
  end if;
  if length(v_body) < 1 then
    raise exception 'describe tu caso para abrir el ticket' using errcode = 'KG209';
  end if;

  insert into public.tickets (org_id, client_id, subject, body, origin, priority, status)
  values (v_org, v_client, v_subject, v_body, 'Cliente', 'Baja', 'Abierto')
  returning code into v_code;

  return v_code;
end;
$$;

create or replace function public.portal_reply_ticket(
  p_token text,
  p_code text,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org     uuid;
  v_client  uuid;
  v_ticket  uuid;
  v_body    text := btrim(p_body);
begin
  select t.v_org_id, t.v_client_id into v_org, v_client
  from app.consume_portal_ticket_token(p_token, false) t;

  if length(v_body) < 1 then
    raise exception 'escribe tu respuesta' using errcode = 'KG209';
  end if;

  select tk.id into v_ticket
  from public.tickets tk
  where tk.org_id = v_org
    and tk.client_id = v_client
    and tk.origin = 'Cliente'
    and tk.deleted_at is null
    and tk.code = p_code
    and tk.status <> 'Cerrado';

  if v_ticket is null then
    raise exception 'ticket no encontrado o cerrado' using errcode = 'KG210';
  end if;

  insert into public.ticket_comments (ticket_id, author_id, body)
  values (v_ticket, null, v_body);
end;
$$;

revoke all on function public.create_ticket_portal_token(uuid, int) from public, anon;
grant execute on function public.create_ticket_portal_token(uuid, int) to authenticated;
revoke all on function public.revoke_ticket_portal_tokens(uuid) from public, anon;
grant execute on function public.revoke_ticket_portal_tokens(uuid) to authenticated;
revoke all on function public.portal_tickets(text) from public, anon, authenticated;
grant execute on function public.portal_tickets(text) to anon, authenticated;
revoke all on function public.portal_ticket_comments(text, text) from public, anon, authenticated;
grant execute on function public.portal_ticket_comments(text, text) to anon, authenticated;
revoke all on function public.portal_open_ticket(text, text, text) from public, anon, authenticated;
grant execute on function public.portal_open_ticket(text, text, text) to anon, authenticated;
revoke all on function public.portal_reply_ticket(text, text, text) from public, anon, authenticated;
grant execute on function public.portal_reply_ticket(text, text, text) to anon, authenticated;
revoke all on function app.consume_portal_ticket_token(text, boolean) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop function if exists public.portal_reply_ticket(text, text, text);
--   drop function if exists public.portal_open_ticket(text, text, text);
--   drop function if exists public.portal_ticket_comments(text, text);
--   drop function if exists public.portal_tickets(text);
--   drop function if exists public.create_ticket_portal_token(uuid, int);
--   drop function if exists public.revoke_ticket_portal_tokens(uuid);
--   drop function if exists app.consume_portal_ticket_token(text, boolean);
--   drop table if exists public.ticket_portal_tokens;
-- ═══════════════════════════════════════════════════════════════════════════