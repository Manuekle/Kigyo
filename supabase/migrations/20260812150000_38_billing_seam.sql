-- ═══════════════════════════════════════════════════════════════════════════
-- 38 — La costura de facturación
--
-- Migration 32 made suspension real and moved the plan to `public.accounts`.
-- What was still missing is everything between a payment provider and that
-- column: nothing receives an event, nothing records that it was received, and
-- the only writer is `scripts/set-plan.mjs` — a person, at a terminal, running
-- SQL by hand.
--
-- This adds the seam, and deliberately not a provider. Which one Kigyo bills
-- through is a commercial decision that is not made yet, and building the
-- generic half first means making it cannot invalidate any of this:
--
--   · `public.billing_events`     — every event received, once. The log is the
--                                   idempotency key and the audit trail at the
--                                   same time.
--   · `public.apply_subscription()`  — the one function that changes what an
--                                   account has paid for, and reconciles which
--                                   of its companies stay writable.
--
-- ─── Por qué la reconciliación vive aquí y no en la aplicación ─────────────
--
-- Because it must be atomic with the plan change. A downgrade that lowered the
-- tier and then failed before suspending anything would leave an account with
-- three companies on a plan that allows one — every one of them writable, and
-- nothing in the product aware it is wrong. One function, one transaction, one
-- outcome.
--
-- `scripts/set-plan.mjs` carried a copy of this logic inline. It now calls this
-- function, so the manual path and the webhook cannot drift into suspending
-- different companies.
--
-- ─── Qué NO hace ───────────────────────────────────────────────────────────
--
-- No borra nada, jamás. A customer who stops paying keeps every row: the
-- companies go read-only, stay visible, and come back the moment the account
-- is current again. Los módulos fuera del plan siguen guardados en
-- `enabled_modules` (contrato K.3), así que subir de plan devuelve la
-- configuración exactamente como estaba.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.accounts
  add column billing_provider text
    check (billing_provider is null or billing_provider ~ '^[a-z][a-z0-9-]{1,30}$');

comment on column public.accounts.billing_provider is
  'Qué proveedor emitió billing_customer_id / billing_subscription_id. Null = todavía no hay cobro automático.';

-- The column grant from migration 26 named the readable columns explicitly, so
-- a new one is invisible to `authenticated` unless it is granted. That is the
-- correct default here and it stays: which processor bills the group is not
-- something an employee needs.

/* ═══════════════════════════════════════════════════════════════════════════
 * El registro de eventos
 * ═══════════════════════════════════════════════════════════════════════════ */

create table public.billing_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  /**
   * The provider's own id for the event.
   *
   * Unique, and that uniqueness is the whole idempotency strategy: every
   * processor worth using retries on a non-2xx, and several deliver at least
   * once by design. A webhook that applies a downgrade twice is harmless; one
   * that applies a *cancellation* twice against a half-written state is not.
   * Inserting first and letting the constraint refuse the duplicate is the only
   * version of this check that cannot race with itself.
   */
  event_id     text not null,
  kind         text not null,
  /** Null when the event names an account this database does not have. */
  account_id   uuid references public.accounts (id) on delete set null,
  payload      jsonb not null default '{}'::jsonb,
  received_at  timestamptz not null default now(),
  /** Null until the event has been acted on. */
  applied_at   timestamptz,
  /** Why it was not applied. Null when it was, or when it has not been tried. */
  error        text,
  unique (provider, event_id)
);

create index billing_events_account_idx on public.billing_events (account_id, received_at desc);
create index billing_events_pending_idx on public.billing_events (received_at)
  where applied_at is null;

comment on table public.billing_events is
  'Cada evento del proveedor de pagos, una sola vez. Invisible para authenticated: contiene datos comerciales del grupo.';

alter table public.billing_events enable row level security;
alter table public.billing_events force  row level security;

-- No policies at all, on purpose. `service_role` bypasses RLS; everybody else
-- gets nothing, which is what an event carrying amounts, customer ids and
-- payment state should be to an employee of one of the companies.
revoke all on public.billing_events from authenticated, anon;

/* ═══════════════════════════════════════════════════════════════════════════
 * Aplicar una suscripción
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Sets what an account has paid for, and reconciles its companies.
 *
 * Three inputs, and the second and third are different questions:
 *
 *   · `p_plan`   — which tier. Null leaves it as it is, for events that only
 *                  report a payment state.
 *   · `p_status` — what the subscription is doing: 'active', 'past_due',
 *                  'canceled'… Null leaves it as it is.
 *
 * Suspension follows from both:
 *
 *   · a subscription that is not `active` suspends every company. The customer
 *     has stopped paying, and read-only is what "stopped paying" means here —
 *     never deletion, never hiding;
 *   · an active subscription suspends only what the tier does not cover: the
 *     oldest companies stay writable, up to `plan_limits.max_companies`, and
 *     the rest go read-only. Oldest rather than largest or most recent because
 *     it is the one ordering the customer can predict without being told.
 *
 * Idempotent. Running it twice with the same arguments produces the same rows,
 * which matters because a webhook will.
 *
 * In `public` because that is the schema PostgREST exposes, and the webhook has
 * to call it over the API like any other RPC. Being reachable is not being
 * callable: every role but `service_role` has EXECUTE revoked, which is the
 * same arrangement `public.rate_limit_hit` has used since migration 06.
 */
create or replace function public.apply_subscription(
  p_account_id uuid,
  p_plan       text default null,
  p_status     text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan   text;
  v_status text;
  v_max    int;
begin
  if p_account_id is null then
    raise exception 'apply_subscription necesita una cuenta.' using errcode = 'check_violation';
  end if;

  if p_plan is not null and not exists (
    select 1 from public.plan_limits l where l.plan = p_plan
  ) then
    raise exception 'Plan desconocido: %.', p_plan using errcode = 'check_violation';
  end if;

  update public.accounts a
  set plan           = coalesce(p_plan, a.plan),
      billing_status = coalesce(p_status, a.billing_status)
  where a.id = p_account_id
  returning a.plan, a.billing_status into v_plan, v_status;

  if v_plan is null then
    raise exception 'No existe la cuenta %.', p_account_id using errcode = 'no_data_found';
  end if;

  select l.max_companies into v_max from public.plan_limits l where l.plan = v_plan;

  -- A status the provider set to anything other than active means the money
  -- stopped. Null is not that: it is an account that has never been billed,
  -- which is every account today.
  if v_status is not null and v_status <> 'active' then
    update public.organizations set status = 'suspended'
    where account_id = p_account_id and status <> 'suspended';
    return;
  end if;

  with ranked as (
    select o.id,
           row_number() over (order by o.created_at, o.id) as rn
    from public.organizations o
    where o.account_id = p_account_id
  )
  update public.organizations o
  set status = case
                 when v_max is null or r.rn <= v_max then 'active'
                 else 'suspended'
               end
  from ranked r
  where r.id = o.id
    -- Only rows that actually change, so the guard trigger and the audit log
    -- see a write when there is one and stay quiet when there is not.
    and o.status is distinct from case
                                    when v_max is null or r.rn <= v_max then 'active'
                                    else 'suspended'
                                  end;
end;
$$;

revoke all on function public.apply_subscription(uuid, text, text) from public, anon, authenticated;
-- Reachable over PostgREST, callable by nobody who reaches it that way. The
-- same shape as public.rate_limit_hit (migration 06): the billing process holds
-- the service key, and it is the only caller there will ever be.
grant execute on function public.apply_subscription(uuid, text, text) to service_role;

comment on function public.apply_subscription(uuid, text, text) is
  'Única vía para cambiar el plan de una cuenta y reconciliar la suspensión de sus empresas. Solo service_role.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop function if exists public.apply_subscription(uuid, text, text);
--   drop table    if exists public.billing_events;
--   alter table public.accounts drop column billing_provider;
--
-- Additive: no existing policy, function or business row is modified. The
-- suspension logic this centralises still exists inline in
-- scripts/set-plan.mjs's history if it is ever needed back.
-- ═══════════════════════════════════════════════════════════════════════════
