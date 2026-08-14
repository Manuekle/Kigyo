-- ═══════════════════════════════════════════════════════════════════════════
-- Creating a company, and joining one.
--
-- Two functions with a lot of privilege between them. `public.create_company`
-- spends a plan slot; `public.join_company` grants its caller access to a whole
-- company's data. Both are SECURITY DEFINER, so both run past every policy on
-- the tables they touch, and both derive who the caller is from `auth.uid()`
-- rather than taking it as an argument.
--
-- What the assertions are for, in order of how much they would cost to get
-- wrong:
--
--   1. joining must be impossible for a company outside the caller's account —
--      otherwise the function is a way into any tenant in the database;
--   2. joining must be visible in the audit log OF THE COMPANY ENTERED — an
--      owner who arrives silently is indistinguishable from one who inherited,
--      which is the thing decision M4 refused;
--   3. the plan's company limit must hold against the database, not just
--      against the screen;
--   4. a provisioned company must be complete — roles, membership and grants —
--      because a company missing any of them is broken in a way that only
--      shows up when somebody tries to use it.
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
-- Gala owns an account. Hugo owns a different one. Iris works for Gala's
-- company but governs nothing.

insert into auth.users (id, email, raw_user_meta_data) values
  ('9a000000-0000-0000-0000-00000000000a', 'gala@grupo.test',
   '{"full_name":"Gala Grupo","company":"Clínica Sur","company_type":"salud"}'),
  ('9b000000-0000-0000-0000-00000000000b', 'hugo@otro.test',
   '{"full_name":"Hugo Otro","company":"Otra SA"}');

select
  (select org_id from public.memberships
     where user_id = '9a000000-0000-0000-0000-00000000000a') as org_gala,
  (select org_id from public.memberships
     where user_id = '9b000000-0000-0000-0000-00000000000b') as org_hugo
\gset

select (select account_id from public.organizations where id = :'org_gala') as acct_gala \gset

/*
 * Iris arrives by invitation, which is the realistic way an employee exists.
 *
 * The obvious shortcut — sign her up normally, then delete the company that
 * created — does NOT produce an employee who governs nothing: `handle_new_user`
 * gives every ordinary signup an account of their own, and deleting the company
 * leaves that account behind, empty but still hers. She would still be able to
 * create a company, and the assertion below would fail for a reason that has
 * nothing to do with what it is testing.
 *
 * The invitation branch creates no account at all, which is the shape of a real
 * employee.
 */
insert into public.invitations (org_id, email, role, token_hash, expires_at)
values (:'org_gala', 'iris@grupo.test', 'Empleado', 'hash-iris', now() + interval '7 days');

insert into auth.users (id, email, raw_user_meta_data) values
  ('9c000000-0000-0000-0000-00000000000c', 'iris@grupo.test',
   '{"full_name":"Iris Grupo"}');

do $$
begin
  perform pg_temp.check(
    'an invited employee gets no account of their own',
    (select count(*) = 0 from public.account_memberships
      where user_id = '9c000000-0000-0000-0000-00000000000c')
    and (select count(*) = 1 from public.memberships
          where user_id = '9c000000-0000-0000-0000-00000000000c'),
    'la invitación creó una cuenta comercial'
  );
end;
$$;

create temporary table t_fixture (org_gala uuid, org_hugo uuid, acct_gala uuid) on commit drop;
insert into t_fixture values (:'org_gala', :'org_hugo', :'acct_gala');
grant select on t_fixture to authenticated, anon;

-- ═══ Signup still builds a complete company ═════════════════════════════════
-- `handle_new_user` now delegates to `app.provision_company`. If that
-- extraction dropped one of the four writes, every new customer would get a
-- company that is subtly broken, and no other test in the suite would notice.

do $$
declare v_org uuid;
begin
  select org_gala into v_org from pg_temp.t_fixture;

  perform pg_temp.check(
    'signup seeds the three roles',
    (select count(*) = 3 from public.roles where org_id = v_org),
    (select count(*) from public.roles where org_id = v_org)::text || ' roles'
  );
  perform pg_temp.check(
    'signup grants the creator every permission',
    (select count(*) from public.role_permissions
      where org_id = v_org and role = 'Administrador')
      = (select count(*) from public.permissions),
    'el administrador no recibió el catálogo completo'
  );
  perform pg_temp.check(
    'signup keeps the sector the customer picked',
    (select company_type = 'salud' from public.organizations where id = v_org),
    'el sector no sobrevivió a provision_company'
  );
end;
$$;

-- An unrecognised sector must not abort signup. It is a suggestion, and the
-- customer can pick a real one in Configuración.
insert into auth.users (id, email, raw_user_meta_data) values
  ('9d000000-0000-0000-0000-00000000000d', 'javi@raro.test',
   '{"full_name":"Javi Raro","company":"Rara SA","company_type":"minería-espacial"}');

do $$
begin
  perform pg_temp.check(
    'an unknown sector is dropped rather than aborting signup',
    (select count(*) = 1 from public.memberships
      where user_id = '9d000000-0000-0000-0000-00000000000d')
    and (select company_type is null from public.organizations o
          join public.memberships m on m.org_id = o.id
         where m.user_id = '9d000000-0000-0000-0000-00000000000d'),
    'el sector inválido rompió el alta o se guardó'
  );
end;
$$;

\o /dev/null

-- ═══ Gala — owner of her account ════════════════════════════════════════════

set local role authenticated;
set local request.jwt.claim.sub = '9a000000-0000-0000-0000-00000000000a';

-- ─── The plan limit, from the database's side ───────────────────────────────
-- Signup put her on Starter, which allows one company. She already has it.

do $$
declare v_failed boolean := false;
begin
  begin
    perform public.create_company('Segunda Empresa', null);
  exception when check_violation then
    v_failed := true;
  end;
  perform pg_temp.check('Starter refuses a second company', v_failed,
                        'el límite de empresas del plan no se aplicó');
end;
$$;

select pg_temp.check(
  'the refused company was not created',
  (select count(*) = 0 from public.organizations where name = 'Segunda Empresa'),
  'quedó una empresa a medio crear'
);

-- The plan moves as billing would move it, past the guard that stops customers
-- doing it themselves.
reset role;
update public.accounts set plan = 'growth' where id = :'acct_gala';
set local role authenticated;
set local request.jwt.claim.sub = '9a000000-0000-0000-0000-00000000000a';

select public.create_company('Restaurante Sur', 'alimentos') as org_new \gset

select pg_temp.check(
  'a bigger plan allows the second company',
  (select count(*) = 1 from public.organizations
    where id = :'org_new' and company_type = 'alimentos'),
  'la segunda empresa no se creó'
);

select pg_temp.check(
  'the creator administers the company they created',
  (select count(*) = 1 from public.memberships
    where org_id = :'org_new'
      and user_id = '9a000000-0000-0000-0000-00000000000a'
      and role = 'Administrador'),
  'quien creó la empresa no quedó dentro'
);

select pg_temp.check(
  'a created company is complete: roles and grants',
  (select count(*) = 3 from public.roles where org_id = :'org_new')
  and (select count(*) > 0 from public.role_permissions
        where org_id = :'org_new' and role = 'Administrador'),
  'la empresa nueva quedó sin roles o sin permisos'
);

select pg_temp.check(
  'the new company lands in the same account',
  (select account_id = (select acct_gala from pg_temp.t_fixture)
     from public.organizations where id = :'org_new'),
  'la empresa nueva quedó en otra cuenta'
);

-- Growth allows three. The third is fine; the fourth is not.
--
-- Its id is captured here and read from the fixture table later. Once Gala is
-- removed from this company, RLS stops her seeing the row at all — so looking
-- it up by name from inside an assertion would silently yield NULL and turn
-- every check that used it into a check of nothing.
select public.create_company('Tercera Sur', null) as org_third \gset

do $$
declare v_failed boolean := false;
begin
  begin
    perform public.create_company('Cuarta Sur', null);
  exception when check_violation then
    v_failed := true;
  end;
  perform pg_temp.check('the limit is the plan''s number, not merely "more than one"',
                        v_failed, 'Growth aceptó una cuarta empresa');
end;
$$;

-- ═══ Iris — works here, governs nothing ═════════════════════════════════════

set local request.jwt.claim.sub = '9c000000-0000-0000-0000-00000000000c';

do $$
declare v_failed boolean := false;
begin
  begin
    perform public.create_company('Empresa de Iris', null);
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.check('an employee cannot create a company', v_failed,
                        'un Empleado gastó un cupo del plan');
end;
$$;

do $$
declare
  v_failed boolean := false;
  v_new    uuid;
begin
  select id into v_new from public.organizations where name = 'Restaurante Sur';
  begin
    perform public.join_company(v_new, 'Administrador');
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.check('an employee cannot join a sibling company', v_failed,
                        'FUGA: un Empleado se unió a otra empresa del grupo');
end;
$$;

-- ═══ Joining: the audited way in (decision M4) ══════════════════════════════

set local request.jwt.claim.sub = '9a000000-0000-0000-0000-00000000000a';

-- Gala created the restaurant, so she is already in it. Build one she is not
-- in: a company of her account run entirely by somebody else.
--
-- Iris is made its administrator *before* Gala is removed. The order is forced
-- by the lockout guard from migration 24, which refuses any statement leaving a
-- company with nobody holding `configuracion:manage` — and it is right to: a
-- company whose only administrator walks out is unreachable from the product.
reset role;
insert into public.memberships (org_id, user_id, role)
values (:'org_third', '9c000000-0000-0000-0000-00000000000c', 'Administrador');
delete from public.memberships
 where org_id = :'org_third'
   and user_id = '9a000000-0000-0000-0000-00000000000a';

create temporary table t_third (org_id uuid) on commit drop;
insert into t_third values (:'org_third');
grant select on t_third to authenticated, anon;

set local role authenticated;
set local request.jwt.claim.sub = '9a000000-0000-0000-0000-00000000000a';

-- The premise, asserted against the id rather than against a name lookup that
-- would return NULL for exactly the reason being tested. Owning the account is
-- not membership: the company she created and then left is now invisible to
-- her, which is decision M4 holding.
select pg_temp.check(
  'an account owner cannot see a company of their account they left',
  (select count(*) = 0 from public.organizations
    where id = (select org_id from pg_temp.t_third)),
  'el dueño de la cuenta sigue viendo una empresa que no integra'
);

-- ─── Listing the account's companies ────────────────────────────────────────
-- The privileged read that lets the "Empresas" screen offer a company the owner
-- has not joined. Privileged reads are where isolation goes to die, so what it
-- must NOT return is asserted alongside what it must.

do $$
declare v_far uuid;
begin
  select org_hugo into v_far from pg_temp.t_fixture;

  perform pg_temp.check(
    'the owner can list every company of their account, joined or not',
    (select count(*) = 3 from public.account_companies()),
    'listó ' || (select count(*) from public.account_companies())::text || ' empresas'
  );

  -- Asserted here, before she rejoins, precisely so the flag has something to
  -- distinguish. Run after the join it would read 3 of 3 and be indistinguishable
  -- from the assertion above it.
  perform pg_temp.check(
    'the listing marks which ones the caller is actually inside',
    (select count(*) = 2 from public.account_companies() where joined)
    and (select count(*) = 1 from public.account_companies() where not joined),
    'la marca de pertenencia no distingue la empresa que dejó'
  );

  perform pg_temp.check(
    'the listing never reaches another account',
    (select count(*) = 0 from public.account_companies() c where c.org_id = v_far),
    'FUGA: account_companies devolvió una empresa de otra cuenta'
  );
end;
$$;

set local request.jwt.claim.sub = '9c000000-0000-0000-0000-00000000000c';

select pg_temp.check(
  'somebody who governs no account lists nothing',
  (select count(*) = 0 from public.account_companies()),
  'un Empleado obtuvo el listado de empresas de la cuenta'
);

set local request.jwt.claim.sub = '9a000000-0000-0000-0000-00000000000a';


do $$
declare
  v_org uuid;
begin
  select org_id into v_org from pg_temp.t_third;

  perform pg_temp.check(
    'an account owner may join a company of their account',
    public.join_company(v_org, 'Empleado') = true,
    'el dueño de la cuenta no pudo unirse'
  );

  perform pg_temp.check(
    'joining takes the role that was asked for, not the highest one',
    (select role = 'Empleado' from public.memberships
      where org_id = v_org and user_id = '9a000000-0000-0000-0000-00000000000a'),
    'unirse concedió un rol distinto del solicitado'
  );

  perform pg_temp.check(
    'joining twice reports "already inside" rather than joining again',
    public.join_company(v_org, 'Empleado') = false,
    'un segundo intento se comportó como una llegada nueva'
  );

  perform pg_temp.check(
    'joining at a role the company does not define is refused',
    (select count(*) = 0 from public.roles
      where org_id = v_org and key = 'Cirujano Jefe'),
    'la premisa del siguiente caso no se cumple'
  );
end;
$$;

-- ─── The assertion that makes decision M4 honest ────────────────────────────
--
-- Checked as Iris, who administers this company, and NOT as Gala, who just
-- walked into it. Gala joined as an Empleado, and that role does not carry
-- `trazabilidad:read` — so asking her whether the arrival was logged tests her
-- permissions, not the log. It would also be the wrong question: the promise is
-- that an owner letting themselves in is visible to *the people who work here*.

set local request.jwt.claim.sub = '9c000000-0000-0000-0000-00000000000c';

do $$
declare v_org uuid;
begin
  select org_id into v_org from pg_temp.t_third;

  perform pg_temp.check(
    'the company sees, in its own trazabilidad, that the account owner let themselves in',
    (select count(*) = 1 from public.audit_log
      where org_id      = v_org
        and table_name  = 'memberships'
        and record_code = 'unirse a la empresa'
        and actor_id    = '9a000000-0000-0000-0000-00000000000a'),
    'la llegada del dueño no es visible para quien administra la empresa'
  );

  perform pg_temp.check(
    'the log records the role taken and how it was taken',
    (select changes ->> 'role' = 'Empleado'
        and changes ->> 'via'  = 'administración de la cuenta'
       from public.audit_log
      where org_id = v_org and record_code = 'unirse a la empresa'
      limit 1),
    'el registro no dice con qué rol ni por qué vía'
  );

  perform pg_temp.check(
    'joining twice does not read as two arrivals',
    (select count(*) = 1 from public.audit_log
      where org_id = v_org and record_code = 'unirse a la empresa'),
    'un segundo intento duplicó el registro'
  );
end;
$$;

set local request.jwt.claim.sub = '9a000000-0000-0000-0000-00000000000a';

do $$
declare
  v_failed boolean := false;
  v_org    uuid;
begin
  select org_id into v_org from pg_temp.t_third;
  begin
    -- A role belonging to no company at all. Roles are per company since
    -- migration 24, so this must be refused with a sentence rather than an
    -- opaque foreign-key error.
    perform public.join_company(v_org, 'Cirujano Jefe');
  exception when check_violation then
    v_failed := true;
  end;
  perform pg_temp.check('an undefined role is refused', v_failed,
                        'se aceptó un rol que la empresa no define');
end;
$$;

-- ─── The refusal that matters most ──────────────────────────────────────────
-- Hugo's company belongs to a different account entirely. If `join_company`
-- confirmed it, the function would be a way into any tenant in the database.

do $$
declare
  v_failed boolean := false;
  v_far    uuid;
begin
  select org_hugo into v_far from pg_temp.t_fixture;
  begin
    perform public.join_company(v_far, 'Administrador');
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.check('joining a company outside your account is refused', v_failed,
                        'FUGA: join_company aceptó un tenant ajeno');
end;
$$;

do $$
declare
  v_failed boolean := false;
begin
  begin
    perform public.join_company('00000000-0000-0000-0000-000000000000'::uuid, 'Administrador');
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.check('a company that does not exist is refused the same way', v_failed,
                        'una empresa inexistente se distingue de una ajena');
end;
$$;

-- ═══ Anonymous ══════════════════════════════════════════════════════════════

set local role anon;
set local request.jwt.claim.sub = '';

do $$
declare
  v_denied int := 0;
begin
  begin
    perform public.create_company('Anónima SA', null);
  exception when insufficient_privilege then
    v_denied := v_denied + 1;
  end;
  begin
    perform public.join_company('00000000-0000-0000-0000-000000000000'::uuid, 'Administrador');
  exception when insufficient_privilege then
    v_denied := v_denied + 1;
  end;
  perform pg_temp.check('anonymous can neither create nor join', v_denied = 2,
                        v_denied::text || '/2 rechazos');
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
    raise exception '% company-creation assertion(s) failed', v_failed;
  end if;
  raise notice 'all % company-creation assertions passed', (select count(*) from t_result);
end;
$$;

rollback;
