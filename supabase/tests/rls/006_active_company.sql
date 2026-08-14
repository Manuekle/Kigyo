-- ═══════════════════════════════════════════════════════════════════════════
-- Switching companies, from the database's side.
--
-- The application decides which company a request operates in by reading a
-- cookie. A cookie is client-supplied, so the only thing that makes it
-- trustworthy is `public.set_active_company`, which answers "does this person
-- actually belong here" and stamps the membership in the same statement.
--
-- That function is SECURITY DEFINER, which means it runs with the privileges of
-- its owner and past every policy on `memberships`. Functions like that are
-- where tenant isolation goes to die, so the assertions below are mostly about
-- what it must REFUSE to do:
--
--   · it must not confirm a company the caller is not a member of,
--   · it must not stamp — or reveal — anybody else's membership,
--   · it must not be a way to write any column other than `last_active_at`.
--
-- The pure half of the rule (which company wins, given the cookie and the
-- memberships) is tested in src/lib/auth/active-company.test.ts.
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

grant execute on function pg_temp.check(text, boolean, text) to authenticated, anon;

-- ═══ Fixtures ═══════════════════════════════════════════════════════════════
-- Dora runs a group with two companies and belongs to both. Elena belongs to
-- one of them only. Fabio is a stranger with his own account.

insert into auth.users (id, email, raw_user_meta_data) values
  ('d0000000-0000-0000-0000-00000000000d', 'dora@grupo.test',
   '{"full_name":"Dora Grupo","company":"Clínica Norte"}'),
  ('e0000000-0000-0000-0000-00000000000e', 'elena@grupo.test',
   '{"full_name":"Elena Grupo","company":"Elena Sola"}'),
  ('f0000000-0000-0000-0000-00000000000f', 'fabio@ajeno.test',
   '{"full_name":"Fabio Ajeno","company":"Ajena SA"}');

select
  (select org_id from public.memberships
     where user_id = 'd0000000-0000-0000-0000-00000000000d') as org_clinic,
  (select org_id from public.memberships
     where user_id = 'f0000000-0000-0000-0000-00000000000f') as org_far
\gset

select (select account_id from public.organizations where id = :'org_clinic') as acct \gset

-- A second company in Dora's group. Migration 28 caps companies per account,
-- and a group running two businesses is on a plan that allows two.
update public.accounts set plan = 'growth' where id = :'acct';

-- Provisioned through the shared path rather than assembled by hand, so this
-- fixture exercises the same function "nueva empresa" calls. A fixture that
-- builds a company its own way is a fixture that can pass while the product's
-- own company is missing a role or a grant.
select app.provision_company(
  :'acct', 'Restaurante Norte', null, 'd0000000-0000-0000-0000-00000000000d'
) as org_rest \gset

-- Elena joins the restaurant and nothing else. Her own signup organization is
-- dropped rather than her membership deleted: she is its sole administrator and
-- the last-admin guard correctly refuses to leave it without one.
delete from public.organizations
 where id in (select org_id from public.memberships
               where user_id = 'e0000000-0000-0000-0000-00000000000e');

insert into public.memberships (org_id, user_id, role)
values (:'org_rest', 'e0000000-0000-0000-0000-00000000000e', 'Empleado');

insert into public.employees (org_id, full_name, position, department) values
  (:'org_clinic', 'Médica de la Clínica', 'Médica', 'Asistencial'),
  (:'org_rest',   'Chef del Restaurante', 'Chef',   'Cocina');

create temporary table t_fixture (org_clinic uuid, org_rest uuid, org_far uuid) on commit drop;
insert into t_fixture values (:'org_clinic', :'org_rest', :'org_far');
grant select on t_fixture to authenticated, anon;

\o /dev/null

-- ═══ Dora — belongs to both companies ═══════════════════════════════════════

set local role authenticated;
set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-00000000000d';

select pg_temp.check(
  'a member switching into their own company is confirmed',
  public.set_active_company((select org_rest from pg_temp.t_fixture)) = true,
  'set_active_company negó una empresa propia'
);

select pg_temp.check(
  'the switch stamped exactly the membership that was entered',
  (select count(*) = 1 from public.memberships
    where user_id = 'd0000000-0000-0000-0000-00000000000d'
      and last_active_at is not null
      and org_id = (select org_rest from pg_temp.t_fixture)),
  'se marcó un número inesperado de membresías'
);

-- ─── The assertion the function exists to make ──────────────────────────────
-- SECURITY DEFINER runs past the policies on `memberships`. If it confirmed a
-- company on the strength of the id alone, the cookie would become a way into
-- any tenant in the database — and the application, which trusts this answer,
-- would hand over the whole company.

select pg_temp.check(
  'switching into a company you do not belong to is refused',
  public.set_active_company((select org_far from pg_temp.t_fixture)) = false,
  'FUGA: set_active_company confirmó una empresa ajena'
);

select pg_temp.check(
  'switching into a company that does not exist is refused',
  public.set_active_company('00000000-0000-0000-0000-000000000000'::uuid) = false,
  'una empresa inexistente fue confirmada'
);

select pg_temp.check(
  'a null company is refused rather than raising',
  public.set_active_company(null) = false,
  'null no fue rechazado limpiamente'
);

-- A refused switch must leave no trace. Stamping first and checking after would
-- make the refusal detectable — and would let anyone write to a row in a tenant
-- they cannot read.
select pg_temp.check(
  'a refused switch writes nothing at all',
  (select count(*) = 0 from public.memberships
    where org_id = (select org_far from pg_temp.t_fixture)
      and last_active_at is not null),
  'una empresa ajena quedó marcada'
);

-- ═══ Elena — one company, and it is inside somebody else's group ════════════

set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-00000000000e';

select pg_temp.check(
  'a plain Empleado can switch into their own company',
  public.set_active_company((select org_rest from pg_temp.t_fixture)) = true,
  'un Empleado no pudo marcar su propia empresa'
);

-- Sharing an account with the clinic is not membership of the clinic. This is
-- the same boundary test 005 makes from the account side, approached from the
-- switcher instead.
select pg_temp.check(
  'sharing an account does not make a sibling company switchable',
  public.set_active_company((select org_clinic from pg_temp.t_fixture)) = false,
  'FUGA: una empresa hermana fue confirmada sin membresía'
);

select pg_temp.check(
  'and the sibling company stays invisible',
  (select count(*) = 0 from public.employees
    where org_id = (select org_clinic from pg_temp.t_fixture)),
  'FUGA: vio empleados de la empresa hermana'
);

-- The stamp is per person. Elena entering the restaurant must not disturb
-- Dora's record of where *she* was.
select pg_temp.check(
  'the stamp belongs to the caller, not to the company',
  (select count(*) = 2 from public.memberships
    where org_id = (select org_rest from pg_temp.t_fixture)
      and last_active_at is not null),
  'la marca se aplicó a la membresía equivocada'
);

-- ─── The function must not be a back door into the rest of the row ──────────
-- `memberships_write` is admin-only, so an Empleado editing their own role is
-- refused. Confirmed here because `last_active_at` now lives on that table and
-- a policy loosened to let people stamp it would hand them their own promotion.

do $$
declare
  v_count int;
  v_rest  uuid;
begin
  select org_rest into v_rest from pg_temp.t_fixture;
  update public.memberships set role = 'Administrador'
   where user_id = 'e0000000-0000-0000-0000-00000000000e' and org_id = v_rest;
  get diagnostics v_count = row_count;
  perform pg_temp.check('an Empleado still cannot promote themselves', v_count = 0,
                        v_count::text || ' filas actualizadas');
end;
$$;

-- ═══ Fabio — outside the group ══════════════════════════════════════════════

set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-00000000000f';

select pg_temp.check(
  'an outsider cannot switch into any company of the group',
  public.set_active_company((select org_rest from pg_temp.t_fixture)) = false
    and public.set_active_company((select org_clinic from pg_temp.t_fixture)) = false,
  'FUGA: un extraño fue confirmado en una empresa del grupo'
);

-- ═══ Anonymous ══════════════════════════════════════════════════════════════

set local role anon;
set local request.jwt.claim.sub = '';

do $$
declare v_failed boolean := false;
begin
  begin
    perform public.set_active_company('00000000-0000-0000-0000-000000000000'::uuid);
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.check('anonymous cannot call set_active_company', v_failed,
                        'anon pudo ejecutar la función');
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
    raise exception '% active-company assertion(s) failed', v_failed;
  end if;
  raise notice 'all % active-company assertions passed', (select count(*) from t_result);
end;
$$;

rollback;
