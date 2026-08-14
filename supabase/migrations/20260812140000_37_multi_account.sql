-- ═══════════════════════════════════════════════════════════════════════════
-- 37 — Una persona, varios grupos
--
-- `account_memberships` has always allowed somebody to belong to several
-- accounts — the primary key is `(account_id, user_id)`, not `user_id` — and
-- `public.account_companies()` already reads across all of them. What did not
-- exist was a way to *make* the second one: accounts are created by the signup
-- trigger and nowhere else, so «Grupo XYZ» and «Mi Startup» meant two sign-ups
-- with two email addresses.
--
-- Two things here:
--
--   1. `public.create_account`, which builds a group and its first company in
--      one transaction — the same shape signup produces, through the same
--      `app.provision_company`.
--   2. `public.create_company` learns which account to put the company in.
--
-- ─── Why (2) is not optional ───────────────────────────────────────────────
--
-- The current version picks the caller's *oldest* governed account:
--
--     order by am.created_at limit 1
--
-- which was exactly right while every person had one, and silently wrong the
-- moment they have two. Somebody standing in «Mi Startup» pressing "Nueva
-- empresa" would get a company in «Grupo XYZ» — spending that account's plan
-- slot, under that account's subscription. So the account becomes a parameter,
-- guarded by `app.can_manage_account` rather than trusted: the caller says
-- which group, the database says whether they may.
--
-- Passing null keeps the old behaviour, so nothing that calls this today has
-- to change at once.
--
-- ─── The cap, and what it is for ───────────────────────────────────────────
--
-- A new account starts on Starter, which is free and allows one company. So an
-- unlimited "create account" button is a way to run N companies without paying
-- for a tier that allows N — but only in the same sense that signing up N times
-- with N email addresses already is, which nothing prevents and nothing should.
--
-- The cap is therefore about a script, not about revenue: ten groups is far
-- past any real customer and far short of useful for abuse. It is a constant
-- here rather than a plan limit, because it does not vary by plan and putting
-- it in `plan_limits` would imply it might.
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a group and its first company.
 *
 * `SECURITY DEFINER` because `public.accounts` has no INSERT policy for
 * `authenticated` — deliberately, since a client that can insert an account can
 * insert one with a plan. The row is built here, on the caller's behalf, with
 * the plan fixed at the entry tier.
 *
 * `onboarding_completed_at` is stamped: whoever is pressing this button has
 * already been through the wizard for their first group, and sending them back
 * through it for their second would be asking a settled question again. The new
 * company's sector is asked for here instead.
 */
create or replace function public.create_account(
  p_name         text,
  p_company_name text,
  p_sector       text default null
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
  v_owned      int;
  c_max_accounts constant int := 10;
begin
  if v_user is null then
    raise exception 'Inicia sesión para continuar.' using errcode = 'insufficient_privilege';
  end if;

  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'La cuenta necesita un nombre.' using errcode = 'check_violation';
  end if;

  if p_company_name is null or length(btrim(p_company_name)) = 0 then
    raise exception 'La primera empresa necesita un nombre.' using errcode = 'check_violation';
  end if;

  select count(*) into v_owned
  from public.account_memberships am
  where am.user_id = v_user and am.role = 'owner';

  if v_owned >= c_max_accounts then
    raise exception 'Ya tienes % cuentas. Escríbenos si necesitas más.', c_max_accounts
      using errcode = 'check_violation';
  end if;

  insert into public.accounts (name, plan, onboarding_completed_at)
  values (btrim(p_name), 'starter', now())
  returning id into v_account_id;

  insert into public.account_memberships (account_id, user_id, role)
  values (v_account_id, v_user, 'owner');

  -- The same call signup makes, so a group created here and a group created by
  -- signing up cannot end up shaped differently: roles seeded, membership
  -- created, permissions granted, sector validated and dropped if unknown.
  v_org_id := app.provision_company(v_account_id, p_company_name, p_sector, v_user);

  return v_org_id;
end;
$$;

revoke all on function public.create_account(text, text, text) from public, anon;
grant execute on function public.create_account(text, text, text) to authenticated;

comment on function public.create_account(text, text, text) is
  'Crea un grupo nuevo y su primera empresa. El plan siempre nace en starter: el cliente sube de tier pagando, no creando.';

-- ─── `create_company` deja de adivinar la cuenta ────────────────────────────
--
-- Redefined whole: a function body has no ALTER. The only change is the new
-- third parameter and the branch that validates it — the rest is migration
-- 28's version verbatim, so the diff between them is the behaviour and not the
-- formatting.

create or replace function public.create_company(
  p_name       text,
  p_sector     text default null,
  p_account_id uuid default null
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

  if p_account_id is not null then
    -- Named by the caller, so the answer to "may they" comes from the database
    -- and not from the request. `can_manage_account` is owner-or-admin, which
    -- is the same standing the fallback below requires.
    if not app.can_manage_account(p_account_id) then
      raise exception 'Solo quien administra la cuenta puede crear empresas.'
        using errcode = 'insufficient_privilege';
    end if;
    v_account_id := p_account_id;
  else
    -- No account named: the caller's oldest. Kept for callers that predate the
    -- parameter; a person governing two groups should always be passing one,
    -- because "the oldest" is a coin toss dressed as a rule.
    select am.account_id into v_account_id
    from public.account_memberships am
    where am.user_id = v_user
      and am.role in ('owner', 'admin')
    order by am.created_at
    limit 1;
  end if;

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

revoke all on function public.create_company(text, text, uuid) from public, anon;
grant execute on function public.create_company(text, text, uuid) to authenticated;

-- The two-argument version from migration 28 would otherwise remain as an
-- overload, and `create_company('Hotel', 'hoteleria')` would resolve to
-- whichever Postgres preferred. One name, one signature.
drop function if exists public.create_company(text, text);

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop function if exists public.create_account(text, text, text);
--   drop function if exists public.create_company(text, text, uuid);
--   -- then restore public.create_company(text, text) from migration 28.
-- ═══════════════════════════════════════════════════════════════════════════
