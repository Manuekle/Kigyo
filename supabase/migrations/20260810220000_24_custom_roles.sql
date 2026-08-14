-- ═══════════════════════════════════════════════════════════════════════════
-- 24 — Roles belong to the organization, not to the schema
--
-- `public.roles` shipped as reference data: three global rows —
-- Administrador, Líder de equipo, Empleado — shared by every tenant and
-- writable by nobody. That made a role a property of Kigyo rather than of the
-- company using it, and it is the wrong owner. A clinic wants «Médico»,
-- «Recepción» and «Facturación»; a construction firm wants «Residente de
-- obra» and «Almacenista». Neither of them wants «Líder de equipo», and
-- neither could add what they do want: the permission matrix only offered the
-- three rows the schema happened to contain.
--
-- After this migration a role is a tenant row — `(org_id, key)` — that an
-- administrator creates, renames, reorders and deletes. The three original
-- roles survive as seeded rows in every organization, marked `is_system` so
-- the UI can say where they came from, but they carry no special power.
--
-- ─── What "administrator" means now ────────────────────────────────────────
--
-- It used to mean `memberships.role = 'Administrador'`, a string literal in
-- `app.is_org_admin` and in the last-admin guard. With custom roles that
-- literal is meaningless: an organization may rename the role, delete it, or
-- run three different roles that all administer. So administrator becomes
-- what it always described — *holding `configuracion:manage`* — and the two
-- functions ask the permission instead of the name.
--
-- That is a strictly wider definition (the seeded Administrador role holds
-- every permission, so it still qualifies) and it is the only one that keeps
-- working when the names are the customer's to choose.
--
-- ─── Locking yourself out ──────────────────────────────────────────────────
--
-- Total control includes the control to leave nobody in charge, and that is
-- the one outcome with no way back short of a database console. Two constraint
-- triggers — one on `memberships`, one on `role_permissions` — refuse any
-- statement that leaves zero people holding `configuracion:manage`.
--
-- They watch UPDATE and DELETE only. An INSERT cannot remove the last
-- administrator, and covering it would break signup, where the organization,
-- its roles, its first membership and its default grants are four writes in
-- one transaction: a check on the membership INSERT would fire before the
-- grants that make that person an administrator exist.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Drop what points at the old global keys ────────────────────────────────
-- All four are single-column references to `roles (key)`. They come back as
-- composite `(org_id, role)` references further down, which is what stops one
-- tenant's membership from naming another tenant's role.

alter table public.memberships      drop constraint if exists memberships_role_fkey;
alter table public.role_permissions drop constraint if exists role_permissions_role_fkey;
alter table public.invitations      drop constraint if exists invitations_role_fkey;
alter table public.employees        drop constraint if exists employees_access_role_fkey;

-- The guard's WHEN clause names 'Administrador'. It is replaced below by a
-- deferred constraint trigger that asks the permission instead, so it has to
-- go before the definition it depends on changes underneath it.
drop trigger if exists memberships_guard_last_admin on public.memberships;

-- ─── The table, rebuilt per organization ────────────────────────────────────

drop table if exists public.roles;

create table public.roles (
  org_id      uuid not null references public.organizations (id) on delete cascade,
  -- The stable identity, and the value stored in `memberships.role`. Editable
  -- only by deleting and recreating: renaming it in place would orphan every
  -- membership, grant and invitation that names it. `label` is the field an
  -- administrator edits when they want a different word on screen.
  key         text not null check (length(btrim(key)) between 2 and 40),
  label       text not null check (length(btrim(label)) between 2 and 40),
  -- Lower rank = more privilege. Ordering only — nothing derives authority
  -- from it, so an organization that gets the numbers wrong sees a badly
  -- sorted list, not a security hole.
  rank        int  not null default 50,
  -- Seeded by Kigyo rather than created by the customer. Purely informational:
  -- a system role can be renamed, emptied of permissions and deleted like any
  -- other. The flag exists so the UI can explain where the row came from.
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (org_id, key)
);

create index roles_org_rank_idx on public.roles (org_id, rank);

create trigger roles_touch before update on public.roles
  for each row execute function app.touch_updated_at();

comment on table public.roles is
  'Roles, per organization. Created and deleted by administrators; `key` is the value memberships store.';
comment on column public.roles.is_system is
  'Seeded with the organization. Informational only — carries no extra privilege and can be deleted.';

-- ─── Every existing organization keeps the three it had ─────────────────────
-- Same keys as the old global rows, so every `memberships.role`,
-- `role_permissions.role`, `invitations.role` and `employees.access_role`
-- already stored resolves against the new composite key without a data fix.

create or replace function app.seed_default_roles(p_org_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.roles (org_id, key, label, rank, is_system) values
    (p_org_id, 'Administrador',   'Administrador',   10, true),
    (p_org_id, 'Líder de equipo', 'Líder de equipo', 20, true),
    (p_org_id, 'Empleado',        'Empleado',        30, true)
  on conflict (org_id, key) do nothing;
$$;

revoke all on function app.seed_default_roles(uuid) from public, anon, authenticated;

select app.seed_default_roles(o.id) from public.organizations o;

-- A row written before this migration could name a role that the seed above
-- does not cover only if it was inserted by hand. Adopt any such value as a
-- real role rather than dropping the membership on the floor when the foreign
-- key goes back on.
insert into public.roles (org_id, key, label, rank, is_system)
select distinct m.org_id, m.role, m.role, 50, false
from public.memberships m
where not exists (
  select 1 from public.roles r where r.org_id = m.org_id and r.key = m.role
)
on conflict (org_id, key) do nothing;

insert into public.roles (org_id, key, label, rank, is_system)
select distinct e.org_id, e.access_role, e.access_role, 50, false
from public.employees e
where not exists (
  select 1 from public.roles r where r.org_id = e.org_id and r.key = e.access_role
)
on conflict (org_id, key) do nothing;

-- Grants and invitations naming a role that no longer exists are deleted, not
-- adopted: a permission granted to nobody and an invitation to a role nobody
-- can hold are both dead rows, and adopting them would invent roles out of
-- typos.
delete from public.role_permissions rp
where not exists (
  select 1 from public.roles r where r.org_id = rp.org_id and r.key = rp.role
);

delete from public.invitations i
where not exists (
  select 1 from public.roles r where r.org_id = i.org_id and r.key = i.role
);

-- ─── The composite references ───────────────────────────────────────────────
-- `on update cascade` is deliberate even though `key` is not meant to change:
-- if a future migration ever renames one, the rename must reach the rows that
-- name it rather than abort halfway.

alter table public.memberships
  add constraint memberships_role_fkey
  foreign key (org_id, role) references public.roles (org_id, key)
  on update cascade on delete restrict;

alter table public.role_permissions
  add constraint role_permissions_role_fkey
  foreign key (org_id, role) references public.roles (org_id, key)
  on update cascade on delete cascade;

alter table public.invitations
  add constraint invitations_role_fkey
  foreign key (org_id, role) references public.roles (org_id, key)
  on update cascade on delete cascade;

alter table public.employees
  add constraint employees_access_role_fkey
  foreign key (org_id, access_role) references public.roles (org_id, key)
  on update cascade on delete restrict;

-- Deleting a role takes its grants with it (`cascade`) but is refused while a
-- person or an employee record still holds it (`restrict`). That asymmetry is
-- the useful one: a grant without a role means nothing, whereas a membership
-- without a role is a person with no defined access, and silently emptying it
-- would be worse than making the administrator reassign them first.

-- ─── RLS: tenant data now, not reference data ───────────────────────────────

alter table public.roles enable row level security;
alter table public.roles force  row level security;

create policy roles_select on public.roles
  for select to authenticated
  using (org_id in (select app.current_org_ids()));

create policy roles_write on public.roles
  for all to authenticated
  using      (app.is_org_admin(org_id))
  with check (app.is_org_admin(org_id));

-- Migration 08 revoked writes on `roles` because it was schema-level reference
-- data. It is tenant data now, and the policies above are what limits it.
grant select, insert, update, delete on public.roles to authenticated;

-- ─── Administrator = holds configuracion:manage ─────────────────────────────

create or replace function app.org_admin_count(p_org_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.memberships m
  join public.role_permissions rp
    on rp.org_id = m.org_id
   and rp.role   = m.role
  where m.org_id     = p_org_id
    and rp.permission = 'configuracion:manage';
$$;

revoke all on function app.org_admin_count(uuid) from public, anon, authenticated;

/**
 * Replaces the `m.role = 'Administrador'` literal.
 *
 * Every policy in the schema that gates an admin-only write goes through this
 * one function, so the definition changes in a single place and the twelve
 * call sites do not need to know it moved from a name to a permission.
 */
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
    join public.role_permissions rp
      on rp.org_id = m.org_id
     and rp.role   = m.role
    where m.user_id    = (select auth.uid())
      and m.org_id     = p_org_id
      and rp.permission = 'configuracion:manage'
  );
$$;

grant execute on function app.is_org_admin(uuid) to authenticated;

-- ─── The lockout guard ──────────────────────────────────────────────────────

create or replace function app.guard_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  -- Both tables the triggers sit on carry `org_id`, so one function serves
  -- both. NEW is unassigned on DELETE and OLD on INSERT; coalesce reads
  -- whichever exists.
  v_org_id := coalesce(new.org_id, old.org_id);

  -- Deleting the organization itself cascades into memberships, roles and
  -- grants. There is no tenant left to lock out, so the guard stands down —
  -- otherwise an organization with exactly one administrator could never be
  -- removed at all.
  if not exists (select 1 from public.organizations o where o.id = v_org_id) then
    return null;
  end if;

  if app.org_admin_count(v_org_id) = 0 then
    raise exception 'La organización debe conservar al menos una persona que pueda administrarla'
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

revoke all on function app.guard_last_admin() from public, anon, authenticated;

/**
 * A CONSTRAINT trigger, INITIALLY IMMEDIATE.
 *
 * `after ... for each row` on a constraint trigger fires once the *statement*
 * has finished, not between rows, so a single UPDATE that demotes one
 * administrator while promoting another is judged on its result rather than on
 * the order Postgres happened to touch the rows in. That is the only handover
 * the product performs — every mutation reaches the database as one statement
 * in one request — and it is the case an ordinary AFTER ROW trigger would
 * reject for no reason.
 *
 * Immediate rather than deferred so the refusal arrives at the statement that
 * caused it. A deferred check surfaces at COMMIT, by which point the error can
 * no longer name the write that produced it. `deferrable` is kept so an
 * exceptional bulk migration can `set constraints all deferred` deliberately.
 *
 * INSERT is not covered: adding a membership or a grant cannot remove the last
 * administrator, and watching it would abort signup, where the first
 * membership is inserted before the grants that make it an administrator.
 */
create constraint trigger memberships_keep_admin
  after update or delete on public.memberships
  deferrable initially immediate
  for each row execute function app.guard_last_admin();

/**
 * The same rule from the other direction.
 *
 * Without this, an administrator revokes `configuracion:manage` from the only
 * role that holds it, every membership stays exactly as it was, and nobody in
 * the account can reach the screen that would put it back. Deleting a role
 * cascades into this table, so role deletion is covered here too.
 */
create constraint trigger role_permissions_keep_admin
  after update or delete on public.role_permissions
  deferrable initially immediate
  for each row execute function app.guard_last_admin();

-- ─── Signup seeds the roles before anything references them ─────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name     text;
  v_company  text;
  v_sector   text;
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

  -- User metadata is client-supplied, so an unrecognised sector is dropped
  -- rather than inserted: the check constraint would abort signup entirely,
  -- and failing to create an account is a much worse outcome than starting
  -- with no sector and picking one in Configuración.
  v_sector := nullif(btrim(new.raw_user_meta_data ->> 'company_type'), '');
  if v_sector is not null and v_sector not in (
    'construccion', 'energia', 'manufactura', 'comercio', 'ecommerce',
    'servicios', 'tecnologia', 'salud', 'educacion', 'logistica',
    'alimentos', 'agro', 'inmobiliario', 'hoteleria', 'financiero',
    'mineria', 'telecomunicaciones', 'seguridad', 'medios', 'ong',
    'gobierno', 'otro'
  ) then
    v_sector := null;
  end if;

  v_slug := app.slugify(v_company);
  v_slug_try := v_slug;
  while exists (select 1 from public.organizations o where o.slug = v_slug_try) loop
    n := n + 1;
    v_slug_try := v_slug || '-' || n::text;
  end loop;

  insert into public.organizations (name, slug, industry, company_type)
  values (
    v_company,
    v_slug_try,
    nullif(btrim(new.raw_user_meta_data ->> 'industry'), ''),
    v_sector
  )
  returning id into v_org_id;

  -- Before the membership, which now references (org_id, role).
  perform app.seed_default_roles(v_org_id);

  insert into public.memberships (org_id, user_id, role)
  values (v_org_id, new.id, 'Administrador');

  perform app.seed_default_permissions(v_org_id);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ─── The repair path seeds them too ─────────────────────────────────────────
-- `app.backfill_orphan_accounts` (migration 09) is the other place an
-- organization and its first membership are created: it rescues accounts whose
-- signup trigger did not run. It has to seed roles for exactly the reason
-- signup does — the membership references (org_id, role) now — and a repair
-- function that fails on the foreign key repairs nothing.
--
-- Redefined whole rather than patched, because a function has no ALTER for its
-- body. Only the `seed_default_roles` line is new.

create or replace function app.backfill_orphan_accounts()
returns table (repaired_user_id uuid, repaired_email text, repaired_org_id uuid, repaired_action text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  u          record;
  v_name     text;
  v_company  text;
  v_slug     text;
  v_org_id   uuid;
  v_invite   public.invitations%rowtype;
  n          int;
begin
  for u in
    select au.id, au.email, au.raw_user_meta_data
    from auth.users au
    where au.email is not null
      and not exists (select 1 from public.memberships m where m.user_id = au.id)
    order by au.created_at
  loop
    v_name := coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      split_part(u.email, '@', 1)
    );

    insert into public.profiles (id, email, full_name)
    values (u.id, lower(u.email), v_name)
    on conflict (id) do nothing;

    -- An outstanding invitation still wins over creating a new organization,
    -- exactly as it does on a live signup.
    select inv.* into v_invite
    from public.invitations inv
    where inv.email = lower(u.email)
      and inv.accepted_at is null
      and inv.expires_at > now()
    order by inv.created_at desc
    limit 1;

    if found then
      insert into public.memberships (org_id, user_id, role)
      values (v_invite.org_id, u.id, v_invite.role)
      on conflict (org_id, user_id) do nothing;

      update public.invitations inv set accepted_at = now() where inv.id = v_invite.id;

      repaired_user_id := u.id;
      repaired_email := u.email;
      repaired_org_id := v_invite.org_id;
      repaired_action := 'unido por invitación';
      return next;
      continue;
    end if;

    v_company := coalesce(nullif(btrim(u.raw_user_meta_data ->> 'company'), ''), v_name);

    v_slug := app.slugify(v_company);
    n := 0;
    while exists (select 1 from public.organizations o where o.slug = v_slug) loop
      n := n + 1;
      v_slug := app.slugify(v_company) || '-' || n::text;
    end loop;

    insert into public.organizations (name, slug, industry)
    values (v_company, v_slug, nullif(btrim(u.raw_user_meta_data ->> 'industry'), ''))
    returning id into v_org_id;

    perform app.seed_default_roles(v_org_id);

    insert into public.memberships (org_id, user_id, role)
    values (v_org_id, u.id, 'Administrador');

    perform app.seed_default_permissions(v_org_id);

    repaired_user_id := u.id;
    repaired_email := u.email;
    repaired_org_id := v_org_id;
    repaired_action := 'organización creada';
    return next;
  end loop;
end;
$$;

revoke all on function app.backfill_orphan_accounts() from public, anon, authenticated;
grant execute on function app.backfill_orphan_accounts() to service_role;
