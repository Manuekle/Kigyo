-- ═══════════════════════════════════════════════════════════════════════════
-- Accounts created before the schema existed must be repairable.
--
-- handle_new_user only fires on INSERT, so a signup that happened before
-- migration 01 leaves an auth.users row with no profile, no organization and
-- no membership — an account that authenticates and then loops between
-- /dashboard and /login forever, with nothing to explain why.
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

-- ═══ Fixtures ══════════════════════════════════════════════════════════════

-- Simulates a signup that predates migration 01: the row exists in auth.users,
-- but nothing downstream does.
alter table auth.users disable trigger on_auth_user_created;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'huerfano@antes.test',
   '{"full_name":"Ana Antes","company":"Antes SAS"}'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'sinmeta@antes.test', '{}');

alter table auth.users enable trigger on_auth_user_created;

-- And a normal signup, which the trigger handles.
insert into auth.users (id, email, raw_user_meta_data) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'normal@ahora.test',
   '{"full_name":"Beto Ahora","company":"Ahora SAS"}');

do $$
begin
  perform pg_temp.check(
    'la cuenta previa empieza sin organización',
    (select count(*) = 0 from public.memberships
      where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
    'la fixture no reprodujo el estado huérfano'
  );
end;
$$;

-- ═══ Backfill ══════════════════════════════════════════════════════════════

\o /dev/null
select * from app.backfill_orphan_accounts();
\o

do $$
declare
  v_org uuid;
  v_role text;
begin
  select m.org_id, m.role into v_org, v_role
  from public.memberships m
  where m.user_id = 'aaaaaaaa-0000-4000-8000-000000000001';

  perform pg_temp.check('la cuenta previa queda con organización', v_org is not null, '');
  perform pg_temp.check('y como administradora de ella', v_role = 'Administrador',
                        coalesce(v_role, 'sin rol'));

  perform pg_temp.check(
    'la organización toma el nombre de los metadatos',
    (select o.name = 'Antes SAS' from public.organizations o where o.id = v_org),
    (select o.name from public.organizations o where o.id = v_org)
  );

  perform pg_temp.check(
    'se le otorgan los permisos por defecto',
    (select count(*) > 0 from public.role_permissions rp
      where rp.org_id = v_org and rp.role = 'Administrador'),
    'la organización quedó sin permisos'
  );

  perform pg_temp.check(
    'el perfil se crea con el correo en minúsculas',
    (select p.email = 'huerfano@antes.test'
       from public.profiles p where p.id = 'aaaaaaaa-0000-4000-8000-000000000001'),
    ''
  );
end;
$$;

-- Without metadata the local part of the address has to stand in, otherwise
-- the organization ends up unnamed and the slug check fails.
do $$
declare v_name text;
begin
  select o.name into v_name
  from public.organizations o
  join public.memberships m on m.org_id = o.id
  where m.user_id = 'aaaaaaaa-0000-4000-8000-000000000002';

  perform pg_temp.check('una cuenta sin metadatos también se repara',
                        v_name = 'sinmeta', coalesce(v_name, 'sin organización'));
end;
$$;

-- Slugs are unique, and two organizations can legitimately share a name.
do $$
declare v_slugs int;
begin
  select count(distinct o.slug) into v_slugs from public.organizations o;
  perform pg_temp.check(
    'los slugs siguen siendo únicos',
    v_slugs = (select count(*) from public.organizations),
    'se generó un slug duplicado'
  );
end;
$$;

-- ═══ Idempotence ═══════════════════════════════════════════════════════════

do $$
declare
  v_before int;
  v_repaired int;
  v_after int;
begin
  select count(*) into v_before from public.organizations;
  select count(*) into v_repaired from app.backfill_orphan_accounts();
  select count(*) into v_after from public.organizations;

  -- Re-running must be a no-op: an operator will run this more than once.
  perform pg_temp.check('re-ejecutar no repara nada de nuevo', v_repaired = 0,
                        v_repaired::text || ' cuentas reparadas en la segunda pasada');
  perform pg_temp.check('re-ejecutar no duplica organizaciones', v_before = v_after,
                        v_before::text || ' → ' || v_after::text);
end;
$$;

-- The account that signed up normally must be untouched by any of this.
do $$
begin
  perform pg_temp.check(
    'la cuenta normal conserva una sola organización',
    (select count(*) = 1 from public.memberships
      where user_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
    ''
  );
end;
$$;

-- ═══ Report ════════════════════════════════════════════════════════════════

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
    raise exception '% aserción(es) de backfill fallaron', v_failed;
  end if;
  raise notice 'all % backfill assertions passed', (select count(*) from t_result);
end;
$$;

rollback;
