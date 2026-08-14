-- ═══════════════════════════════════════════════════════════════════════════
-- 41 — Setup belongs to the company, and the sector stops moving
--
-- Two things this fixes, and they are the same mistake seen from two sides.
--
-- ─── 1. The wizard was stamped on the account ──────────────────────────────
--
-- `accounts.onboarding_completed_at` (migration 26, wired to a real wizard in
-- 30) decides whether `/dashboard` redirects to `/onboarding`. That was right
-- while an account was a company. It is wrong now: the second company an
-- account creates is never configured at all — no sector question, no module
-- selection, no branches, no invitations — because the account was stamped
-- when the *first* one was set up.
--
-- So the flag moves to where the work actually happens. Setting up a company
-- is a per-company act; paying for the group is a per-account one. The account
-- column stays, still stamped, so nothing that reads it breaks — but the gate
-- is `organizations.setup_completed_at` from here.
--
-- ─── 2. The sector could be changed at any time, forever ───────────────────
--
-- `updateSector` writes `company_type` whenever Configuración asks, which means
-- a clinic with four hundred patients can become a restaurant on a Tuesday. The
-- vertical module changes, the sidebar changes, and the patients stay in
-- `public.patients` with nowhere to be read from.
--
-- The lock is deliberately *soft*: the sector is free to change while the
-- company has no data in the vertical it named, and refused once it does. A
-- hard lock from the INSERT would punish the first-day typo by making the
-- customer delete the company and start over, which is a worse product for a
-- worse reason. Modules stay editable either way — the sector only ever
-- proposed them.
--
-- What counts as "has data" is one row in the sector's own table. Not
-- employees, not documents, not invoices: those are generic and a company that
-- picked the wrong sector on Monday will have some by Tuesday. Only the
-- vertical's own records are evidence that the sector was the right answer.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Setup state, per company ───────────────────────────────────────────────

alter table public.organizations
  add column if not exists setup_completed_at timestamptz;

comment on column public.organizations.setup_completed_at is
  'Cuándo se terminó el asistente de configuración de ESTA empresa. Null = pendiente. '
  'El gate de /onboarding lo lee; accounts.onboarding_completed_at ya no.';

/**
 * Every company that exists today has been in use without a wizard of its own,
 * so none of them should suddenly be sent to one.
 *
 * Stamped from the account when the account was stamped, and from the company's
 * own creation date otherwise. The second case is the company that was created
 * by "nueva empresa" under an account whose wizard was never finished: it has
 * been worked in regardless, and dropping its owner into setup now would be a
 * surprise, not a service.
 */
update public.organizations o
   set setup_completed_at = coalesce(a.onboarding_completed_at, o.created_at)
  from public.accounts a
 where a.id = o.account_id
   and o.setup_completed_at is null;

/**
 * Marks one company's setup finished.
 *
 * Takes the company explicitly rather than reading the active-company cookie:
 * the cookie is not visible to the database, and the wizard already knows which
 * company it is configuring. Authorization is the same question every other
 * write asks — `configuracion:manage` in that company — so an account owner who
 * has not joined a company cannot stamp it, which is the rule from
 * docs/FASE_0_CONTRATOS.md §6 and not an accident.
 *
 * Idempotent: finishing twice keeps the first time.
 */
create or replace function public.complete_company_setup(p_org_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Inicia sesión para continuar.' using errcode = 'insufficient_privilege';
  end if;

  if p_org_id is null or p_org_id not in (select app.orgs_with('configuracion:manage')) then
    raise exception 'No puedes configurar esta empresa.' using errcode = 'insufficient_privilege';
  end if;

  update public.organizations
     set setup_completed_at = now()
   where id = p_org_id
     and setup_completed_at is null;

  -- Kept in step so anything still reading the account-level flag — and the
  -- billing screens do — agrees with what the customer just did.
  update public.accounts a
     set onboarding_completed_at = now()
   from public.organizations o
  where o.id = p_org_id
    and a.id = o.account_id
    and a.onboarding_completed_at is null;

  return true;
end;
$$;

revoke all on function public.complete_company_setup(uuid) from public, anon;
grant execute on function public.complete_company_setup(uuid) to authenticated;

-- ─── Does this company have data in the sector it named? ────────────────────

/**
 * One row in the sector's own vertical table, or false.
 *
 * The mapping is stated rather than derived because the two vocabularies do not
 * line up — `salud` runs on `patients`, `alimentos` on `restaurant_orders`,
 * `educacion` on `students` — the same reason `ModuleEntry.vertical` is stated
 * in src/lib/modules/registry.ts. Deriving it from the key would be right for
 * four sectors and quietly wrong for the rest.
 *
 * A sector with no vertical table answers false, and that is the honest answer:
 * a construction company that picked the wrong sector has nothing
 * sector-specific to lose by picking another, because the product never gave it
 * anything sector-specific to begin with. When those sectors get their own
 * modules (see docs/PLAN_PROFUNDIDAD_SECTORIAL.md fase 5), they get a branch
 * here on the same day.
 *
 * `exists` rather than `count`: the question is whether there is any, and the
 * planner can stop at the first row.
 */
create or replace function app.company_has_vertical_data(p_org_id uuid, p_sector text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_found boolean := false;
begin
  if p_org_id is null or p_sector is null then
    return false;
  end if;

  case p_sector
    when 'salud' then
      select exists (select 1 from public.patients where org_id = p_org_id) into v_found;
    when 'educacion' then
      select exists (select 1 from public.students where org_id = p_org_id) into v_found;
    when 'alimentos' then
      select exists (select 1 from public.restaurant_orders where org_id = p_org_id) into v_found;
    when 'agro' then
      select exists (select 1 from public.farm_lots where org_id = p_org_id) into v_found;
    when 'inmobiliario' then
      select exists (select 1 from public.properties where org_id = p_org_id) into v_found;
    when 'hoteleria' then
      select exists (select 1 from public.hotel_rooms where org_id = p_org_id) into v_found;
    when 'ecommerce' then
      select exists (select 1 from public.online_orders where org_id = p_org_id) into v_found;
    else
      v_found := false;
  end case;

  return v_found;
end;
$$;

revoke all on function app.company_has_vertical_data(uuid, text) from public, anon;
grant execute on function app.company_has_vertical_data(uuid, text) to authenticated;

comment on function app.company_has_vertical_data(uuid, text) is
  'Si la empresa ya tiene registros propios del sector indicado. Cierra el cambio de sector.';

/**
 * Whether this company may still change sector.
 *
 * Exposed to the application so Configuración can show the sector as read-only
 * *before* the customer picks a new one and hits a refusal. A screen that lets
 * you choose and then says no is worse than one that never offered.
 *
 * A company with no sector may always set one: there is nothing to move away
 * from, and refusing would strand every company created before the picker
 * existed.
 */
create or replace function public.can_change_sector(p_org_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sector text;
begin
  if p_org_id is null or p_org_id not in (select app.orgs_with('configuracion:read')) then
    return false;
  end if;

  select company_type into v_sector from public.organizations where id = p_org_id;

  if v_sector is null then
    return true;
  end if;

  return not app.company_has_vertical_data(p_org_id, v_sector);
end;
$$;

revoke all on function public.can_change_sector(uuid) from public, anon;
grant execute on function public.can_change_sector(uuid) to authenticated;

-- ─── The lock itself ────────────────────────────────────────────────────────

/**
 * Refuses a sector change once the company has data in the sector it is
 * leaving.
 *
 * A trigger and not only an application check, for the reason every rule in
 * this schema is: `updateSector` is one caller, RLS lets an administrator write
 * the column directly, and a rule the database does not hold is a rule that
 * holds until somebody writes a second caller.
 *
 * The subsector is locked by the same condition and not by a weaker one.
 * Odontología and Estética are both `salud` and share `public.patients`, so the
 * vertical test cannot tell them apart — but they will not share screens for
 * long (fase 3), and a subsector that can be flipped under a live odontogram is
 * the same bug arriving later and harder to unpick. Clearing the sector clears
 * the subsector with it, which `updateSector` already does and which stays
 * allowed only while the sector itself may move.
 *
 * Fires for every role rather than just `authenticated`: `provision_company`
 * and the signup trigger are SECURITY DEFINER, and a guard those walk around is
 * not a guard. They only ever INSERT, and this watches UPDATE.
 */
create or replace function app.guard_sector_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.company_type is not distinct from old.company_type
     and new.subsector is not distinct from old.subsector then
    return new;
  end if;

  if old.company_type is null then
    return new;
  end if;

  if app.company_has_vertical_data(old.id, old.company_type) then
    raise exception
      'Esta empresa ya tiene datos del sector que eligió. Para operar otro sector, crea otra empresa.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists organizations_sector_locked on public.organizations;
create trigger organizations_sector_locked
  before update of company_type, subsector on public.organizations
  for each row execute function app.guard_sector_change();

comment on function app.guard_sector_change() is
  'Bloqueo blando del sector: libre mientras la empresa no tenga datos del vertical, '
  'refusado en cuanto los tenga. Ver docs/PLAN_PROFUNDIDAD_SECTORIAL.md fase 1.';

-- ─── Rollback ───────────────────────────────────────────────────────────────
--   drop trigger if exists organizations_sector_locked on public.organizations;
--   drop function if exists app.guard_sector_change();
--   drop function if exists public.can_change_sector(uuid);
--   drop function if exists app.company_has_vertical_data(uuid, text);
--   drop function if exists public.complete_company_setup(uuid);
--   alter table public.organizations drop column if exists setup_completed_at;
