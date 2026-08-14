-- ═══════════════════════════════════════════════════════════════════════════
-- 30 — Onboarding, and the things a company needs to be a company
--
-- Signing up asked for a name, an email, a password, a company name and a
-- sector, on one screen, and then dropped the customer into a dashboard. What
-- it never asked for is everything an invoice needs: a legal name, a tax id, a
-- currency. Those were invented at the point of use or left blank.
--
-- This adds them, adds per-company branding, and turns the sector question into
-- a flow that can also ask the follow-ups it implies — the subsector, and which
-- of the proposed modules the customer actually wants.
--
-- ─── Where the first company is created, and why it did not move ───────────
--
-- The plan for this phase was for `handle_new_user` to stop creating a company
-- and for the wizard to create it instead. That is the tidier story and it is
-- the wrong trade.
--
-- Signup already collects the company name, and `handle_new_user` runs inside
-- the transaction that creates the auth user — so the account, the company, its
-- roles, the first membership and the default grants either all exist or none
-- of them do. Moving company creation into a wizard step trades that guarantee
-- for a window in which a signed-in user has an account and no company: every
-- screen, every query and `getMember` itself would need a new "no company yet"
-- branch, and the repair path (`app.backfill_orphan_accounts`) would have to
-- learn to distinguish "abandoned mid-wizard" from "trigger failed".
--
-- So the trigger still builds a complete, working company. What changes is that
-- it no longer pretends the customer is finished: `onboarding_completed_at`
-- stays null, and the wizard *completes* the company it was given rather than
-- conjuring one. The customer can abandon the wizard at any step and still have
-- somewhere to land.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── What an invoice needs ──────────────────────────────────────────────────

alter table public.organizations
  -- The registered name, when it differs from the one over the door. Kept apart
  -- from `name` rather than replacing it: «Clínica Norte» belongs in the
  -- sidebar and «Servicios Médicos del Norte S.A.S.» belongs on the invoice,
  -- and a company forced to choose one will pick the wrong one for the other.
  add column legal_name text check (legal_name is null or length(btrim(legal_name)) between 2 and 200),
  add column tax_id     text check (tax_id is null or length(btrim(tax_id)) between 3 and 40),
  -- ISO-3166 alpha-2 and ISO-4217. Defaulted to Colombia because that is where
  -- the product is sold today, and a default that is right for most customers
  -- beats a null that every screen has to handle.
  add column country    text not null default 'CO' check (country ~ '^[A-Z]{2}$'),
  add column currency   text not null default 'COP' check (currency ~ '^[A-Z]{3}$'),
  add column timezone   text not null default 'America/Bogota',
  /**
   * Branding, as a small JSON document.
   *
   * A column each would be five migrations over the next year — logo, accent,
   * then a secondary accent, then a favicon. None of it is queried, filtered or
   * joined; it is read whole, by one layout, to paint a header. That is exactly
   * the shape JSON is for, and exactly the shape a column is not.
   *
   * The keys are validated below rather than left free: a blob nobody checks
   * becomes a blob nobody can change safely.
   */
  add column branding   jsonb not null default '{}'::jsonb;

comment on column public.organizations.legal_name is
  'Razón social, si difiere del nombre comercial. Va en documentos, no en la barra lateral.';
comment on column public.organizations.branding is
  'Marca de la empresa: logo_url, accent. Validado por app.valid_branding.';

/**
 * Branding accepts only the keys the product renders.
 *
 * Without this the column is a place to put anything, and the first time
 * somebody needs a real field they will find four spellings of it already in
 * production. The colour is checked as a hex triple because it is interpolated
 * straight into a CSS custom property — an unvalidated value there is a style
 * injection, not a cosmetic problem.
 */
create or replace function app.valid_branding(p_branding jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_branding is null or (
    jsonb_typeof(p_branding) = 'object'
    and not exists (
      select 1 from jsonb_object_keys(p_branding) as k
      where k not in ('logo_url', 'accent')
    )
    and (
      p_branding -> 'accent' is null
      or (p_branding ->> 'accent') ~ '^#[0-9a-fA-F]{6}$'
    )
    and (
      p_branding -> 'logo_url' is null
      or (
        -- Shape and length are separate tests on purpose: Postgres caps a regex
        -- repetition count at 255, so `{1,500}` is not a long bound — it is an
        -- invalid expression, and the function raises rather than refusing.
        (p_branding ->> 'logo_url') ~ '^https://\S+$'
        and length(p_branding ->> 'logo_url') <= 500
      )
    )
  );
$$;

alter table public.organizations
  add constraint organizations_branding_valid check (app.valid_branding(branding));

-- ─── Onboarding state ───────────────────────────────────────────────────────
-- `accounts.onboarding_completed_at` already exists (migration 26), where it
-- was stamped `now()` for everyone because there was no wizard to leave it
-- null. From here a fresh signup leaves it null and the wizard sets it.

/**
 * Marks the account's onboarding finished.
 *
 * A function rather than a direct UPDATE because `accounts_update` is
 * owner-only and grants only the `name` column — deliberately, so that a
 * customer cannot write their own plan. Widening that grant to include a
 * timestamp would reopen the column question for no reason.
 *
 * Idempotent: finishing twice keeps the first time. The wizard's last step can
 * be retried after a network error without rewriting when the customer
 * actually arrived.
 */
create or replace function public.complete_onboarding()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := (select auth.uid());
  v_account uuid;
begin
  if v_user is null then
    raise exception 'Inicia sesión para continuar.' using errcode = 'insufficient_privilege';
  end if;

  select am.account_id into v_account
  from public.account_memberships am
  where am.user_id = v_user and am.role = 'owner'
  order by am.created_at
  limit 1;

  if v_account is null then
    raise exception 'Solo quien creó la cuenta puede terminar la configuración.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.accounts
     set onboarding_completed_at = now()
   where id = v_account
     and onboarding_completed_at is null;

  return true;
end;
$$;

revoke all on function public.complete_onboarding() from public, anon;
grant execute on function public.complete_onboarding() to authenticated;

-- ─── Signup leaves the wizard something to do ───────────────────────────────
-- Redefined whole because a function has no ALTER for its body. The only change
-- is that `onboarding_completed_at` is no longer stamped: the company is still
-- built here, complete and usable, so an abandoned wizard leaves a working
-- account rather than a half-created one.

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
  -- governing it is not something an invitation grants. They see no wizard:
  -- the account they joined was configured by whoever owns it.
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

  -- Client-supplied, so it may be anything. `app.provision_company` drops an
  -- unrecognised sector rather than letting the foreign key abort signup.
  v_sector := nullif(btrim(new.raw_user_meta_data ->> 'company_type'), '');

  -- `onboarding_completed_at` deliberately left null: there is a wizard now,
  -- and this account has not been through it.
  insert into public.accounts (name)
  values (v_company)
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
--   drop function if exists public.complete_onboarding();
--   alter table public.organizations drop constraint organizations_branding_valid;
--   drop function if exists app.valid_branding(jsonb);
--   alter table public.organizations
--     drop column branding, drop column timezone, drop column currency,
--     drop column country,  drop column tax_id,   drop column legal_name;
--
-- plus restoring `public.handle_new_user` from migration 29's shape (which
-- stamped onboarding_completed_at).
-- ═══════════════════════════════════════════════════════════════════════════
