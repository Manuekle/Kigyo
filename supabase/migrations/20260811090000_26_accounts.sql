-- ═══════════════════════════════════════════════════════════════════════════
-- 26 — The commercial account, above the company
--
-- Kigyo is sold to a customer who may run more than one business: a group with
-- a clinic and a restaurant, a holding with three construction firms. Until now
-- `public.organizations` was all three things at once — the account that pays,
-- the company that operates, and the tenant that isolates data — so a second
-- company meant a second subscription and a second login.
--
-- ─── Which way the hierarchy grows ─────────────────────────────────────────
--
-- The obvious move is to insert a `companies` table *below* organizations and
-- carry a `company_id` down into the business tables. That is the wrong
-- direction here, and expensively so: 66 tables carry `org_id`, roughly 264
-- policies are generated from it, and ~787 query call sites filter on it. Every
-- one of those is a chance to leave a table isolated by the old key while it
-- already holds two companies' rows — which is a leak between a customer's own
-- businesses, the exact failure the change is meant to prevent.
--
-- So the account is added *above* instead. `public.organizations` already was
-- the operating company: it holds the sector, the enabled modules, the storage
-- prefix, the correlatives and the audit trail. What it did not have was an
-- owner. It has one now.
--
--   Account   public.accounts        — plan, billing, limits
--     └─ Company  public.organizations — sector, modules, data, RLS boundary
--          └─ Site public.sites        — branch (a later migration)
--
-- Nothing below this line touches a business table, a business policy, or
-- `app.orgs_with`. Isolation between two companies of the same account is the
-- isolation between two organizations that already exists and is already
-- covered by supabase/tests/rls/001_tenant_isolation.sql.
--
-- `org_id` therefore means *company id* from here on. See AGENTS.md.
--
-- ─── What the account scope deliberately does NOT do ───────────────────────
--
-- Owning the account is not a way into a company's data. `account_memberships`
-- decides who pays, who may create a company and who may invite; reading or
-- writing a company's rows still requires a row in `public.memberships`. No
-- policy in this file is referenced by any business table, and none ever
-- should be. supabase/tests/rls/005_account_isolation.sql is what holds that
-- line: it asserts that the owner of an account with two companies sees zero
-- rows in the one they did not join.
--
-- Rollback is three statements, listed at the end of this file. This migration
-- adds tables and one nullable-then-backfilled column; it modifies no business
-- row and destroys nothing.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── The account ────────────────────────────────────────────────────────────

create table public.accounts (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null check (length(btrim(name)) between 1 and 120),
  plan                    text not null default 'starter'
                            check (plan in ('starter', 'growth', 'enterprise')),
  -- Null until a payment provider exists. Never readable by `authenticated`:
  -- the column grants below withhold them, so even `select *` is refused.
  billing_customer_id     text,
  billing_subscription_id text,
  billing_status          text,
  -- Null means the onboarding wizard has not finished. There is no wizard yet,
  -- so everything created here is stamped as complete — the flag is written now
  -- so the wizard can be added later without a second backfill.
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger accounts_touch before update on public.accounts
  for each row execute function app.touch_updated_at();

comment on table public.accounts is
  'Cuenta comercial: plan, facturación y límites. Las empresas son public.organizations.';
comment on column public.accounts.plan is
  'Nivel de suscripción del grupo entero. Solo lo escribe service_role (app.guard_account_plan_change).';

-- ─── Who governs the account ────────────────────────────────────────────────
--
-- Three fixed roles, and deliberately no permission matrix. The account scope
-- answers three questions — who pays, who may create a company, who may govern
-- the group — and a matrix for three questions is complexity without a
-- customer asking for it. The rich, per-company matrix already exists in
-- `role_permissions` and is where every question about *data* is answered.
--
--   owner   — everything, including creating and deleting companies
--   admin   — create companies and invite; may not touch the plan
--   billing — plan and invoices only

create table public.account_memberships (
  account_id  uuid not null references public.accounts (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null check (role in ('owner', 'billing', 'admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (account_id, user_id)
);

create index account_memberships_user_idx on public.account_memberships (user_id);

create trigger account_memberships_touch before update on public.account_memberships
  for each row execute function app.touch_updated_at();

comment on table public.account_memberships is
  'Gobierno de la cuenta. NO concede acceso a los datos de ninguna empresa: eso requiere public.memberships.';

-- ─── The company points at its account ──────────────────────────────────────
-- Nullable for now; the backfill below fills every row and then makes it NOT
-- NULL in the same transaction, so the column is never nullable in a database
-- anyone can reach.

alter table public.organizations
  add column account_id uuid references public.accounts (id) on delete cascade;

create index organizations_account_idx on public.organizations (account_id);

comment on table public.organizations is
  'La EMPRESA operativa (Company): sector, módulos, datos y frontera de aislamiento. Su cuenta comercial es public.accounts.';
comment on column public.organizations.account_id is
  'Cuenta comercial dueña de esta empresa. Varias empresas pueden compartir cuenta.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Authorization primitives
--
-- Same shape as `app.orgs_with`: SECURITY DEFINER so they can read the
-- membership tables without tripping the policies on those tables, and STABLE
-- so Postgres hoists them into an InitPlan — evaluated once per query rather
-- than once per row.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.current_account_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select am.account_id
  from public.account_memberships am
  where am.user_id = (select auth.uid());
$$;

/**
 * The accounts sitting above the companies this user belongs to.
 *
 * Separate from `current_account_ids` because they answer different questions.
 * A plain Empleado governs no account, but the product gates their sidebar on
 * `plan`, so they have to be able to read that one column of the account above
 * their company. The column grants are what stop that from also revealing the
 * group's billing.
 */
create or replace function app.accounts_of_my_orgs()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct o.account_id
  from public.organizations o
  join public.memberships m on m.org_id = o.id
  where m.user_id = (select auth.uid())
    and o.account_id is not null;
$$;

create or replace function app.is_account_owner(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.account_memberships am
    where am.user_id    = (select auth.uid())
      and am.account_id = p_account_id
      and am.role       = 'owner'
  );
$$;

/** Create companies and invite. Owner and admin; billing is not a governor. */
create or replace function app.can_manage_account(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.account_memberships am
    where am.user_id    = (select auth.uid())
      and am.account_id = p_account_id
      and am.role in ('owner', 'admin')
  );
$$;

revoke all on function
  app.current_account_ids(), app.accounts_of_my_orgs(),
  app.is_account_owner(uuid), app.can_manage_account(uuid)
  from public, anon;

grant execute on function
  app.current_account_ids(), app.accounts_of_my_orgs(),
  app.is_account_owner(uuid), app.can_manage_account(uuid)
  to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.accounts            enable row level security;
alter table public.accounts            force  row level security;
alter table public.account_memberships enable row level security;
alter table public.account_memberships force  row level security;

-- Readable by whoever governs the account, and by any member of any company
-- underneath it. The second clause is what lets `getMember` resolve the plan in
-- the same round trip it already makes; the column grants keep it to the plan.
create policy accounts_select on public.accounts
  for select to authenticated
  using (
    id in (select app.current_account_ids())
    or id in (select app.accounts_of_my_orgs())
  );

-- Renaming is an owner's job. Changing the plan is not an update anyone at this
-- privilege level performs: `plan` was never granted to `authenticated`, and
-- the trigger below refuses it a second time.
create policy accounts_update on public.accounts
  for update to authenticated
  using      (app.is_account_owner(id))
  with check (app.is_account_owner(id));

-- No INSERT and no DELETE policy for `authenticated`, on purpose. Accounts are
-- created by the signup trigger, which is SECURITY DEFINER, and removed by
-- support. A customer who can insert an account can insert a plan.

create policy account_memberships_select on public.account_memberships
  for select to authenticated
  using (account_id in (select app.current_account_ids()));

create policy account_memberships_write on public.account_memberships
  for all to authenticated
  using      (app.is_account_owner(account_id))
  with check (app.is_account_owner(account_id));

-- ═══════════════════════════════════════════════════════════════════════════
-- Privileges
--
-- Migration 08 grants DML on every table in `public` to `authenticated` and
-- sets `alter default privileges` to keep doing it, so `accounts` was born with
-- its billing columns readable by every employee of every company in the group.
--
-- A column cannot be subtracted from a table-wide grant — Postgres warns and
-- does nothing, which is why migration 14 had to guard the plan with a trigger
-- instead. The working form is to revoke the table and grant the columns.
-- ═══════════════════════════════════════════════════════════════════════════

revoke all on public.accounts from authenticated;

grant select (id, name, plan, onboarding_completed_at)
  on public.accounts to authenticated;
grant update (name)
  on public.accounts to authenticated;

-- Consequence, which the application has to respect: `select *` on this table
-- is refused for `authenticated`, because * expands to columns that were never
-- granted. Every read must name its columns. Pinned by test 005 so that a
-- future "fix" widening the grant fails loudly instead of quietly exposing
-- billing.

grant select, insert, update, delete on public.account_memberships to authenticated;

-- ─── The plan is bought, not set ────────────────────────────────────────────
-- Belt and braces: the column grant above already stops `authenticated` from
-- naming `plan` in an UPDATE. This trigger is what keeps the rule true if a
-- later migration re-grants the table without thinking.

create or replace function app.guard_account_plan_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.plan is distinct from old.plan and current_user = 'authenticated' then
    raise exception 'El plan de la cuenta solo puede cambiarlo el proceso de facturación'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger accounts_guard_plan
  before update on public.accounts
  for each row execute function app.guard_account_plan_change();

revoke all on function app.guard_account_plan_change() from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Backfill — one account per existing company, 1:1
--
-- Every organization that exists today was sold as its own subscription, so it
-- becomes its own account, carrying its own plan across unchanged. Nobody is
-- grouped with anybody: grouping is a decision the customer makes later, and
-- inferring it here from a shared name or a shared administrator would be a
-- guess with a data-visibility consequence.
--
-- Row by row rather than one set-based INSERT..SELECT: the accounts and the
-- organizations have to be paired exactly, and pairing them afterwards by name
-- is wrong the moment two organizations share one.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  o          record;
  v_account  uuid;
begin
  for o in select id, name, plan from public.organizations where account_id is null loop
    insert into public.accounts (name, plan, onboarding_completed_at)
    values (o.name, o.plan, now())
    returning id into v_account;

    update public.organizations set account_id = v_account where id = o.id;

    -- The owner is whoever already administers the company: the people holding
    -- `configuracion:manage`, which is exactly what `app.is_org_admin` measures.
    -- All of them, not one — an account whose sole owner has left the company
    -- is an account nobody can pay for.
    insert into public.account_memberships (account_id, user_id, role)
    select v_account, m.user_id, 'owner'
    from public.memberships m
    join public.role_permissions rp
      on rp.org_id = m.org_id
     and rp.role   = m.role
    where m.org_id     = o.id
      and rp.permission = 'configuracion:manage'
    on conflict (account_id, user_id) do nothing;
  end loop;
end;
$$;

alter table public.organizations alter column account_id set not null;

-- ─── The backfill checks its own work ───────────────────────────────────────
-- Inside the same transaction, so a migration that half-worked leaves nothing
-- behind instead of a database that looks migrated and is not.

do $$
declare
  v_orphan_orgs   int;
  v_accounts      int;
  v_orgs          int;
  v_ownerless     int;
  v_plan_mismatch int;
begin
  select count(*) into v_orphan_orgs from public.organizations where account_id is null;
  select count(*) into v_accounts    from public.accounts;
  select count(*) into v_orgs        from public.organizations;

  select count(*) into v_ownerless
  from public.accounts a
  where not exists (
    select 1 from public.account_memberships am
    where am.account_id = a.id and am.role = 'owner'
  );

  select count(*) into v_plan_mismatch
  from public.accounts a
  join public.organizations o on o.account_id = a.id
  where a.plan is distinct from o.plan;

  if v_orphan_orgs <> 0 then
    raise exception 'backfill: % empresa(s) sin cuenta', v_orphan_orgs;
  end if;
  if v_accounts <> v_orgs then
    raise exception 'backfill: % cuentas para % empresas (debe ser 1:1)', v_accounts, v_orgs;
  end if;
  -- An organization with no administrator at all cannot happen — two constraint
  -- triggers from migration 24 prevent it — so an ownerless account means the
  -- pairing above went wrong, not that the data was odd.
  if v_ownerless <> 0 then
    raise exception 'backfill: % cuenta(s) sin owner', v_ownerless;
  end if;
  if v_plan_mismatch <> 0 then
    raise exception 'backfill: % empresa(s) con plan distinto al de su cuenta', v_plan_mismatch;
  end if;

  raise notice 'backfill: % cuentas creadas, 1:1 con las empresas', v_accounts;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Signup creates the account before the company
--
-- Redefined whole because a function has no ALTER for its body. Only the
-- account block is new; everything else is migration 24's version verbatim.
--
-- `organizations.plan` is still written, and still carries the same value as
-- the account. It is the fallback half of the dual-read in
-- src/lib/auth/session.ts and is dropped once that fallback is removed.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name       text;
  v_company    text;
  v_sector     text;
  v_slug       text;
  v_slug_try   text;
  v_account_id uuid;
  v_org_id     uuid;
  v_invite     public.invitations%rowtype;
  n            int := 0;
begin
  v_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, email, full_name)
  values (new.id, lower(new.email), v_name)
  on conflict (id) do nothing;

  -- Invited user: join the existing company, never create one — and never
  -- create an account either. They are joining somebody else's group, and
  -- governing it is not something an invitation grants.
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

  -- The account first: the company references it. `onboarding_completed_at` is
  -- stamped because signup is still the whole of onboarding — the wizard that
  -- will leave it null does not exist yet, and a null here would send every new
  -- customer to a screen that has not been built.
  insert into public.accounts (name, onboarding_completed_at)
  values (v_company, now())
  returning id into v_account_id;

  insert into public.account_memberships (account_id, user_id, role)
  values (v_account_id, new.id, 'owner');

  insert into public.organizations (name, slug, industry, company_type, account_id)
  values (
    v_company,
    v_slug_try,
    nullif(btrim(new.raw_user_meta_data ->> 'industry'), ''),
    v_sector,
    v_account_id
  )
  returning id into v_org_id;

  -- Before the membership, which references (org_id, role).
  perform app.seed_default_roles(v_org_id);

  insert into public.memberships (org_id, user_id, role)
  values (v_org_id, new.id, 'Administrador');

  perform app.seed_default_permissions(v_org_id);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ─── The repair path creates one too ────────────────────────────────────────
-- `app.backfill_orphan_accounts` rescues users whose signup trigger did not
-- run. It has to build the same shape signup does, or it repairs an account
-- into a state the NOT NULL on `organizations.account_id` rejects.
--
-- Redefined whole for the same reason as above. Only the account block is new.

create or replace function app.backfill_orphan_accounts()
returns table (repaired_user_id uuid, repaired_email text, repaired_org_id uuid, repaired_action text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  u            record;
  v_name       text;
  v_company    text;
  v_slug       text;
  v_account_id uuid;
  v_org_id     uuid;
  v_invite     public.invitations%rowtype;
  n            int;
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

    -- An outstanding invitation still wins over creating a company, exactly as
    -- it does on a live signup.
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

    insert into public.accounts (name, onboarding_completed_at)
    values (v_company, now())
    returning id into v_account_id;

    insert into public.account_memberships (account_id, user_id, role)
    values (v_account_id, u.id, 'owner');

    insert into public.organizations (name, slug, industry, account_id)
    values (
      v_company,
      v_slug,
      nullif(btrim(u.raw_user_meta_data ->> 'industry'), ''),
      v_account_id
    )
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

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop trigger  if exists accounts_guard_plan on public.accounts;
--   drop function if exists app.guard_account_plan_change();
--   drop function if exists app.can_manage_account(uuid);
--   drop function if exists app.is_account_owner(uuid);
--   drop function if exists app.accounts_of_my_orgs();
--   drop function if exists app.current_account_ids();
--   alter table public.organizations drop column account_id;
--   drop table public.account_memberships;
--   drop table public.accounts;
--
-- plus restoring `public.handle_new_user` and `app.backfill_orphan_accounts`
-- from migration 24. No business row is modified by this migration, so there is
-- nothing else to undo.
-- ═══════════════════════════════════════════════════════════════════════════
