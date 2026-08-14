-- ═══════════════════════════════════════════════════════════════════════════
-- 39 — Una empresa que ha pagado nómina no se podía borrar nunca
--
-- Deleting a company is a product capability: `docs/FASE_0_CONTRATOS.md §6.2`
-- gives it to the account owner, and every business table declares
-- `org_id ... on delete cascade` so that one DELETE takes the company's data
-- with it.
--
-- One foreign key does not cascade:
--
--     payroll_lines.employee_id → employees (id) on delete restrict
--
-- `employees` cascades from the company, `payroll_lines` refuses to let its
-- employees go, and the whole delete aborts:
--
--     update or delete on table "employees" violates foreign key constraint
--     "payroll_lines_employee_id_fkey" on table "payroll_lines"
--
-- So any company that has ever run payroll is permanently undeletable — by the
-- owner, by support, by anything short of hand-written SQL. It surfaced while
-- emptying the database to test a first run.
--
-- ─── Por qué `cascade` y no otra cosa ──────────────────────────────────────
--
-- `restrict` was guarding something real: payroll history should not vanish
-- because somebody removed an employee. But the application never hard-deletes
-- an employee — `employees.deleted_at` is a soft delete, and every query filters
-- on it — so the only DELETE that ever reaches that row is the cascade from the
-- company itself. Guarding against a delete the product does not perform, at
-- the price of a delete the product *does* offer, is the wrong trade.
--
-- The guard that matters is kept where it belongs: `payroll_periods` still
-- cascades to its lines, and removing a person from the roster is still a soft
-- delete that changes nothing here.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.payroll_lines
  drop constraint payroll_lines_employee_id_fkey;

alter table public.payroll_lines
  add constraint payroll_lines_employee_id_fkey
  foreign key (employee_id) references public.employees (id) on delete cascade;

comment on column public.payroll_lines.employee_id is
  'Cascada al borrar el empleado. La app nunca borra empleados en duro (usa deleted_at): el único DELETE que llega aquí es la cascada de la empresa.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   alter table public.payroll_lines drop constraint payroll_lines_employee_id_fkey;
--   alter table public.payroll_lines
--     add constraint payroll_lines_employee_id_fkey
--     foreign key (employee_id) references public.employees (id) on delete restrict;
--
-- Reverting restores the bug. It is written down for completeness, not as a
-- suggestion.
-- ═══════════════════════════════════════════════════════════════════════════
