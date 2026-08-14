-- ═══════════════════════════════════════════════════════════════════════════
-- 32 — Billing is real: suspension instead of deletion, and the plan's
--      last copy is dropped
--
-- The subscription moved to `public.accounts` in migration 26. What was left
-- of the old world was the fallback half of the dual-read —
-- `organizations.plan` — and nothing that happens when a customer stops
-- paying. A downgrade or a cancelled payment must not delete anything: the
-- data belongs to the customer, the suspension is a payment state, and the
-- two must be able to disagree.
--
-- ─── 1. `status`, the payment state ───────────────────────────────────────
--
-- `active` is the only value a customer-visible column has ever had.
-- `suspended` is written by the billing seam (scripts/set-plan.mjs today, a
-- payment webhook tomorrow) when a company exceeds what the account's plan
-- allows, or when the account stops paying. A suspended company stays fully
-- visible and fully readable; writes are refused in the application layer
-- (src/lib/auth/session.ts, `requirePermission`), which is the one place
-- every mutation already passes through.
--
-- The column is deliberately NOT part of the RLS update policy: the trigger
-- below makes `authenticated` unable to change it even where the admin
-- update policy applies. Only the billing process may move a company in or
-- out of suspension.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.organizations
  add column status text not null default 'active'
  check (status in ('active', 'suspended'));

comment on column public.organizations.status is
  'Estado de facturación. suspended = visible y de solo lectura; solo lo escribe el proceso de facturación (app.guard_company_status_change).';

create or replace function app.guard_company_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and current_user = 'authenticated' then
    raise exception 'El estado de una empresa solo lo cambia el proceso de facturación'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger organizations_guard_status
  before update of status on public.organizations
  for each row execute function app.guard_company_status_change();

revoke all on function app.guard_company_status_change() from public, anon, authenticated;

-- ─── 2. The plan's last copy ────────────────────────────────────────────────
--
-- Migration 26 kept `organizations.plan` as the fallback half of a dual-read
-- so a session could still resolve modules when the account embed was
-- filtered by RLS. That embed is now covered by a column grant that members
-- of any company under the account can read (migration 26), and the fallback
-- in src/lib/auth/session.ts no longer needs a second copy to fall back to —
-- it falls back to the most generous plan instead, which is the same answer
-- `planFor()` gives for an unknown key. The column goes; the value was
-- already being mirrored by `accounts.plan` for every account created since
-- migration 26, and `scripts/set-plan.mjs` no longer writes it.

alter table public.organizations drop column plan;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   alter table public.organizations
--     add column plan text not null default 'starter'
--     check (plan in ('starter', 'growth', 'enterprise'));
--   update public.organizations o set plan = a.plan
--     from public.accounts a where a.id = o.account_id;
--   drop trigger  if exists organizations_guard_status on public.organizations;
--   drop function if exists app.guard_company_status_change();
--   alter table public.organizations drop column status;
-- ═══════════════════════════════════════════════════════════════════════════
