-- ═══════════════════════════════════════════════════════════════════════════
-- 01 — Core multi-tenancy: organizations, profiles, memberships, permissions
--
-- Every business table in later migrations carries `org_id` and is isolated by
-- the RLS pattern established here. Nothing in this file depends on the
-- application layer: if the app is bypassed entirely, tenant isolation holds.
-- ═══════════════════════════════════════════════════════════════════════════

create schema if not exists app;
revoke all on schema app from public, anon, authenticated;
grant usage on schema app to authenticated, service_role;

create extension if not exists pgcrypto with schema extensions;

-- ─── Shared helpers ─────────────────────────────────────────────────────────

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- `unaccent` is not enabled on every Supabase project and requires elevated
-- privileges on some plans, so fold the Spanish diacritics we care about by
-- hand. Defined before slugify(), which validates its body at creation time.
create or replace function app.unaccent_fallback(p_input text)
returns text
language sql
immutable
as $$
  select translate(
    coalesce(p_input, ''),
    'áàäâãÁÀÄÂÃéèëêÉÈËÊíìïîÍÌÏÎóòöôõÓÒÖÔÕúùüûÚÙÜÛñÑçÇ',
    'aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUnNcC'
  );
$$;

-- Lowercase, ASCII-folded, hyphenated. Used for organization slugs.
create or replace function app.slugify(p_input text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      btrim(
        regexp_replace(
          lower(app.unaccent_fallback(p_input)),
          '[^a-z0-9]+', '-', 'g'
        ),
        '-'
      ),
      ''
    ),
    'org'
  );
$$;

-- ─── Organizations ──────────────────────────────────────────────────────────

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 120),
  slug        text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  industry    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger organizations_touch
  before update on public.organizations
  for each row execute function app.touch_updated_at();

-- ─── Profiles (1:1 with auth.users) ─────────────────────────────────────────

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null check (email = lower(email) and email like '%_@_%'),
  full_name   text not null default '',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index profiles_email_key on public.profiles (email);

create trigger profiles_touch
  before update on public.profiles
  for each row execute function app.touch_updated_at();

-- ─── Roles & memberships ────────────────────────────────────────────────────

create table public.roles (
  key    text primary key,
  label  text not null,
  rank   int  not null  -- lower rank = more privilege; used for ordering only
);

insert into public.roles (key, label, rank) values
  ('Administrador',   'Administrador',   1),
  ('Líder de equipo', 'Líder de equipo', 2),
  ('Empleado',        'Empleado',        3);

create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null references public.roles (key),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, user_id)
);

create index memberships_user_idx on public.memberships (user_id);
create index memberships_org_idx  on public.memberships (org_id);

create trigger memberships_touch
  before update on public.memberships
  for each row execute function app.touch_updated_at();

-- ─── Permission catalogue ───────────────────────────────────────────────────
-- One canonical model: `<module>:<action>`. This replaces the two conflicting
-- models that existed before (verb-scoped in lib/data/nav.ts, module-scoped in
-- the configuración page's localStorage blob).

create table public.permissions (
  key          text primary key check (key ~ '^[a-z][a-z0-9-]*:(read|write|manage|use)$'),
  module       text not null,
  action       text not null check (action in ('read', 'write', 'manage', 'use')),
  label        text not null
);

insert into public.permissions (key, module, action, label) values
  ('dashboard:read',      'dashboard',     'read',   'Ver dashboard'),
  ('empleados:read',      'empleados',     'read',   'Ver empleados'),
  ('empleados:write',     'empleados',     'write',  'Gestionar empleados'),
  ('asistencia:read',     'asistencia',    'read',   'Ver asistencia'),
  ('asistencia:write',    'asistencia',    'write',  'Gestionar asistencia'),
  ('nomina:read',         'nomina',        'read',   'Ver nómina'),
  ('nomina:write',        'nomina',        'write',  'Gestionar nómina'),
  ('riesgos:read',        'riesgos',       'read',   'Ver riesgos'),
  ('riesgos:write',       'riesgos',       'write',  'Gestionar riesgos'),
  ('proyectos:read',      'proyectos',     'read',   'Ver proyectos'),
  ('proyectos:write',     'proyectos',     'write',  'Gestionar proyectos'),
  ('cotizaciones:read',   'cotizaciones',  'read',   'Ver cotizaciones'),
  ('cotizaciones:write',  'cotizaciones',  'write',  'Gestionar cotizaciones'),
  ('compras:read',        'compras',       'read',   'Ver compras'),
  ('compras:write',       'compras',       'write',  'Gestionar compras'),
  ('tienda:read',         'tienda',        'read',   'Ver tienda'),
  ('tienda:write',        'tienda',        'write',  'Gestionar tienda'),
  ('catalogos:read',      'catalogos',     'read',   'Ver catálogos'),
  ('catalogos:write',     'catalogos',     'write',  'Gestionar catálogos'),
  ('firmas:read',         'firmas',        'read',   'Ver firmas'),
  ('firmas:write',        'firmas',        'write',  'Gestionar firmas'),
  ('inventario:read',     'inventario',    'read',   'Ver inventario'),
  ('inventario:write',    'inventario',    'write',  'Gestionar inventario'),
  ('documentos:read',     'documentos',    'read',   'Ver documentos'),
  ('documentos:write',    'documentos',    'write',  'Gestionar documentos'),
  ('consultoria:read',    'consultoria',   'read',   'Ver consultoría'),
  ('consultoria:write',   'consultoria',   'write',  'Gestionar consultoría'),
  ('hseq:read',           'hseq',          'read',   'Ver HSEQ'),
  ('hseq:write',          'hseq',          'write',  'Gestionar HSEQ'),
  ('tickets:read',        'tickets',       'read',   'Ver tickets'),
  ('tickets:write',       'tickets',       'write',  'Gestionar tickets'),
  ('canales:read',        'canales',       'read',   'Ver canales'),
  ('canales:write',       'canales',       'write',  'Gestionar canales'),
  ('calendario:read',     'calendario',    'read',   'Ver calendario'),
  ('calendario:write',    'calendario',    'write',  'Gestionar calendario'),
  ('trazabilidad:read',   'trazabilidad',  'read',   'Ver trazabilidad'),
  ('ia:use',              'ia',            'use',    'Usar el asistente de IA'),
  ('configuracion:read',  'configuracion', 'read',   'Ver configuración'),
  ('configuracion:manage','configuracion', 'manage', 'Administrar la organización');

-- Grants, per organization and role. Editable from the configuración screen.
create table public.role_permissions (
  org_id      uuid not null references public.organizations (id) on delete cascade,
  role        text not null references public.roles (key),
  permission  text not null references public.permissions (key) on delete cascade,
  primary key (org_id, role, permission)
);

create index role_permissions_lookup_idx
  on public.role_permissions (permission, org_id, role);

-- ─── Invitations ────────────────────────────────────────────────────────────

create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  email       text not null check (email = lower(email)),
  role        text not null references public.roles (key),
  token_hash  text not null unique,
  invited_by  uuid references public.profiles (id) on delete set null,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (org_id, email)
);

create index invitations_email_idx on public.invitations (email) where accepted_at is null;

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS foundation
--
-- `app.orgs_with(permission)` is the single primitive every policy is built
-- on. It is SECURITY DEFINER so it can read memberships without tripping the
-- policies on memberships itself, and STABLE so Postgres hoists it into an
-- InitPlan — evaluated once per query, not once per row.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.current_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id
  from public.memberships m
  where m.user_id = (select auth.uid());
$$;

create or replace function app.orgs_with(p_permission text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id
  from public.memberships m
  join public.role_permissions rp
    on rp.org_id = m.org_id
   and rp.role   = m.role
  where m.user_id     = (select auth.uid())
    and rp.permission = p_permission;
$$;

create or replace function app.is_org_admin(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = (select auth.uid())
      and m.org_id  = p_org_id
      and m.role    = 'Administrador'
  );
$$;

revoke all on function app.current_org_ids(), app.orgs_with(text), app.is_org_admin(uuid) from public, anon;
grant execute on function app.current_org_ids(), app.orgs_with(text), app.is_org_admin(uuid) to authenticated;

-- Applies the standard four policies to a business table. Every table gets the
-- same shape, so generating them removes the chance of one being forgotten or
-- subtly mistyped — which is exactly how tenant leaks happen.
create or replace function app.apply_standard_rls(
  p_table       text,
  p_read_perm   text,
  p_write_perm  text
)
returns void
language plpgsql
as $$
declare
  t text := format('public.%I', p_table);
begin
  execute format('alter table %s enable row level security', t);
  execute format('alter table %s force  row level security', t);

  execute format($f$
    create policy %I on %s for select to authenticated
    using (org_id in (select app.orgs_with(%L)))
  $f$, p_table || '_select', t, p_read_perm);

  execute format($f$
    create policy %I on %s for insert to authenticated
    with check (org_id in (select app.orgs_with(%L)))
  $f$, p_table || '_insert', t, p_write_perm);

  execute format($f$
    create policy %I on %s for update to authenticated
    using      (org_id in (select app.orgs_with(%L)))
    with check (org_id in (select app.orgs_with(%L)))
  $f$, p_table || '_update', t, p_write_perm, p_write_perm);

  execute format($f$
    create policy %I on %s for delete to authenticated
    using (org_id in (select app.orgs_with(%L)))
  $f$, p_table || '_delete', t, p_write_perm);
end;
$$;

-- Child tables (line items, comments, checklists) inherit isolation from their
-- parent instead of carrying their own org_id lookup in every policy.
create or replace function app.apply_child_rls(
  p_table        text,
  p_parent_table text,
  p_fk_column    text,
  p_read_perm    text,
  p_write_perm   text
)
returns void
language plpgsql
as $$
declare
  t text := format('public.%I', p_table);
  p text := format('public.%I', p_parent_table);
  -- The FK column is qualified with the child table name: leaving it bare lets
  -- it bind to a same-named column on the parent and silently match every row.
  read_expr  text := format(
    'exists (select 1 from %s parent where parent.id = %s.%I and parent.org_id in (select app.orgs_with(%L)))',
    p, t, p_fk_column, p_read_perm);
  write_expr text := format(
    'exists (select 1 from %s parent where parent.id = %s.%I and parent.org_id in (select app.orgs_with(%L)))',
    p, t, p_fk_column, p_write_perm);
begin
  execute format('alter table %s enable row level security', t);
  execute format('alter table %s force  row level security', t);

  execute format('create policy %I on %s for select to authenticated using (%s)',
                 p_table || '_select', t, read_expr);
  execute format('create policy %I on %s for insert to authenticated with check (%s)',
                 p_table || '_insert', t, write_expr);
  execute format('create policy %I on %s for update to authenticated using (%s) with check (%s)',
                 p_table || '_update', t, write_expr, write_expr);
  execute format('create policy %I on %s for delete to authenticated using (%s)',
                 p_table || '_delete', t, write_expr);
end;
$$;

-- ─── Policies for the core tables themselves ────────────────────────────────

alter table public.organizations   enable row level security;
alter table public.organizations   force  row level security;
alter table public.profiles        enable row level security;
alter table public.profiles        force  row level security;
alter table public.memberships     enable row level security;
alter table public.memberships     force  row level security;
alter table public.role_permissions enable row level security;
alter table public.role_permissions force  row level security;
alter table public.invitations     enable row level security;
alter table public.invitations     force  row level security;
alter table public.roles           enable row level security;
alter table public.permissions     enable row level security;

-- Reference data: readable by any signed-in user, writable by nobody.
create policy roles_select on public.roles
  for select to authenticated using (true);
create policy permissions_select on public.permissions
  for select to authenticated using (true);

create policy organizations_select on public.organizations
  for select to authenticated
  using (id in (select app.current_org_ids()));

create policy organizations_update on public.organizations
  for update to authenticated
  using      (app.is_org_admin(id))
  with check (app.is_org_admin(id));

-- Own profile, plus the profiles of people you share an organization with.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.memberships m
      where m.user_id = public.profiles.id
        and m.org_id in (select app.current_org_ids())
    )
  );

create policy profiles_update_self on public.profiles
  for update to authenticated
  using      (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy memberships_select on public.memberships
  for select to authenticated
  using (org_id in (select app.current_org_ids()));

-- Only admins change who belongs to an organization and at what role. The
-- self-demotion guard lives in a trigger below, since RLS cannot express it.
create policy memberships_write on public.memberships
  for all to authenticated
  using      (app.is_org_admin(org_id))
  with check (app.is_org_admin(org_id));

create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using (org_id in (select app.current_org_ids()));

create policy role_permissions_write on public.role_permissions
  for all to authenticated
  using      (app.is_org_admin(org_id))
  with check (app.is_org_admin(org_id));

create policy invitations_select on public.invitations
  for select to authenticated
  using (org_id in (select app.current_org_ids()));

create policy invitations_write on public.invitations
  for all to authenticated
  using      (app.is_org_admin(org_id))
  with check (app.is_org_admin(org_id));

-- An organization must never be left without an administrator: without this,
-- a sole admin can demote themselves and permanently lock the tenant out.
create or replace function app.guard_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admins int;
begin
  -- NEW is unassigned on DELETE, so it must never be dereferenced there.
  if tg_op = 'UPDATE' and new.role = 'Administrador' then
    return new;
  end if;

  -- Deleting the organization itself cascades into memberships. There is no
  -- tenant left to lock out, so the guard must stand down — otherwise an
  -- organization with exactly one admin could never be removed at all.
  if tg_op = 'DELETE'
     and not exists (select 1 from public.organizations o where o.id = old.org_id) then
    return old;
  end if;

  select count(*) into v_admins
  from public.memberships m
  where m.org_id = old.org_id
    and m.role   = 'Administrador'
    and m.id <> old.id;

  if v_admins = 0 then
    raise exception 'La organización debe conservar al menos un administrador'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger memberships_guard_last_admin
  before update or delete on public.memberships
  for each row
  when (old.role = 'Administrador')
  execute function app.guard_last_admin();

-- ─── Default permission grants for a new organization ───────────────────────
-- Mirrors the intent of the old client-side PERMS_DEFAULT, now authoritative.

create or replace function app.seed_default_permissions(p_org_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.role_permissions (org_id, role, permission)
  select p_org_id, 'Administrador', key from public.permissions
  union all
  select p_org_id, 'Líder de equipo', key from public.permissions
    where key in (
      'dashboard:read', 'empleados:read', 'asistencia:read', 'asistencia:write',
      'riesgos:read', 'proyectos:read', 'proyectos:write', 'cotizaciones:read',
      'compras:read', 'compras:write', 'tienda:read', 'catalogos:read',
      'firmas:read', 'inventario:read', 'documentos:read', 'consultoria:read',
      'hseq:read', 'hseq:write', 'tickets:read', 'tickets:write',
      'canales:read', 'canales:write', 'calendario:read', 'calendario:write',
      'trazabilidad:read', 'ia:use'
    )
  union all
  select p_org_id, 'Empleado', key from public.permissions
    where key in (
      'dashboard:read', 'empleados:read', 'asistencia:read', 'documentos:read',
      'tickets:read', 'calendario:read', 'canales:read', 'tienda:read', 'ia:use'
    )
  on conflict do nothing;
$$;

-- ─── Signup: create profile, organization and membership atomically ─────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name     text;
  v_company  text;
  v_slug     text;
  v_slug_try text;
  v_org_id   uuid;
  v_invite   public.invitations%rowtype;
  n          int := 0;
begin
  v_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, email, full_name)
  values (new.id, lower(new.email), v_name)
  on conflict (id) do nothing;

  -- Invited user: join the existing organization, never create a new one.
  select * into v_invite
  from public.invitations
  where email = lower(new.email)
    and accepted_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  if found then
    insert into public.memberships (org_id, user_id, role)
    values (v_invite.org_id, new.id, v_invite.role)
    on conflict (org_id, user_id) do nothing;

    update public.invitations set accepted_at = now() where id = v_invite.id;
    return new;
  end if;

  v_company := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'company'), ''),
    v_name
  );

  v_slug := app.slugify(v_company);
  v_slug_try := v_slug;
  while exists (select 1 from public.organizations o where o.slug = v_slug_try) loop
    n := n + 1;
    v_slug_try := v_slug || '-' || n::text;
  end loop;

  insert into public.organizations (name, slug, industry)
  values (v_company, v_slug_try, nullif(btrim(new.raw_user_meta_data ->> 'industry'), ''))
  returning id into v_org_id;

  insert into public.memberships (org_id, user_id, role)
  values (v_org_id, new.id, 'Administrador');

  perform app.seed_default_permissions(v_org_id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Per-organization human-readable codes (TK-1287, PRY-0001, …) ───────────
-- Replaces the four incompatible id conventions the mock data used.

create table app.code_counters (
  org_id    uuid not null references public.organizations (id) on delete cascade,
  entity    text not null,
  next_val  bigint not null default 1,
  primary key (org_id, entity)
);

create or replace function app.next_code(
  p_org_id uuid,
  p_entity text,
  p_prefix text,
  p_pad    int default 4
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v bigint;
begin
  insert into app.code_counters (org_id, entity, next_val)
  values (p_org_id, p_entity, 2)
  on conflict (org_id, entity)
    do update set next_val = app.code_counters.next_val + 1
  returning next_val - 1 into v;

  return p_prefix || '-' || lpad(v::text, p_pad, '0');
end;
$$;

-- Trigger form. Args: [0] entity key, [1] display prefix, [2] zero padding.
create or replace function app.set_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.code is null or btrim(new.code) = '' then
    new.code := app.next_code(
      new.org_id,
      tg_argv[0],
      tg_argv[1],
      coalesce(nullif(tg_argv[2], '')::int, 4)
    );
  end if;
  return new;
end;
$$;
