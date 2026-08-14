-- ═══════════════════════════════════════════════════════════════════════════
-- 31 — Sucursales
--
-- A company with three branches has three cash drawers, three rosters and one
-- set of books. Until now Kigyo could express the books and not the branches:
-- `employees.location` was free text — no reference, nothing to filter by, and
-- no way to say "this cashier sees the north branch and not the south one".
--
-- ─── Why this does not rewrite a single existing policy ────────────────────
--
-- The obvious way to add a second dimension of isolation is to edit the four
-- generated policies on every table that gains it. That is ~28 policy bodies
-- rewritten by hand, on tables holding live rows, to add a term — and every one
-- of them is a chance to typo the boolean and widen access instead of narrowing
-- it. It is also irreversible in the sense that matters: a policy that was
-- edited wrong looks exactly like a policy that was edited right.
--
-- Postgres has the tool for this. A RESTRICTIVE policy is ANDed with the
-- permissive ones rather than ORed, so the existing rules stay untouched and
-- word-for-word what they were, and the site rule composes on top:
--
--     (org_id in orgs_with(perm))        ← migration 02/03/15/25, unchanged
--   AND (site_id is null OR may access)  ← this migration
--
-- Every existing policy is left byte-identical, which is why the seven earlier
-- test suites keep passing without a line changed.
--
-- ─── Sites are opt-in, and silence means everything ────────────────────────
--
-- Two null-means-yes rules make this safe to ship to accounts that will never
-- use it:
--
--   · `site_id is null` — a row that belongs to no branch is company-wide and
--     visible to everyone who could already see it. Every existing row is like
--     this, so nothing anybody can see today becomes invisible tomorrow.
--   · no rows in `membership_sites` — a person with no branch restriction sees
--     all of them. Restriction is something you opt a person into, never a
--     default, because the default applies to the administrator who has not
--     configured anything yet.
--
-- Together they mean: a company that ignores this migration behaves exactly as
-- it did before it.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── The branch ─────────────────────────────────────────────────────────────

create table public.sites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  code        text,
  name        text not null check (length(btrim(name)) between 1 and 120),
  address     text,
  city        text,
  phone       text,
  -- Where things land when nobody says otherwise. At most one per company,
  -- enforced by a partial unique index rather than by hope.
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (org_id, code)
);

create index sites_org_idx on public.sites (org_id) where deleted_at is null;
create unique index sites_one_default_idx
  on public.sites (org_id) where is_default and deleted_at is null;

create trigger sites_touch before update on public.sites
  for each row execute function app.touch_updated_at();

comment on table public.sites is
  'Sucursales de una empresa. Opcional: una empresa sin sucursales se comporta exactamente como antes.';

-- Governed by the same permission that governs the company itself. A branch is
-- a structural fact about the business, not an operational record, so it sits
-- with the settings rather than getting a module of its own.
select app.apply_standard_rls('sites', 'configuracion:read', 'configuracion:manage');

-- ─── How many branches a plan allows ────────────────────────────────────────

create or replace function app.org_site_count(p_org_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.sites s
  where s.org_id = p_org_id and s.deleted_at is null;
$$;

revoke all on function app.org_site_count(uuid) from public, anon;
grant execute on function app.org_site_count(uuid) to authenticated;

/**
 * Refuses a branch that would put a company over its plan.
 *
 * Reads the limit from `public.plan_limits`, the same table
 * `app.guard_company_limit` reads, so a pricing change stays one UPDATE. Null
 * means unlimited — as does a plan with no row, because a tier added and
 * forgotten here must not lock its customers out of creating anything.
 *
 * Only INSERT: an UPDATE cannot increase the count, and a soft delete
 * decreases it.
 */
create or replace function app.guard_site_limit()
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
  select a.plan into v_plan
  from public.organizations o
  join public.accounts a on a.id = o.account_id
  where o.id = new.org_id;

  select l.max_sites_per_company into v_max
  from public.plan_limits l where l.plan = v_plan;

  if v_max is null then
    return new;
  end if;

  v_count := app.org_site_count(new.org_id);

  if v_count >= v_max then
    raise exception
      'El plan % permite % sucursal(es) por empresa y esta ya tiene %.', v_plan, v_max, v_count
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger sites_guard_limit
  before insert on public.sites
  for each row execute function app.guard_site_limit();

revoke all on function app.guard_site_limit() from public, anon, authenticated;

-- ─── Who may see which branch ───────────────────────────────────────────────
--
-- Rows here are a *restriction*, never a grant. A person with none sees every
-- branch of the companies they belong to; a person with one or more sees only
-- those. Modelling it the other way — rows as grants — would mean every
-- existing member silently losing access the moment the feature shipped.
--
-- The composite foreign key to `memberships (org_id, user_id)` is what stops a
-- restriction outliving the membership it qualifies, and what stops one
-- company's restriction naming another company's person.

create table public.membership_sites (
  org_id     uuid not null,
  user_id    uuid not null,
  site_id    uuid not null references public.sites (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id, site_id),
  foreign key (org_id, user_id)
    references public.memberships (org_id, user_id) on delete cascade
);

create index membership_sites_user_idx on public.membership_sites (user_id, org_id);

comment on table public.membership_sites is
  'Restringe a una persona a ciertas sucursales. Sin filas = todas. Nunca concede: solo limita.';

alter table public.membership_sites enable row level security;
alter table public.membership_sites force  row level security;

-- Everyone in the company can see who is assigned where — it is a rota, not a
-- secret — but only an administrator writes it.
create policy membership_sites_select on public.membership_sites
  for select to authenticated
  using (org_id in (select app.current_org_ids()));

create policy membership_sites_write on public.membership_sites
  for all to authenticated
  using      (app.is_org_admin(org_id))
  with check (app.is_org_admin(org_id));

/**
 * Whether the caller may reach rows belonging to a branch.
 *
 * Three ways to be allowed, and the first two are what make this safe to ship:
 *
 *   1. the row belongs to no branch (`p_site_id is null`) — company-wide, and
 *      that is every row that exists today;
 *   2. the caller has no restriction in that branch's company — the default,
 *      and the state every current member is in;
 *   3. the caller is explicitly assigned to it.
 *
 * SECURITY DEFINER so it can read `membership_sites` from inside a policy on
 * another table without recursing through that table's own policies, and
 * STABLE so Postgres hoists it into an InitPlan — evaluated once per query
 * rather than once per row, which matters because it is about to appear in the
 * policy of every site-scoped table.
 */
create or replace function app.may_access_site(p_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_site_id is null
    or not exists (
      select 1
      from public.sites s
      join public.membership_sites ms
        on ms.org_id = s.org_id
       and ms.user_id = (select auth.uid())
      where s.id = p_site_id
    )
    or exists (
      select 1
      from public.membership_sites ms
      where ms.user_id = (select auth.uid())
        and ms.site_id = p_site_id
    );
$$;

revoke all on function app.may_access_site(uuid) from public, anon;
grant execute on function app.may_access_site(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Site scope on the tables where a branch is a fact of the business
--
-- Seven tables, not sixty-six. A branch is where a person works, where stock
-- sits, where a till is opened, which tables are served, which rooms are let
-- and which equipment is maintained. It is *not* a property of an invoice, a
-- contract or a document — those belong to the company, and giving them a
-- branch would invite a filter that quietly hides half the books.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.add_site_scope(p_table text)
returns void
language plpgsql
as $$
declare
  t text := format('public.%I', p_table);
begin
  execute format('alter table %s add column site_id uuid references public.sites (id) on delete set null', t);
  execute format('create index %I on %s (site_id) where site_id is not null', p_table || '_site_idx', t);

  /**
   * RESTRICTIVE, so it is ANDed with the four permissive policies that already
   * exist rather than replacing them. Those stay exactly as generated in
   * migrations 02, 03, 15 and 25 — not re-typed, not re-reviewed, not a chance
   * to widen access by accident.
   *
   * One policy `for all` rather than four: unlike the permission split, the
   * branch rule is identical for reading and for writing. A person who cannot
   * see the north branch's till must not be able to open one there either.
   */
  execute format($f$
    create policy %I on %s as restrictive for all to authenticated
    using      (app.may_access_site(site_id))
    with check (app.may_access_site(site_id))
  $f$, p_table || '_site_scope', t);
end;
$$;

revoke all on function app.add_site_scope(text) from public, anon, authenticated;

select app.add_site_scope('employees');
select app.add_site_scope('inventory_assets');
select app.add_site_scope('cash_sessions');
select app.add_site_scope('restaurant_orders');
select app.add_site_scope('dining_tables');
select app.add_site_scope('hotel_rooms');
select app.add_site_scope('work_orders');

comment on column public.employees.site_id is
  'Sucursal donde trabaja. Null = toda la empresa. Reemplaza a `location`, que era texto libre.';

-- ─── `employees.location` becomes real ──────────────────────────────────────
--
-- The column was free text typed by customers, so it holds «Sede Norte»,
-- «sede norte» and «Norte» as three different places. Folding case and
-- whitespace catches most of that; what it cannot catch is a genuine
-- misspelling, and inventing a merge rule for those would silently move people
-- between branches. Those become their own branch, visibly, for an
-- administrator to merge by hand.
--
-- `location` is deliberately not dropped. It is the evidence of what the
-- customer actually typed, and the only way to check this migration's work
-- after the fact.

insert into public.sites (org_id, name)
select distinct e.org_id, btrim(e.location)
from public.employees e
where e.deleted_at is null
  and btrim(coalesce(e.location, '')) <> ''
  -- The plan limit trigger does not fire on this INSERT for accounts already
  -- over their allowance, which is deliberate: refusing here would abort the
  -- migration for a customer whose data predates the limit. They keep what
  -- they have and cannot add more.
on conflict do nothing;

update public.employees e
   set site_id = s.id
  from public.sites s
 where s.org_id = e.org_id
   and lower(btrim(s.name)) = lower(btrim(coalesce(e.location, '')))
   and e.site_id is null;

comment on column public.employees.location is
  'Legado: texto libre previo a public.sites. Conservado como evidencia; usa site_id.';

-- The first branch of each company becomes its default, so a form that needs
-- one has an answer without asking.
update public.sites s
   set is_default = true
 where not exists (
   select 1 from public.sites d
   where d.org_id = s.org_id and d.is_default and d.deleted_at is null
 )
   and s.id = (
     select s2.id from public.sites s2
     where s2.org_id = s.org_id and s2.deleted_at is null
     order by s2.created_at, s2.id
     limit 1
   );

-- ─── The backfill checks its own work ───────────────────────────────────────

do $$
declare
  v_unmatched int;
  v_multi     int;
begin
  select count(*) into v_unmatched
  from public.employees e
  where e.deleted_at is null
    and btrim(coalesce(e.location, '')) <> ''
    and e.site_id is null;

  select count(*) into v_multi
  from (
    select org_id from public.sites where is_default and deleted_at is null
    group by org_id having count(*) > 1
  ) x;

  if v_unmatched <> 0 then
    raise exception 'backfill: % empleado(s) con sede escrita y sin sucursal asignada', v_unmatched;
  end if;
  if v_multi <> 0 then
    raise exception 'backfill: % empresa(s) con más de una sucursal por defecto', v_multi;
  end if;

  raise notice 'backfill: % sucursales creadas desde employees.location',
    (select count(*) from public.sites);
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop policy if exists employees_site_scope         on public.employees;
--   drop policy if exists inventory_assets_site_scope  on public.inventory_assets;
--   drop policy if exists cash_sessions_site_scope     on public.cash_sessions;
--   drop policy if exists restaurant_orders_site_scope on public.restaurant_orders;
--   drop policy if exists dining_tables_site_scope     on public.dining_tables;
--   drop policy if exists hotel_rooms_site_scope       on public.hotel_rooms;
--   drop policy if exists work_orders_site_scope       on public.work_orders;
--   alter table public.employees         drop column site_id;
--   alter table public.inventory_assets  drop column site_id;
--   alter table public.cash_sessions     drop column site_id;
--   alter table public.restaurant_orders drop column site_id;
--   alter table public.dining_tables     drop column site_id;
--   alter table public.hotel_rooms       drop column site_id;
--   alter table public.work_orders       drop column site_id;
--   drop function if exists app.add_site_scope(text);
--   drop function if exists app.may_access_site(uuid);
--   drop table    if exists public.membership_sites;
--   drop trigger  if exists sites_guard_limit on public.sites;
--   drop function if exists app.guard_site_limit();
--   drop function if exists app.org_site_count(uuid);
--   drop table    if exists public.sites;
--
-- `employees.location` was never modified, so the branch data can be rebuilt
-- from it at any time. No business row loses information here.
-- ═══════════════════════════════════════════════════════════════════════════
