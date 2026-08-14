-- ═══════════════════════════════════════════════════════════════════════════
-- 36 — `access_role` no concede acceso a nada
--
-- Problem P10 of the audit, deferred since phase 4: a person's role is written
-- in two places.
--
--   · `memberships.role`        — what the signed-in user may open. Read by
--                                 `getMember()`, by `app.orgs_with()`, and
--                                 therefore by every RLS policy in the schema.
--   · `employees.access_role`   — a column on the HR record. Read by the
--                                 employee screens and by nothing else.
--
-- Nothing keeps them equal, and the name is the reason they get confused: a
-- column called `access_role` reads as the thing that decides access. The
-- comment in `NuevoEmpleadoModal.tsx` said so out loud — "`access_role` is what
-- the person may open in Kigyo" — which is exactly false, and it is the kind of
-- false that ends with somebody demoting an employee record and believing they
-- have revoked a session.
--
-- The column is worth keeping. It answers a real question, just not that one:
-- *when this person gets an account, which role should they get?* Somebody is
-- hired, the HR record exists for weeks, the invitation goes out later. So it
-- is renamed to what it is, and the database says so where the next person will
-- look.
--
-- ─── What this is not ──────────────────────────────────────────────────────
--
-- Not a behaviour change. The foreign key still points at `public.roles
-- (org_id, key)` with `on delete restrict`, the seeded values are untouched,
-- and no policy consulted this column before or after — which is the whole
-- point being made permanent.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.employees rename column access_role to intended_role;

-- Renamed with it: a constraint named after the old column is the next stale
-- reference, and migration 35 is a fresh reminder of what those cost.
alter table public.employees
  rename constraint employees_access_role_fkey to employees_intended_role_fkey;

comment on column public.employees.intended_role is
  'Rol previsto para cuando esta persona reciba cuenta. NO concede acceso: la autoridad es memberships.role, que es lo que lee app.orgs_with y por tanto todas las políticas RLS.';

comment on column public.employees.user_id is
  'La cuenta de esta persona, si la tiene. Cuando no es null, su acceso real lo decide memberships.role, no employees.intended_role.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   alter table public.employees
--     rename constraint employees_intended_role_fkey to employees_access_role_fkey;
--   alter table public.employees rename column intended_role to access_role;
-- ═══════════════════════════════════════════════════════════════════════════
