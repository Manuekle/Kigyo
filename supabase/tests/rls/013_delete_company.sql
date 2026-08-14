-- ═══════════════════════════════════════════════════════════════════════════
-- Una empresa se puede borrar, y se lleva sus datos.
--
-- Deleting a company is a product capability (docs/FASE_0_CONTRATOS.md §6.2)
-- and it rests entirely on `org_id ... on delete cascade` being true of every
-- business table. It was not: two things blocked it, and both were invisible
-- until somebody tried to empty a database.
--
--   · `payroll_lines.employee_id` was `on delete restrict`, so a company that
--     had ever run payroll refused to go (migration 39);
--   · `app.audit_row` recorded each cascading delete into `audit_log`, whose
--     `org_id` points at the company disappearing in that very statement
--     (migration 40).
--
-- Neither had a test, which is why both survived four migrations that talked
-- about deleting companies. This is that test: build a company with the exact
-- rows that blocked it, delete it, and check that nothing is left behind and
-- nothing else moved.
-- ═══════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\timing off

begin;

create temporary table t_result (name text, ok boolean, detail text) on commit drop;

create or replace function pg_temp.check(p_name text, p_ok boolean, p_detail text default '')
returns void language plpgsql security definer as $$
begin
  insert into pg_temp.t_result values (p_name, p_ok, p_detail);
end;
$$;

-- ═══ Fixtures ═══════════════════════════════════════════════════════════════
-- Two companies in two accounts. Only the first is deleted; the second is
-- there to prove the blast radius stops where it should.

insert into auth.users (id, email, raw_user_meta_data) values
  ('f1000000-0000-0000-0000-000000000001', 'vera@borrable.test',
   '{"full_name":"Vera Borrable","company":"Clínica Vera","company_type":"salud"}'),
  ('f2000000-0000-0000-0000-000000000002', 'wili@intacta.test',
   '{"full_name":"Wili Intacta","company":"Otra Intacta"}');

select
  (select org_id from public.memberships
     where user_id = 'f1000000-0000-0000-0000-000000000001') as org_vera,
  (select org_id from public.memberships
     where user_id = 'f2000000-0000-0000-0000-000000000002') as org_wili
\gset

-- The rows that used to make this impossible: an employee, a payroll period,
-- and a payroll line joining them.
insert into public.employees (org_id, code, full_name, position, status)
values (:'org_vera', 'EMP-001', 'Ana Nómina', 'Higienista', 'Activo');

insert into public.payroll_periods (org_id, code, period)
values (:'org_vera', 'NOM-001', '2026-08-01');

insert into public.payroll_lines (payroll_period_id, employee_id, gross_cents, deductions_cents)
select p.id, e.id, 250000000, 20000000
from public.payroll_periods p, public.employees e
where p.org_id = :'org_vera' and e.org_id = :'org_vera';

-- And something audited, so the trail is not empty when the company goes.
insert into public.clients (org_id, code, name)
values (:'org_vera', 'CLI-001', 'Paciente Particular');

do $$
begin
  perform pg_temp.check(
    'the company starts with data and an audit trail',
    (select count(*) > 0 from public.payroll_lines)
    and (select count(*) > 0 from public.audit_log
          where org_id = (select id from public.organizations where slug like 'clinica-vera%')),
    'la fixture no dejó ni nómina ni auditoría: el test no probaría nada'
  );
end;
$$;

-- ═══ El borrado ═════════════════════════════════════════════════════════════

do $$
declare
  v_org    uuid;
  v_wili   uuid;
  v_failed text := null;
begin
  select id into v_org from public.organizations where slug like 'clinica-vera%';
  select id into v_wili from public.organizations where slug like 'otra-intacta%';

  begin
    delete from public.organizations where id = v_org;
  exception when others then
    v_failed := sqlerrm;
  end;

  perform pg_temp.check('a company with payroll and an audit trail can be deleted',
                        v_failed is null, coalesce(v_failed, ''));

  perform pg_temp.check(
    'and takes its employees with it',
    not exists (select 1 from public.employees where org_id = v_org),
    'quedaron empleados de una empresa borrada'
  );

  perform pg_temp.check(
    'its payroll too, lines included',
    not exists (select 1 from public.payroll_periods where org_id = v_org)
    and not exists (
      select 1 from public.payroll_lines pl
      join public.payroll_periods pp on pp.id = pl.payroll_period_id
      where pp.org_id = v_org
    ),
    'quedaron líneas de nómina huérfanas'
  );

  perform pg_temp.check(
    'and its audit trail, which was its own data',
    not exists (select 1 from public.audit_log where org_id = v_org),
    'quedó auditoría de una empresa que ya no existe'
  );

  perform pg_temp.check(
    'the roles and memberships go as well',
    not exists (select 1 from public.roles where org_id = v_org)
    and not exists (select 1 from public.memberships where org_id = v_org),
    'quedaron roles o membresías apuntando a la nada'
  );

  -- The account outlives its company: a group with no companies is a customer
  -- who deleted their only business, not a customer who cancelled.
  perform pg_temp.check(
    'the account survives its last company',
    exists (select 1 from public.accounts a
             join public.account_memberships am on am.account_id = a.id
            where am.user_id = 'f1000000-0000-0000-0000-000000000001'),
    'borrar la empresa se llevó la cuenta por delante'
  );

  -- The blast radius.
  perform pg_temp.check(
    'the other company is untouched',
    exists (select 1 from public.organizations where id = v_wili)
    and exists (select 1 from public.memberships where org_id = v_wili),
    'borrar una empresa afectó a otra'
  );
end;
$$;

-- ═══ Y la auditoría normal sigue funcionando ════════════════════════════════
--
-- The guard added in migration 40 only skips when the company is already gone.
-- An ordinary delete, with the company alive, must still be recorded — the
-- cheapest way to turn that fix into a silent hole is to skip too much.

do $$
declare
  v_wili     uuid;
  v_employee uuid;
  v_before   int;
begin
  select id into v_wili from public.organizations where slug like 'otra-intacta%';

  -- `employees`, not `clients`: the audit triggers were attached in migration
  -- 05 to the tables that existed then, and `clients` arrived in 15 without
  -- one. Testing the guard against an unaudited table would have reported a
  -- broken fix that was fine — and hidden a broken one that was not.
  insert into public.employees (org_id, code, full_name, position, status)
  values (v_wili, 'EMP-999', 'Pasajero Temporal', 'Temporal', 'Activo')
  returning id into v_employee;

  select count(*) into v_before from public.audit_log
  where org_id = v_wili and action = 'delete';

  delete from public.employees where id = v_employee;

  perform pg_temp.check(
    'deleting one row of a living company is still audited',
    (select count(*) from public.audit_log where org_id = v_wili and action = 'delete') = v_before + 1,
    'el guardián de la migración 40 se comió una entrada de auditoría legítima'
  );
end;
$$;

-- ═══ Report ═════════════════════════════════════════════════════════════════

select
  case when ok then 'ok  ' else 'FAIL' end as status,
  name,
  case when ok then '' else detail end as detail
from t_result
order by ok, name;

do $$
declare v_failed int;
begin
  select count(*) into v_failed from t_result where not ok;
  if v_failed > 0 then
    raise exception '% company-deletion assertion(s) failed', v_failed;
  end if;
  raise notice 'all % company-deletion assertions passed', (select count(*) from t_result);
end;
$$;

rollback;
