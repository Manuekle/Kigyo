-- ═══════════════════════════════════════════════════════════════════════════
-- Sucursales: the second dimension of isolation.
--
-- Branch scope is enforced by RESTRICTIVE policies, which are ANDed with the
-- permissive ones the earlier migrations generated. That is what let this ship
-- without editing a single existing policy — and it is also what makes these
-- assertions worth writing carefully, because a restrictive policy that is
-- subtly wrong does not error: it either hides rows people need, or it hides
-- nothing at all.
--
-- Two null-means-yes rules carry the whole design, and both are asserted here:
--
--   · a row with no branch is company-wide and stays visible to everyone who
--     could already see it — this is every row that existed before migration
--     31, so nothing anybody could see yesterday disappeared today;
--   · a person with no assignment sees every branch. Restriction is opt-in,
--     because the default applies to the administrator who has not configured
--     anything yet.
--
-- And the one that makes it a security boundary rather than a view filter: a
-- restricted person must not be able to WRITE into a branch they cannot read.
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
-- One company, two branches, three people:
--   Pia   — administrator, unrestricted
--   Quim  — restricted to the north branch
--   Rita  — a different company entirely

insert into auth.users (id, email, raw_user_meta_data) values
  ('c1000000-0000-0000-0000-000000000001', 'pia@cadena.test',
   '{"full_name":"Pia Cadena","company":"Cadena Norte"}'),
  ('c2000000-0000-0000-0000-000000000002', 'quim@cadena.test',
   '{"full_name":"Quim Cadena"}'),
  ('c3000000-0000-0000-0000-000000000003', 'rita@ajena.test',
   '{"full_name":"Rita Ajena","company":"Ajena SA"}');

select
  (select org_id from public.memberships
     where user_id = 'c1000000-0000-0000-0000-000000000001') as org_a,
  (select org_id from public.memberships
     where user_id = 'c3000000-0000-0000-0000-000000000003') as org_b
\gset

-- Quim never had a company of his own: he joins Pia's, the way an employee does.
insert into public.memberships (org_id, user_id, role)
values (:'org_a', 'c2000000-0000-0000-0000-000000000002', 'Administrador');

-- Growth allows five branches per company; signup starts on Starter, which
-- allows one. The plan moves as billing would move it.
update public.accounts
   set plan = 'growth'
 where id = (select account_id from public.organizations where id = :'org_a');

insert into public.sites (org_id, name, is_default) values (:'org_a', 'Sede Norte', true)
returning id as site_north \gset
insert into public.sites (org_id, name) values (:'org_a', 'Sede Sur')
returning id as site_south \gset

insert into public.employees (org_id, full_name, position, department, site_id) values
  (:'org_a', 'Cajero Norte',   'Cajero',   'Ventas', :'site_north'),
  (:'org_a', 'Cajero Sur',     'Cajero',   'Ventas', :'site_south'),
  -- No branch: a company-wide record, which is what every pre-migration row is.
  (:'org_a', 'Dirección',      'Director', 'Dirección', null);

insert into public.inventory_assets (org_id, name, site_id) values
  (:'org_a', 'Caja registradora Norte', :'site_north'),
  (:'org_a', 'Caja registradora Sur',   :'site_south'),
  (:'org_a', 'Servidor central',        null);

-- Quim is restricted to the north branch. Pia gets no rows at all, which is
-- what "unrestricted" looks like.
insert into public.membership_sites (org_id, user_id, site_id)
values (:'org_a', 'c2000000-0000-0000-0000-000000000002', :'site_north');

create temporary table t_fixture (org_a uuid, org_b uuid, north uuid, south uuid) on commit drop;
insert into t_fixture values (:'org_a', :'org_b', :'site_north', :'site_south');
grant select on t_fixture to authenticated, anon;

\o /dev/null

-- ═══ Pia — no restriction, so no restriction applies ════════════════════════

set local role authenticated;
set local request.jwt.claim.sub = 'c1000000-0000-0000-0000-000000000001';

/*
 * The assertion that decides whether this migration was safe to deploy.
 *
 * Everyone who is not assigned to a branch must keep seeing everything. If
 * this fails, shipping migration 31 silently emptied the screens of every
 * customer who has no interest in branches at all.
 */
select pg_temp.check(
  'somebody with no branch assignment sees every branch',
  (select count(*) = 3 from public.employees),
  'vio ' || (select count(*) from public.employees)::text || ' de 3 empleados'
);

select pg_temp.check(
  'and every asset, branch or not',
  (select count(*) = 3 from public.inventory_assets),
  'vio ' || (select count(*) from public.inventory_assets)::text || ' de 3 activos'
);

select pg_temp.check(
  'an administrator sees both branches',
  (select count(*) = 2 from public.sites),
  'vio ' || (select count(*) from public.sites)::text || ' sucursales'
);

select pg_temp.check(
  'exactly one branch is the default',
  (select count(*) = 1 from public.sites where is_default),
  'el número de sucursales por defecto no es 1'
);

-- ═══ Quim — restricted to the north branch ══════════════════════════════════

set local request.jwt.claim.sub = 'c2000000-0000-0000-0000-000000000002';

/*
 * Quim holds `empleados:read` — he is an Administrador of this company. The
 * permissive policy says yes. The restrictive one is the only thing standing
 * between him and the south branch, which is precisely what is being tested.
 */
select pg_temp.check(
  'a restricted person does not see another branch''s people',
  (select count(*) = 0 from public.employees where full_name = 'Cajero Sur'),
  'FUGA: vio al empleado de la sucursal ajena'
);

select pg_temp.check(
  'a restricted person sees their own branch',
  (select count(*) = 1 from public.employees where full_name = 'Cajero Norte'),
  'no vio al empleado de su propia sucursal'
);

-- The second null-means-yes rule. A restriction limits which *branches* are
-- visible; it must not hide the company's own unbranched records, or every
-- restricted employee loses the whole company the day this is switched on.
select pg_temp.check(
  'a restricted person still sees company-wide records',
  (select count(*) = 1 from public.employees where full_name = 'Dirección'),
  'FUGA INVERSA: la restricción ocultó un registro sin sucursal'
);

select pg_temp.check(
  'so the count is their branch plus the company-wide rows',
  (select count(*) = 2 from public.employees),
  'vio ' || (select count(*) from public.employees)::text || ', esperaba 2'
);

select pg_temp.check(
  'and the same rule holds on a second table',
  (select count(*) = 2 from public.inventory_assets)
  and (select count(*) = 0 from public.inventory_assets where name = 'Caja registradora Sur'),
  'el alcance por sucursal no se aplicó igual en inventory_assets'
);

-- ─── Writing, which is where a read-only filter would fail ──────────────────
--
-- A restrictive policy declared `for select` only would pass every assertion
-- above and still let a restricted person create, move and delete rows in a
-- branch they cannot see. `with check` is what makes this a boundary.

do $$
declare
  v_failed boolean := false;
  v_south  uuid;
  v_org    uuid;
begin
  select south, org_a into v_south, v_org from pg_temp.t_fixture;
  begin
    insert into public.employees (org_id, full_name, site_id)
    values (v_org, 'Intruso Sur', v_south);
  exception when insufficient_privilege or check_violation then
    v_failed := true;
  end;
  perform pg_temp.check('a restricted person cannot create in another branch', v_failed,
                        'FUGA: escribió en una sucursal que no puede ver');
end;
$$;

do $$
declare v_count int;
begin
  update public.employees set position = 'Gerente' where full_name = 'Cajero Sur';
  get diagnostics v_count = row_count;
  perform pg_temp.check('a restricted person cannot edit another branch', v_count = 0,
                        v_count::text || ' filas actualizadas');
end;
$$;

do $$
declare v_count int;
begin
  delete from public.employees where full_name = 'Cajero Sur';
  get diagnostics v_count = row_count;
  perform pg_temp.check('a restricted person cannot delete from another branch', v_count = 0,
                        v_count::text || ' filas eliminadas');
end;
$$;

/*
 * Moving a row you *can* see into a branch you cannot.
 *
 * The subtlest way around a branch filter: the row passes `using` because it is
 * currently in the north branch, and only `with check` catches where it is
 * going. Without it a restricted person could quietly relocate the company's
 * records out of their own sight — or into it.
 */
do $$
declare
  v_failed boolean := false;
  v_south  uuid;
begin
  select south into v_south from pg_temp.t_fixture;
  begin
    update public.employees set site_id = v_south where full_name = 'Cajero Norte';
    v_failed := not exists (
      select 1 from public.employees e
      where e.full_name = 'Cajero Norte' and e.site_id = v_south
    );
  exception when insufficient_privilege or check_violation then
    v_failed := true;
  end;
  perform pg_temp.check('a restricted person cannot move a row into another branch', v_failed,
                        'FUGA: movió un registro a una sucursal que no puede ver');
end;
$$;

-- ═══ Rita — another company entirely ════════════════════════════════════════
-- Branch scope narrows within a company; it must never widen across one. The
-- restrictive policy is ANDed with the org policy, so this should be
-- unchanged — asserted because "should be unchanged" is a claim, not a fact.

set local request.jwt.claim.sub = 'c3000000-0000-0000-0000-000000000003';

select pg_temp.check(
  'an outsider sees no branch of another company',
  (select count(*) = 0 from public.sites),
  'vio ' || (select count(*) from public.sites)::text || ' sucursales ajenas'
);

select pg_temp.check(
  'an outsider sees no employee, branch or not',
  (select count(*) = 0 from public.employees),
  'FUGA: el aislamiento entre empresas se debilitó'
);

select pg_temp.check(
  'an outsider sees no branch assignment',
  (select count(*) = 0 from public.membership_sites),
  'vio la asignación de sucursales de otra empresa'
);

-- ═══ Back to Pia: the restriction is hers to set ════════════════════════════

set local request.jwt.claim.sub = 'c1000000-0000-0000-0000-000000000001';

select pg_temp.check(
  'an administrator can see who is assigned where',
  (select count(*) = 1 from public.membership_sites),
  'no vio la asignación de su propia empresa'
);

do $$
declare
  v_org   uuid;
  v_south uuid;
begin
  select org_a, south into v_org, v_south from pg_temp.t_fixture;
  insert into public.membership_sites (org_id, user_id, site_id)
  values (v_org, 'c2000000-0000-0000-0000-000000000002', v_south);

  perform pg_temp.check(
    'adding a second branch widens what that person sees',
    (select count(*) = 2 from public.membership_sites),
    'no se pudo ampliar la asignación'
  );
end;
$$;

set local request.jwt.claim.sub = 'c2000000-0000-0000-0000-000000000002';

select pg_temp.check(
  'and the person now sees both branches',
  (select count(*) = 3 from public.employees),
  'vio ' || (select count(*) from public.employees)::text || ', esperaba 3'
);

-- Removing every assignment returns them to unrestricted, not to blind. This is
-- the direction that would be catastrophic to get backwards: an administrator
-- clearing a restriction must not lock somebody out of everything.
set local request.jwt.claim.sub = 'c1000000-0000-0000-0000-000000000001';
delete from public.membership_sites
 where user_id = 'c2000000-0000-0000-0000-000000000002';

set local request.jwt.claim.sub = 'c2000000-0000-0000-0000-000000000002';

select pg_temp.check(
  'clearing every assignment means unrestricted, never blind',
  (select count(*) = 3 from public.employees),
  'quitar la restricción dejó a la persona sin acceso'
);

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
    raise exception '% site-scope assertion(s) failed', v_failed;
  end if;
  raise notice 'all % site-scope assertions passed', (select count(*) from t_result);
end;
$$;

rollback;
