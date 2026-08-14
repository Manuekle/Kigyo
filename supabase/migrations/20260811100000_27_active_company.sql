-- ═══════════════════════════════════════════════════════════════════════════
-- 27 — Which company a person was last working in
--
-- Migration 26 made it possible for one account to own several companies. This
-- one records which of them a person had open, so that signing back in lands
-- them where they left off rather than in whichever company they joined first.
--
-- That sounds cosmetic and is not. Without it the default company is the oldest
-- membership, forever: someone who joined the holding company in 2024 and has
-- worked in the new subsidiary every day since would land on the holding
-- company every single morning, and the first thing they would do is switch.
-- Worse, a person who forgets to switch enters an invoice in the wrong company.
--
-- ─── Why a function and not a policy ────────────────────────────────────────
--
-- `memberships` is written under `memberships_write`, which requires
-- `app.is_org_admin(org_id)` — correctly, since that table decides who may do
-- what. A plain Empleado therefore cannot update their own row, and RLS cannot
-- express "you may update this one column of your own membership" because
-- policies are row-level, not column-level.
--
-- Splitting the stamp into its own table would be a second row to keep in step
-- with the membership it describes, and an orphan to clean up on every removal.
-- So it stays on the membership and is written through one SECURITY DEFINER
-- function that stamps exactly one column, for exactly the calling user.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.memberships
  add column last_active_at timestamptz;

comment on column public.memberships.last_active_at is
  'Cuándo esta persona tuvo esta empresa abierta por última vez. Decide la empresa por defecto al iniciar sesión.';

-- Ordering the caller's own memberships is the only read this supports, and it
-- is always filtered by user first, so the index leads with the user.
create index memberships_user_recent_idx
  on public.memberships (user_id, last_active_at desc nulls last);

/**
 * Records that the caller switched into a company, and says whether they may.
 *
 * The return value is the point. The application has to answer "is this cookie
 * pointing at a company this person actually belongs to" before it trusts it,
 * and doing the check here means the check and the write cannot disagree — a
 * membership that vanished between the two would otherwise be stamped as
 * active. `false` means the caller is not a member, and nothing was written.
 *
 * SECURITY DEFINER to get past `memberships_write`, and deliberately narrow:
 * it writes one column, on rows belonging to `auth.uid()`, and takes no user
 * id parameter — so it cannot be used to stamp somebody else's membership or
 * to discover whether a stranger belongs to a company.
 */
create or replace function app.touch_active_company(p_org_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_touched int;
begin
  if p_org_id is null then
    return false;
  end if;

  update public.memberships
     set last_active_at = now()
   where user_id = (select auth.uid())
     and org_id  = p_org_id;

  get diagnostics v_touched = row_count;
  return v_touched > 0;
end;
$$;

revoke all on function app.touch_active_company(uuid) from public, anon;
grant execute on function app.touch_active_company(uuid) to authenticated;

comment on function app.touch_active_company(uuid) is
  'Marca la empresa activa del usuario actual. Devuelve false si no es miembro — el llamador debe tratarlo como cookie inválida.';

-- ─── Reachable from PostgREST ───────────────────────────────────────────────
-- `app` is not an exposed schema, so a wrapper in `public` is what the client
-- can call. It adds nothing but reach: the body is one call, and the privilege
-- it needs lives in the function above.

create or replace function public.set_active_company(p_org_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select app.touch_active_company(p_org_id);
$$;

revoke all on function public.set_active_company(uuid) from public, anon;
grant execute on function public.set_active_company(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop function if exists public.set_active_company(uuid);
--   drop function if exists app.touch_active_company(uuid);
--   drop index    if exists public.memberships_user_recent_idx;
--   alter table public.memberships drop column last_active_at;
-- ═══════════════════════════════════════════════════════════════════════════
