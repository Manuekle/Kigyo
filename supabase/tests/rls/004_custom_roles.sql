-- ═══════════════════════════════════════════════════════════════════════════
-- Roles belong to the organization (migration 24).
--
-- Three properties, and they pull against each other, which is why they are
-- tested together:
--
--   1. An administrator can invent roles their business actually uses, grant
--      them what they choose, and delete them again. Total control.
--   2. A role is tenant data. One organization can never see, name or hand out
--      another organization's roles — including by creating a role with the
--      same name and expecting the other tenant's grants to come with it.
--   3. No sequence of legal edits can leave the account with nobody able to
--      administer it. Total control stops exactly there, because that is the
--      one outcome the product cannot undo for them.
--
-- Property 3 is also the one most easily broken by making 1 more permissive,
-- so both directions are exercised: revoking the permission from the last role
-- that holds it, and deleting that role outright.
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

grant execute on function pg_temp.check(text, boolean, text) to authenticated;

-- ═══ Fixtures ═══════════════════════════════════════════════════════════════
-- Two clinics. Alfa will grow a «Médico» role; Beta must never see it.

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000024', 'ana@clinica.test',
   '{"full_name":"Ana Alfa","company":"Clínica Alfa"}'),
  ('b0000000-0000-4000-8000-000000000024', 'beto@clinica.test',
   '{"full_name":"Beto Beta","company":"Clínica Beta"}'),
  ('c0000000-0000-4000-8000-000000000024', 'caro@clinica.test',
   '{"full_name":"Caro Alfa","company":"Caro Alfa"}');

select
  (select org_id from public.memberships
     where user_id = 'a0000000-0000-4000-8000-000000000024') as org_a,
  (select org_id from public.memberships
     where user_id = 'b0000000-0000-4000-8000-000000000024') as org_b
\gset

-- Caro joins Alfa. Her own signup organization is dropped rather than her
-- membership deleted — she is its only administrator, and the guard refuses.
delete from public.organizations
 where id in (select org_id from public.memberships
               where user_id = 'c0000000-0000-4000-8000-000000000024');

insert into public.memberships (org_id, user_id, role)
values (:'org_a', 'c0000000-0000-4000-8000-000000000024', 'Empleado');

create temporary table t_fixture (org_a uuid, org_b uuid) on commit drop;
insert into t_fixture values (:'org_a', :'org_b');
grant select on t_fixture to authenticated;

-- Every organization starts with the three seeded roles, and with them only.
select pg_temp.check(
  'a new organization starts with the three seeded roles',
  (select count(*) = 3 and bool_and(is_system)
     from public.roles where org_id = :'org_a'),
  'saw ' || coalesce((select string_agg(key, ', ') from public.roles where org_id = :'org_a'), '∅')
);

\o /dev/null

-- ═══ Ana — administrator of Alfa ════════════════════════════════════════════

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000024';

-- ─── 1. Total control ───────────────────────────────────────────────────────

do $$
declare
  v_org_a uuid;
begin
  select org_a into v_org_a from pg_temp.t_fixture;

  insert into public.roles (org_id, key, label, rank, is_system)
  values (v_org_a, 'Médico', 'Médico', 60, false);

  perform pg_temp.check(
    'an administrator creates a role their business uses',
    exists (select 1 from public.roles r where r.org_id = v_org_a and r.key = 'Médico')
  );

  -- The point of the role: it opens the clinical module and nothing else.
  insert into public.role_permissions (org_id, role, permission) values
    (v_org_a, 'Médico', 'dashboard:read'),
    (v_org_a, 'Médico', 'pacientes:read'),
    (v_org_a, 'Médico', 'pacientes:write');

  perform pg_temp.check(
    'the new role carries exactly the permissions it was given',
    (select count(*) = 3 from public.role_permissions rp
      where rp.org_id = v_org_a and rp.role = 'Médico'),
    'saw ' || (select count(*) from public.role_permissions rp
                where rp.org_id = v_org_a and rp.role = 'Médico')::text
  );

  update public.memberships
     set role = 'Médico'
   where org_id = v_org_a
     and user_id = 'c0000000-0000-4000-8000-000000000024';

  perform pg_temp.check(
    'a person can be moved onto a role the customer invented',
    exists (select 1 from public.memberships m
             where m.user_id = 'c0000000-0000-4000-8000-000000000024'
               and m.role = 'Médico')
  );
end;
$$;

-- ─── 2. A role is tenant data ───────────────────────────────────────────────

select pg_temp.check(
  'Alfa sees only its own roles',
  (select bool_and(org_id = :'org_a') from public.roles),
  'saw roles from ' || (select count(distinct org_id) from public.roles)::text || ' organization(s)'
);

do $$
declare
  v_failed boolean := false;
  v_org_b  uuid;
begin
  select org_b into v_org_b from pg_temp.t_fixture;
  begin
    insert into public.roles (org_id, key, label)
    values (v_org_b, 'Infiltrado', 'Infiltrado');
  exception when insufficient_privilege or check_violation then
    v_failed := true;
  end;
  perform pg_temp.check(
    'creating a role inside another organization is rejected',
    v_failed,
    'the role was written into the other tenant'
  );
end;
$$;

-- A role key is only unique per organization, so both clinics may run a
-- «Médico». What must never happen is the two sharing grants.
do $$
declare
  v_org_a uuid;
  v_org_b uuid;
begin
  select org_a, org_b into v_org_a, v_org_b from pg_temp.t_fixture;
  perform pg_temp.check(
    'a same-named role in another tenant inherits nothing',
    not exists (
      select 1 from public.role_permissions rp
       where rp.org_id = v_org_b and rp.role = 'Médico'
    )
  );
end;
$$;

-- ─── 3. The account can never be left unadministrable ───────────────────────

do $$
declare
  v_failed boolean := false;
  v_org_a  uuid;
begin
  select org_a into v_org_a from pg_temp.t_fixture;
  begin
    delete from public.role_permissions
     where org_id = v_org_a
       and role = 'Administrador'
       and permission = 'configuracion:manage';
  exception when check_violation then
    v_failed := true;
  end;
  perform pg_temp.check(
    'the last role holding configuracion:manage cannot be stripped of it',
    v_failed,
    'the organization was left with nobody able to administer it'
  );
end;
$$;

do $$
declare
  v_failed boolean := false;
  v_org_a  uuid;
begin
  select org_a into v_org_a from pg_temp.t_fixture;
  begin
    delete from public.roles where org_id = v_org_a and key = 'Administrador';
  -- A foreign key violation is the correct refusal too: Ana still holds the
  -- role, and `memberships.role` references it `on delete restrict`.
  exception when check_violation or foreign_key_violation then
    v_failed := true;
  end;
  perform pg_temp.check(
    'the role that administers the account cannot be deleted out from under it',
    v_failed,
    'the administering role was deleted'
  );
end;
$$;

-- ─── Deleting a role people still hold ──────────────────────────────────────

do $$
declare
  v_failed boolean := false;
  v_org_a  uuid;
begin
  select org_a into v_org_a from pg_temp.t_fixture;
  begin
    -- Caro is on «Médico».
    delete from public.roles where org_id = v_org_a and key = 'Médico';
  exception when foreign_key_violation then
    v_failed := true;
  end;
  perform pg_temp.check(
    'a role somebody still holds cannot be deleted',
    v_failed,
    'a person was left with a role that no longer exists'
  );
end;
$$;

do $$
declare
  v_org_a uuid;
begin
  select org_a into v_org_a from pg_temp.t_fixture;

  update public.memberships
     set role = 'Empleado'
   where org_id = v_org_a
     and user_id = 'c0000000-0000-4000-8000-000000000024';

  delete from public.role_permissions
   where org_id = v_org_a and role = 'Médico' and permission = 'configuracion:manage';

  delete from public.roles where org_id = v_org_a and key = 'Médico';

  perform pg_temp.check(
    'an empty role is deleted, and takes its grants with it',
    not exists (select 1 from public.roles r
                 where r.org_id = v_org_a and r.key = 'Médico')
    and not exists (select 1 from public.role_permissions rp
                     where rp.org_id = v_org_a and rp.role = 'Médico'),
    'the role or its grants outlived the delete'
  );
end;
$$;

-- ═══ Caro — a plain Empleado of Alfa ════════════════════════════════════════
-- Reading the role list is fine: it is the vocabulary of her own organization,
-- and the member list already shows it. Writing it is not.

set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-000000000024';

select pg_temp.check(
  'a non-administrator reads the roles of their own organization',
  (select count(*) >= 3 from public.roles),
  'saw ' || (select count(*) from public.roles)::text
);

do $$
declare
  v_failed boolean := false;
  v_org_a  uuid;
begin
  select org_a into v_org_a from pg_temp.t_fixture;
  begin
    insert into public.roles (org_id, key, label)
    values (v_org_a, 'Todopoderoso', 'Todopoderoso');
  exception when insufficient_privilege or check_violation then
    v_failed := true;
  end;
  perform pg_temp.check(
    'a non-administrator cannot create a role',
    v_failed,
    'anyone could mint themselves a role'
  );
end;
$$;

do $$
declare
  v_changed int := 0;
  v_org_a   uuid;
begin
  select org_a into v_org_a from pg_temp.t_fixture;
  update public.role_permissions
     set permission = 'nomina:read'
   where org_id = v_org_a and role = 'Empleado' and permission = 'dashboard:read';
  get diagnostics v_changed = row_count;
  perform pg_temp.check(
    'a non-administrator cannot grant themselves a permission',
    v_changed = 0,
    v_changed::text || ' grant(s) were rewritten'
  );
exception when insufficient_privilege or check_violation then
  perform pg_temp.check('a non-administrator cannot grant themselves a permission', true);
end;
$$;

-- ═══ Handing administration over ════════════════════════════════════════════
-- Last, because it is the one edit that ends with Ana no longer administering
-- anything — which is the point. An organization must be able to move
-- administration onto a role of its own naming, and the guard must allow it
-- precisely because somebody else still holds the permission afterwards.

set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000024';

do $$
declare
  v_org_a uuid;
begin
  select org_a into v_org_a from pg_temp.t_fixture;

  insert into public.roles (org_id, key, label, rank, is_system)
  values (v_org_a, 'Dirección', 'Dirección', 15, false);

  insert into public.role_permissions (org_id, role, permission)
  values (v_org_a, 'Dirección', 'configuracion:manage');

  update public.memberships
     set role = 'Dirección'
   where org_id = v_org_a
     and user_id = 'c0000000-0000-4000-8000-000000000024';

  delete from public.role_permissions
   where org_id = v_org_a
     and role = 'Administrador'
     and permission = 'configuracion:manage';

  perform pg_temp.check(
    'administration can be handed to a role the customer named',
    not exists (
      select 1 from public.role_permissions rp
       where rp.org_id = v_org_a and rp.role = 'Administrador'
         and rp.permission = 'configuracion:manage'
    ),
    'the handover was refused even though somebody else still administers'
  );
end;
$$;

-- And the person who received it really did: `app.is_org_admin` asks the
-- permission, not the name, so «Dirección» administers and «Administrador» —
-- now stripped — does not.
set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-000000000024';

do $$
declare
  v_org_a uuid;
begin
  select org_a into v_org_a from pg_temp.t_fixture;
  insert into public.roles (org_id, key, label) values (v_org_a, 'Recepción', 'Recepción');
  perform pg_temp.check(
    'the new administering role really administers',
    exists (select 1 from public.roles r where r.org_id = v_org_a and r.key = 'Recepción')
  );
end;
$$;

set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000024';

do $$
declare
  v_failed boolean := false;
  v_org_a  uuid;
begin
  select org_a into v_org_a from pg_temp.t_fixture;
  begin
    insert into public.roles (org_id, key, label) values (v_org_a, 'Auditor', 'Auditor');
  exception when insufficient_privilege or check_violation then
    v_failed := true;
  end;
  perform pg_temp.check(
    'a role named Administrador administers nothing once stripped',
    v_failed,
    'the name still carried authority after the permission was removed'
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
    raise exception '% role assertion(s) failed', v_failed;
  end if;
  raise notice 'all % role assertions passed', (select count(*) from t_result);
end;
$$;

rollback;
