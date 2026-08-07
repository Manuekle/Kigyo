-- ═══════════════════════════════════════════════════════════════════════════
-- The assertion that matters most: a member of organization A can never read,
-- write or delete a row belonging to organization B.
--
-- Cross-tenant reads must return ZERO ROWS, not raise — a policy that errors
-- still confirms the row exists. Writes must be rejected outright.
-- ═══════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\timing off

begin;

create temporary table t_result (name text, ok boolean, detail text) on commit drop;

-- The assertions run while impersonating `authenticated`, which has no rights
-- on the scratch table. SECURITY DEFINER lets the recorder write regardless of
-- who is currently being impersonated.
create or replace function pg_temp.check(p_name text, p_ok boolean, p_detail text default '')
returns void language plpgsql security definer as $$
begin
  insert into pg_temp.t_result values (p_name, p_ok, p_detail);
end;
$$;

grant execute on function pg_temp.check(text, boolean, text) to authenticated, anon;

-- ═══ Fixtures (run as the schema owner) ═════════════════════════════════════
-- Two independent signups. handle_new_user() builds an organization and an
-- Administrador membership for each.

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@alfa.test',
   '{"full_name":"Ana Alfa","company":"Alfa Energía"}'),
  ('22222222-2222-2222-2222-222222222222', 'beto@beta.test',
   '{"full_name":"Beto Beta","company":"Beta Solar"}'),
  ('33333333-3333-3333-3333-333333333333', 'caro@alfa.test',
   '{"full_name":"Caro Alfa","company":"Caro Alfa"}');

select
  (select org_id from public.memberships
     where user_id = '11111111-1111-1111-1111-111111111111') as org_a,
  (select org_id from public.memberships
     where user_id = '22222222-2222-2222-2222-222222222222') as org_b
\gset

-- Move Caro into Alfa as a plain Empleado. Her membership cannot simply be
-- deleted — she is the sole admin of the organization signup created for her,
-- and the last-admin guard (correctly) refuses. Drop that organization instead.
delete from public.organizations
 where id in (select org_id from public.memberships
               where user_id = '33333333-3333-3333-3333-333333333333');

insert into public.memberships (org_id, user_id, role)
values (:'org_a', '33333333-3333-3333-3333-333333333333', 'Empleado');

insert into public.employees (org_id, full_name, position, department) values
  (:'org_a', 'Empleado Alfa', 'Ingeniero', 'Proyectos'),
  (:'org_b', 'Empleado Beta', 'Analista',  'Finanzas');

insert into public.tickets (org_id, subject, area) values
  (:'org_a', 'Ticket Alfa', 'TI'),
  (:'org_b', 'Ticket Beta', 'TI');

insert into public.payroll_periods (org_id, period) values
  (:'org_a', date '2026-06-01'),
  (:'org_b', date '2026-06-01');

insert into public.documents (org_id, name) values
  (:'org_a', 'Contrato Alfa'),
  (:'org_b', 'Contrato Beta');

insert into public.ai_conversations (org_id, user_id, title)
values (:'org_a', '11111111-1111-1111-1111-111111111111', 'Privada de Ana');

create temporary table t_fixture (org_a uuid, org_b uuid) on commit drop;
insert into t_fixture values (:'org_a', :'org_b');
grant select on t_fixture to authenticated, anon;

-- Trigger-level guard, checked before any role switching.
do $$
declare
  v_failed boolean := false;
  v_id uuid;
begin
  select id into v_id from public.memberships
   where user_id = '11111111-1111-1111-1111-111111111111';
  begin
    update public.memberships set role = 'Empleado' where id = v_id;
  exception when check_violation then
    v_failed := true;
  end;
  perform pg_temp.check('sole administrator cannot demote themselves', v_failed,
                        'the organization was left without an administrator');
end;
$$;

-- Audit rows must be written by the trigger, without the app asking.
do $$
begin
  perform pg_temp.check(
    'audit trigger recorded the ticket inserts',
    (select count(*) >= 2 from public.audit_log
      where table_name = 'tickets' and action = 'insert'),
    'saw ' || (select count(*) from public.audit_log where table_name = 'tickets')::text
  );
end;
$$;

\o /dev/null

-- ═══ Ana — Administrador of Alfa ════════════════════════════════════════════

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select pg_temp.check(
  'admin sees exactly one organization',
  (select count(*) = 1 from public.organizations),
  'saw ' || (select count(*) from public.organizations)::text
);

select pg_temp.check(
  'admin sees only same-tenant employees',
  (select count(*) = 1 and bool_and(full_name = 'Empleado Alfa') from public.employees),
  'saw ' || coalesce((select string_agg(full_name, ', ') from public.employees), '∅')
);

select pg_temp.check(
  'admin sees only same-tenant tickets',
  (select count(*) = 1 and bool_and(subject = 'Ticket Alfa') from public.tickets),
  'saw ' || coalesce((select string_agg(subject, ', ') from public.tickets), '∅')
);

select pg_temp.check(
  'admin sees only same-tenant documents',
  (select count(*) = 1 and bool_and(name = 'Contrato Alfa') from public.documents),
  'saw ' || coalesce((select string_agg(name, ', ') from public.documents), '∅')
);

select pg_temp.check(
  'admin sees only same-tenant audit entries',
  (select bool_and(org_id = :'org_a') from public.audit_log),
  'audit log leaked another tenant'
);

-- Writing into another tenant must fail the WITH CHECK, not silently succeed.
-- psql does not interpolate :variables inside dollar-quoted bodies, so the
-- foreign org id is read back from the fixture table.
do $$
declare
  v_failed boolean := false;
  v_org_b  uuid;
begin
  select org_b into v_org_b from pg_temp.t_fixture;
  begin
    insert into public.employees (org_id, full_name) values (v_org_b, 'Intruso');
  exception when insufficient_privilege or check_violation then
    v_failed := true;
  end;
  perform pg_temp.check('cross-tenant insert is rejected', v_failed,
                        'insert into another org was not rejected');
end;
$$;

do $$
declare v_count int;
begin
  update public.tickets set subject = 'secuestrado' where subject = 'Ticket Beta';
  get diagnostics v_count = row_count;
  perform pg_temp.check('cross-tenant update affects nothing', v_count = 0,
                        v_count::text || ' rows updated');
end;
$$;

do $$
declare v_count int;
begin
  delete from public.documents where name = 'Contrato Beta';
  get diagnostics v_count = row_count;
  perform pg_temp.check('cross-tenant delete affects nothing', v_count = 0,
                        v_count::text || ' rows deleted');
end;
$$;

select pg_temp.check(
  'author reads their own AI conversation',
  (select count(*) = 1 from public.ai_conversations),
  'saw ' || (select count(*) from public.ai_conversations)::text
);

-- ═══ Caro — Empleado of Alfa: same tenant, fewer permissions ════════════════

set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select pg_temp.check(
  'empleado reads the employee directory',
  (select count(*) = 1 from public.employees),
  'saw ' || (select count(*) from public.employees)::text
);

select pg_temp.check(
  'empleado cannot read payroll',
  (select count(*) = 0 from public.payroll_periods),
  'saw ' || (select count(*) from public.payroll_periods)::text || ' payroll periods'
);

select pg_temp.check(
  'empleado cannot read the audit log',
  (select count(*) = 0 from public.audit_log),
  'saw ' || (select count(*) from public.audit_log)::text || ' audit rows'
);

do $$
declare v_count int;
begin
  update public.employees set position = 'Gerente' where full_name = 'Empleado Alfa';
  get diagnostics v_count = row_count;
  perform pg_temp.check('empleado cannot edit employees', v_count = 0,
                        v_count::text || ' rows updated');
end;
$$;

select pg_temp.check(
  'colleague cannot read another user''s AI conversation',
  (select count(*) = 0 from public.ai_conversations),
  'saw ' || (select count(*) from public.ai_conversations)::text
);

-- ═══ Anonymous ══════════════════════════════════════════════════════════════

set local role anon;
set local request.jwt.claim.sub = '';

-- Migration 08 revokes every grant in `public` from anon, so the anon key does
-- not even reach RLS: it is refused at the privilege layer. That is stronger
-- than "returns zero rows", and it is what these assert.
do $$
declare
  t       text;
  v_ok    boolean;
  v_denied int := 0;
  v_total  int := 0;
begin
  foreach t in array array['employees', 'organizations', 'tickets', 'documents', 'audit_log'] loop
    v_total := v_total + 1;
    v_ok := false;
    begin
      execute format('select 1 from public.%I limit 1', t);
    exception when insufficient_privilege then
      v_ok := true;
    end;
    if v_ok then
      v_denied := v_denied + 1;
    end if;
  end loop;

  perform pg_temp.check(
    'anonymous is denied at the privilege layer',
    v_denied = v_total,
    v_denied::text || '/' || v_total::text || ' tables denied'
  );
end;
$$;

reset role;
\o

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
    raise exception '% RLS assertion(s) failed', v_failed;
  end if;
  raise notice 'all % RLS assertions passed', (select count(*) from t_result);
end;
$$;

rollback;
