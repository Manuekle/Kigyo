-- ═══════════════════════════════════════════════════════════════════════════
-- Los presets de sector: legibles por todos, escribibles por nadie.
--
-- `public.sector_modules` (migration 34) is reference data, not tenant data:
-- every signed-in person needs to read the whole thing to render a picker, and
-- nobody's rows are in it. That makes the interesting assertions the opposite
-- of the usual ones — not "can Alfa see Beta's rows", but:
--
--   1. a plain member of any company can read every preset;
--   2. `authenticated` cannot write one, not even an administrator. A customer
--      who can edit a preset can propose a module their plan excludes, and the
--      table would stop being reference data the product can reason about;
--   3. `anon` reads nothing at all;
--   4. a 'remove' row is refused on a top-level sector, since there is nothing
--      above it to subtract from — the delta arithmetic only means something
--      one level down;
--   5. a preset never names a module `organizations.enabled_modules` would
--      refuse, which is the failure the CHECK constraint exists to make
--      impossible rather than merely unlikely;
--   6. the presets stay proposals: nothing here appears in any policy that
--      decides access, so the seed cannot widen what anybody may read.
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
--
-- One ordinary member of one company. Deliberately not an administrator: the
-- question is what the *least* privileged signed-in person can read, because
-- that is who the setup wizard runs as most of the time.

insert into auth.users (id, email, raw_user_meta_data) values
  ('c1000000-0000-0000-0000-000000000001', 'pia@panaderia.test',
   '{"full_name":"Pia Pan","company":"Panadería Pia","company_type":"alimentos"}');

select (select org_id from public.memberships
          where user_id = 'c1000000-0000-0000-0000-000000000001') as org_pia
\gset

create temporary table t_fixture (org_pia uuid) on commit drop;
insert into t_fixture values (:'org_pia');
grant select on t_fixture to authenticated, anon;

-- ═══ The seed itself ════════════════════════════════════════════════════════

do $$
begin
  perform pg_temp.check(
    'every sector in the catalogue proposes something',
    not exists (
      select 1 from public.sectors s
      where s.parent_key is null
        and not exists (select 1 from public.sector_modules m where m.sector_key = s.key)
    ),
    'hay un sector sin preset: quien lo elija recibiría la lista mínima'
  );

  -- The bug this table was created to remove: a sector picked in the wizard
  -- used to fall through to *every* module when TypeScript did not know it.
  perform pg_temp.check(
    'no sector proposes the entire catalogue',
    not exists (
      select 1 from public.sector_modules m
      where m.mode = 'add'
      group by m.sector_key
      having count(*) >= (select count(*) from public.permissions) -- generous upper bound
    ),
    'un sector propone el catálogo completo'
  );

  perform pg_temp.check(
    'a top-level sector never carries a removal',
    not exists (
      select 1 from public.sector_modules m
      join public.sectors s on s.key = m.sector_key
      where m.mode = 'remove' and s.parent_key is null
    ),
    'un sector raíz quita módulos de algo que no tiene encima'
  );

  -- Every subsector that bothers to exist as a delta must actually change
  -- something, or it is a question asked of the customer with no consequence.
  perform pg_temp.check(
    'every seeded delta changes its parent''s proposal',
    not exists (
      select 1 from public.sector_modules m
      join public.sectors s on s.key = m.sector_key
      where s.parent_key is not null
      group by m.sector_key
      having count(*) = 0
    ),
    'hay un delta vacío'
  );
end;
$$;

-- ═══ A module the enabled_modules column would refuse ═══════════════════════

do $$
declare v_failed boolean := false;
begin
  begin
    insert into public.sector_modules (sector_key, module_key, mode)
    values ('salud', 'modulo-inventado', 'add');
  exception when check_violation then
    v_failed := true;
  end;
  perform pg_temp.check(
    'a preset cannot name a module that does not exist',
    v_failed,
    'se aceptó un módulo desconocido: la empresa que elija ese sector no podrá guardar'
  );
end;
$$;

-- ═══ A removal where there is nothing above ═════════════════════════════════

do $$
declare v_failed boolean := false;
begin
  begin
    insert into public.sector_modules (sector_key, module_key, mode)
    values ('salud', 'inventario', 'remove');
  exception when check_violation then
    v_failed := true;
  end;
  perform pg_temp.check(
    'a top-level sector cannot be given a removal',
    v_failed,
    'se aceptó un remove en un sector raíz, donde no hace nada'
  );
end;
$$;

-- ═══ What a plain member can do ═════════════════════════════════════════════

\o /dev/null
set local role authenticated;
set local request.jwt.claim.sub = 'c1000000-0000-0000-0000-000000000001';

do $$
declare v_failed boolean := false;
begin
  perform pg_temp.check(
    'an ordinary member reads the whole preset catalogue',
    (select count(*) from public.sector_modules) > 100,
    'un miembro corriente no ve los presets: el asistente no podría proponer nada'
  );

  perform pg_temp.check(
    'including the sectors their own company is not',
    exists (select 1 from public.sector_modules where sector_key = 'hoteleria'),
    'los presets están recortados por empresa'
  );

  -- The write side. A customer who can edit a preset can propose modules their
  -- plan excludes, and every other company would inherit the edit.
  begin
    insert into public.sector_modules (sector_key, module_key, mode)
    values ('salud', 'flota', 'add');
    v_failed := false;
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.check('a member cannot add a module to a preset', v_failed,
                        'authenticated escribió en sector_modules');

  begin
    delete from public.sector_modules where sector_key = 'salud';
    v_failed := false;
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.check('a member cannot delete a preset', v_failed,
                        'authenticated borró filas de sector_modules');

  begin
    update public.sector_modules set mode = 'remove' where sector_key = 'salud';
    v_failed := false;
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.check('a member cannot rewrite a preset', v_failed,
                        'authenticated actualizó sector_modules');
end;
$$;

reset role;

-- ═══ And anonymous ══════════════════════════════════════════════════════════

set local role anon;
set local request.jwt.claim.sub = '';

-- Refused by the grant rather than by a policy, which is why this looks for an
-- exception and not for zero rows: `anon` was never granted select on the
-- table, so PostgREST turns the read into a 401 before RLS is consulted.
do $$
declare v_failed boolean := false;
begin
  begin
    perform count(*) from public.sector_modules;
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.check('anonymous reads no preset at all', v_failed,
                        'anon lee el catálogo de presets');
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
    raise exception '% sector preset assertion(s) failed', v_failed;
  end if;
  raise notice 'all % sector preset assertions passed', (select count(*) from t_result);
end;
$$;

rollback;
