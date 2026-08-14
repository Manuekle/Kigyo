-- ═══════════════════════════════════════════════════════════════════════════
-- 28 — Creating a second company, and joining one
--
-- Migrations 26 and 27 made an account able to own several companies and made
-- the app able to work in one of them at a time. Neither gave anybody a way to
-- create the second one: the only path into `public.organizations` was the
-- signup trigger, which builds exactly one company per new user.
--
-- Three things arrive here.
--
--   1. `app.provision_company` — the four writes that make a working company,
--      extracted from `handle_new_user` so signup and "nueva empresa" cannot
--      drift into building different things.
--   2. A plan limit on how many companies an account may own, enforced by a
--      trigger rather than only by the application.
--   3. `public.join_company` — the deliberate, audited act by which somebody
--      who governs the account gains access to one of its companies' data.
--
-- ─── Why joining is an act and not an inheritance ──────────────────────────
--
-- Owning the account does not grant access to any company's data. That is the
-- decision the whole design rests on (docs/FASE_0_CONTRATOS.md §6, decision
-- M4), and it is what lets a group run a clinic and a restaurant without the
-- restaurant's manager being one query away from patient records.
--
-- But an owner does need a way *in* — to set up a company they created, or to
-- cover for someone. So joining is possible, and it is: explicit, chosen at a
-- named role rather than automatically at the highest one, and written to the
-- audit log of the company being entered. That last part is the one that
-- matters. An owner who joins quietly is indistinguishable from an owner who
-- inherited; an owner whose arrival appears in the company's own trazabilidad
-- is accountable to the people who work there.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── What a plan allows ─────────────────────────────────────────────────────
-- A table rather than a literal in the trigger, for the same reason the sector
-- list is becoming one: a pricing change should not be a schema change. Null
-- means unlimited, so the comparison has to be written to survive it.
--
-- Mirrors src/lib/plans.ts. The application checks the same numbers before the
-- database does, so the customer gets a sentence instead of a constraint
-- violation — but the database is what makes the limit true.

create table public.plan_limits (
  plan                  text primary key check (plan in ('starter', 'growth', 'enterprise')),
  max_companies         int,
  max_sites_per_company int
);

insert into public.plan_limits (plan, max_companies, max_sites_per_company) values
  ('starter',    1,    1),
  ('growth',     3,    5),
  ('enterprise', null, null);

alter table public.plan_limits enable row level security;
alter table public.plan_limits force  row level security;

-- Reference data: every signed-in user may read it, so the UI can say "tu plan
-- permite 3 empresas" without a round trip through a privileged function.
create policy plan_limits_select on public.plan_limits
  for select to authenticated using (true);

revoke insert, update, delete on public.plan_limits from authenticated;

comment on table public.plan_limits is
  'Límites por plan. Null = sin límite. Espejo de PLANS en src/lib/plans.ts; el test lo fija.';

-- ─── The limit, enforced by the database ────────────────────────────────────

create or replace function app.account_company_count(p_account_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.organizations o
  where o.account_id = p_account_id;
$$;

revoke all on function app.account_company_count(uuid) from public, anon;
grant execute on function app.account_company_count(uuid) to authenticated;

/**
 * Refuses a company that would put an account over its plan.
 *
 * Fires for every role, not just `authenticated`. `app.provision_company` is
 * SECURITY DEFINER and therefore runs as the owner, so a guard written like
 * `app.guard_plan_change` — which tests `current_user = 'authenticated'` — would
 * never fire on the one path that actually creates companies.
 *
 * Watches UPDATE as well as INSERT. Moving a company into a full account is not
 * an operation the product offers, but "no product path does it" is not a
 * constraint, and the rule is about how many companies an account ends up with
 * rather than about how they got there.
 */
create or replace function app.guard_company_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan  text;
  v_max   int;
  v_count int;
begin
  if new.account_id is null then
    return new;
  end if;

  -- An UPDATE that does not move the company between accounts changes nothing
  -- about any account's total. Checking it anyway would refuse every rename
  -- once an account is exactly at its limit.
  if tg_op = 'UPDATE' and new.account_id is not distinct from old.account_id then
    return new;
  end if;

  select a.plan into v_plan from public.accounts a where a.id = new.account_id;
  select l.max_companies into v_max from public.plan_limits l where l.plan = v_plan;

  -- Null means unlimited. So does a plan with no row: a tier added to
  -- `accounts` and forgotten here must not lock its customers out of creating
  -- anything — the failure should be a missing limit, not a dead account.
  if v_max is null then
    return new;
  end if;

  v_count := app.account_company_count(new.account_id);

  if v_count >= v_max then
    raise exception
      'El plan % permite % empresa(s) y la cuenta ya tiene %.', v_plan, v_max, v_count
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger organizations_guard_company_limit
  before insert or update of account_id on public.organizations
  for each row execute function app.guard_company_limit();

revoke all on function app.guard_company_limit() from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Provisioning a company
--
-- Four writes that only make sense together: the company, its roles, the
-- creator's membership, and the default grants. A company missing any of them
-- is broken in a way that is hard to see and easy to ship — one with no roles
-- cannot accept a member, one with no grants has an administrator who cannot
-- reach Configuración to fix it.
--
-- Extracted from `handle_new_user` so that signup and "nueva empresa" build the
-- same thing. They had no reason to differ, which is exactly how they would
-- have.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.provision_company(
  p_account_id uuid,
  p_name       text,
  p_sector     text,
  p_user_id    uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug     text;
  v_slug_try text;
  v_sector   text := nullif(btrim(p_sector), '');
  v_org_id   uuid;
  n          int := 0;
begin
  v_slug := app.slugify(p_name);
  v_slug_try := v_slug;
  while exists (select 1 from public.organizations o where o.slug = v_slug_try) loop
    n := n + 1;
    v_slug_try := v_slug || '-' || n::text;
  end loop;

  /**
   * An unrecognised sector is dropped rather than raised on.
   *
   * The sector proposes a module preset and restricts nothing, so starting
   * with none and picking one in Configuración is a mild inconvenience —
   * whereas letting the CHECK constraint fire aborts the whole provisioning
   * and leaves the customer with no company at all.
   *
   * Retrying on the constraint, rather than re-listing the twenty-two valid
   * keys here, is what keeps this correct when phase 4 moves the sector
   * vocabulary into its own table: a third copy of that list is a third place
   * to forget. The company-count limit raises `check_violation` too, so it is
   * re-raised rather than swallowed — a plan limit must not be laundered into
   * a company with no sector.
   */
  begin
    insert into public.organizations (name, slug, company_type, account_id)
    values (btrim(p_name), v_slug_try, v_sector, p_account_id)
    returning id into v_org_id;
  exception when check_violation then
    if v_sector is null or sqlerrm like '%plan%' then
      raise;
    end if;
    insert into public.organizations (name, slug, company_type, account_id)
    values (btrim(p_name), v_slug_try, null, p_account_id)
    returning id into v_org_id;
  end;

  -- Before the membership: it references (org_id, role).
  perform app.seed_default_roles(v_org_id);

  insert into public.memberships (org_id, user_id, role)
  values (v_org_id, p_user_id, 'Administrador');

  perform app.seed_default_permissions(v_org_id);

  return v_org_id;
end;
$$;

revoke all on function app.provision_company(uuid, text, text, uuid) from public, anon, authenticated;

/**
 * Creates a company in the caller's account.
 *
 * The account is derived from the caller rather than passed in. Accepting an
 * account id would mean trusting the client to name the account it is spending
 * a plan slot in, and `can_manage_account` would then be the only thing between
 * a customer and somebody else's group. Deriving it removes the parameter and
 * the class of mistake with it.
 *
 * A person governing several accounts is not a case the product creates today —
 * every signup makes exactly one — so the first is used, ordered for
 * determinism rather than left to the planner.
 */
create or replace function public.create_company(
  p_name   text,
  p_sector text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user       uuid := (select auth.uid());
  v_account_id uuid;
  v_org_id     uuid;
begin
  if v_user is null then
    raise exception 'Inicia sesión para continuar.' using errcode = 'insufficient_privilege';
  end if;

  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'La empresa necesita un nombre.' using errcode = 'check_violation';
  end if;

  select am.account_id into v_account_id
  from public.account_memberships am
  where am.user_id = v_user
    and am.role in ('owner', 'admin')
  order by am.created_at
  limit 1;

  if v_account_id is null then
    raise exception 'Solo quien administra la cuenta puede crear empresas.'
      using errcode = 'insufficient_privilege';
  end if;

  -- The sector is validated (and dropped if unknown) inside provision_company,
  -- so signup and this path behave identically. The company-count limit is
  -- enforced by the trigger on the INSERT it performs.
  v_org_id := app.provision_company(v_account_id, p_name, p_sector, v_user);

  return v_org_id;
end;
$$;

revoke all on function public.create_company(text, text) from public, anon;
grant execute on function public.create_company(text, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Joining a company you govern but did not join
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Adds the caller to one of their account's companies, and says so out loud.
 *
 * Three refusals, and they are all load-bearing:
 *
 *   · the company must belong to an account the caller governs — otherwise
 *     this is a way into any tenant in the database;
 *   · the role must be one that company actually defines — roles are per
 *     company since migration 24, and naming another company's role would
 *     fail the composite foreign key with an opaque error;
 *   · already being a member is not an error, but it must not re-stamp the
 *     audit log — an owner clicking twice should not read as two arrivals.
 *
 * The audit row is written against the company being entered, not against the
 * account. That is the whole point: it appears in *that company's*
 * trazabilidad, where the people who work there will see it.
 */
create or replace function public.join_company(
  p_org_id uuid,
  p_role   text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user       uuid := (select auth.uid());
  v_account_id uuid;
  v_email      text;
begin
  if v_user is null then
    raise exception 'Inicia sesión para continuar.' using errcode = 'insufficient_privilege';
  end if;

  select o.account_id into v_account_id
  from public.organizations o
  where o.id = p_org_id;

  -- Same refusal for "does not exist" and "not yours": distinguishing them
  -- turns this into a way to discover which company ids are real.
  if v_account_id is null or not exists (
    select 1 from public.account_memberships am
    where am.user_id    = v_user
      and am.account_id = v_account_id
      and am.role in ('owner', 'admin')
  ) then
    raise exception 'No administras la cuenta dueña de esa empresa.'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.roles r where r.org_id = p_org_id and r.key = p_role
  ) then
    raise exception 'Ese rol no existe en la empresa.' using errcode = 'check_violation';
  end if;

  -- Already inside. Returns false so the caller can say "ya perteneces" rather
  -- than reporting a join that did not happen.
  if exists (
    select 1 from public.memberships m
    where m.org_id = p_org_id and m.user_id = v_user
  ) then
    return false;
  end if;

  insert into public.memberships (org_id, user_id, role)
  values (p_org_id, v_user, p_role);

  select p.email into v_email from public.profiles p where p.id = v_user;

  -- Written by hand because `memberships` carries no audit trigger — migration
  -- 05 attaches those to business tables only. This is the one membership
  -- change that nobody in the company asked for, so it is the one that most
  -- needs to be visible there.
  insert into public.audit_log
    (org_id, actor_id, actor_email, action, table_name, record_id, record_code, changes)
  values (
    p_org_id, v_user, v_email, 'insert', 'memberships', null,
    'unirse a la empresa',
    jsonb_build_object(
      'role', p_role,
      'via', 'administración de la cuenta',
      'account_id', v_account_id
    )
  );

  return true;
end;
$$;

revoke all on function public.join_company(uuid, text) from public, anon;
grant execute on function public.join_company(uuid, text) to authenticated;

/**
 * The companies of the accounts the caller governs.
 *
 * A privileged read, and it has to be: `organizations_select` shows a person
 * only the companies they are a member of, which is correct and is what test
 * 007 pins. But it means an account owner cannot *see* the company they created
 * and then left — so the screen that would offer them "unirme" cannot list it,
 * and the account has a company nobody can find.
 *
 * What it returns is deliberately thin: a name, a sector, and whether the
 * caller is inside. No employee counts, no revenue, no data of any kind — the
 * point of decision M4 is that governing the account tells you a company
 * exists, not what is in it.
 *
 * Membership of the *account* is the gate, and every role passes it, `billing`
 * included: knowing which businesses a subscription covers is the least a
 * person paying for it should be able to ask.
 */
create or replace function public.account_companies()
returns table (
  org_id       uuid,
  name         text,
  slug         text,
  company_type text,
  account_id   uuid,
  joined       boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id,
    o.name,
    o.slug,
    o.company_type,
    o.account_id,
    exists (
      select 1 from public.memberships m
      where m.org_id = o.id and m.user_id = (select auth.uid())
    )
  from public.organizations o
  where o.account_id in (
    select am.account_id
    from public.account_memberships am
    where am.user_id = (select auth.uid())
  )
  order by o.name;
$$;

revoke all on function public.account_companies() from public, anon;
grant execute on function public.account_companies() to authenticated;

-- ─── Signup goes through the shared path ────────────────────────────────────
-- Redefined whole because a function has no ALTER for its body. The four writes
-- that built the company inline are now one call, so signup and "nueva empresa"
-- can no longer produce differently-shaped companies.

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
  v_account_id uuid;
  v_invite     public.invitations%rowtype;
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

  -- User metadata is client-supplied, so the sector may be anything at all. It
  -- is passed through raw: `app.provision_company` drops an unrecognised one
  -- rather than letting the CHECK constraint abort signup. The twenty-two valid
  -- keys used to be listed here as well as in the constraint — two copies of a
  -- vocabulary that phase 4 turns into a table, and one of them would have been
  -- forgotten.
  v_sector := nullif(btrim(new.raw_user_meta_data ->> 'company_type'), '');

  insert into public.accounts (name, onboarding_completed_at)
  values (v_company, now())
  returning id into v_account_id;

  insert into public.account_memberships (account_id, user_id, role)
  values (v_account_id, new.id, 'owner');

  perform app.provision_company(v_account_id, v_company, v_sector, new.id);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop function if exists public.account_companies();
--   drop function if exists public.join_company(uuid, text);
--   drop function if exists public.create_company(text, text);
--   drop function if exists app.provision_company(uuid, text, text, uuid);
--   drop trigger  if exists organizations_guard_company_limit on public.organizations;
--   drop function if exists app.guard_company_limit();
--   drop function if exists app.account_company_count(uuid);
--   drop table    if exists public.plan_limits;
--
-- plus restoring `public.handle_new_user` from migration 26.
-- ═══════════════════════════════════════════════════════════════════════════
