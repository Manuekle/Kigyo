-- ═══════════════════════════════════════════════════════════════════════════
-- Varios grupos por persona.
--
-- `public.create_account` is the second function in the schema that can bring
-- an `accounts` row into existence — the first is the signup trigger — and it
-- runs SECURITY DEFINER, past the deliberate absence of an INSERT policy on
-- that table. So the assertions are about what it must never let through:
--
--   1. the new group always starts on the entry tier. A customer who could
--      choose a plan at creation would never need to pay for one;
--   2. it builds a *complete* company — roles, membership, grants — the same
--      way signup does, because a group whose only company is broken is worse
--      than no group;
--   3. the caller becomes owner of the new group and of nothing else;
--   4. the cap holds;
--   5. and `create_company` now takes an account id, which means it must
--      refuse one the caller does not govern. That parameter is the whole
--      reason this migration needed a test: before it, the account was derived
--      from `auth.uid()` and could not be pointed at somebody else's group.
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

/**
 * Counts an account's companies from outside RLS.
 *
 * Needed because the interesting question here is about a group the caller
 * cannot see: `organizations_select` shows Rita only the companies she is a
 * member of, so asking her session "how many companies does Saúl's account
 * have" answers zero whether or not the intrusion worked. That is a test that
 * passes for the wrong reason, which is worse than one that fails.
 */
create or replace function pg_temp.company_count(p_account uuid)
returns int language sql security definer as $$
  select count(*)::int from public.organizations where account_id = p_account;
$$;

grant execute on function pg_temp.company_count(uuid) to authenticated, anon;

-- ═══ Fixtures ═══════════════════════════════════════════════════════════════
-- Rita owns one group. Saúl owns another, unrelated one.

insert into auth.users (id, email, raw_user_meta_data) values
  ('d1000000-0000-0000-0000-000000000001', 'rita@grupo.test',
   '{"full_name":"Rita Grupo","company":"Hotel Rita","company_type":"hoteleria"}'),
  ('d2000000-0000-0000-0000-000000000002', 'saul@otro.test',
   '{"full_name":"Saúl Otro","company":"Otro Grupo"}');

select
  (select org_id from public.memberships
     where user_id = 'd1000000-0000-0000-0000-000000000001') as org_rita,
  (select org_id from public.memberships
     where user_id = 'd2000000-0000-0000-0000-000000000002') as org_saul
\gset

select
  (select account_id from public.organizations where id = :'org_rita') as acct_rita,
  (select account_id from public.organizations where id = :'org_saul') as acct_saul
\gset

create temporary table t_fixture (org_rita uuid, acct_rita uuid, acct_saul uuid) on commit drop;
insert into t_fixture values (:'org_rita', :'acct_rita', :'acct_saul');
grant select on t_fixture to authenticated, anon;

-- ═══ Rita creates a second group ════════════════════════════════════════════

\o /dev/null
set local role authenticated;
set local request.jwt.claim.sub = 'd1000000-0000-0000-0000-000000000001';

do $$
declare
  v_org      uuid;
  v_account  uuid;
  v_acct_old uuid;
begin
  select acct_rita into v_acct_old from pg_temp.t_fixture;

  v_org := public.create_account('Mi Startup', 'Startup SAS', 'tecnologia');
  select account_id into v_account from public.organizations where id = v_org;

  perform pg_temp.check(
    'the new group is a different account',
    v_account is not null and v_account <> v_acct_old,
    'la empresa nueva quedó en la cuenta vieja'
  );

  -- The one that pays for itself. A customer able to name the tier at creation
  -- has no reason ever to buy one.
  perform pg_temp.check(
    'and it starts on the entry tier',
    (select plan = 'starter' from public.accounts where id = v_account),
    'la cuenta nueva no nació en starter'
  );

  perform pg_temp.check(
    'the caller owns it',
    (select role = 'owner' from public.account_memberships
      where account_id = v_account
        and user_id = 'd1000000-0000-0000-0000-000000000001'),
    'quien creó la cuenta no quedó como owner'
  );

  -- Signup and this path go through the same app.provision_company, so a group
  -- created here cannot be shaped differently from one created by signing up.
  perform pg_temp.check(
    'its first company is complete: roles, membership and grants',
    (select count(*) = 3 from public.roles where org_id = v_org)
    and (select count(*) = 1 from public.memberships where org_id = v_org)
    and (select count(*) > 0 from public.role_permissions
          where org_id = v_org and role = 'Administrador'),
    'la primera empresa quedó a medio construir'
  );

  perform pg_temp.check(
    'the sector it was asked for stuck',
    (select company_type = 'tecnologia' from public.organizations where id = v_org),
    'el sector se perdió'
  );

  -- Onboarding is a question already answered: pushing somebody back through
  -- the wizard for their second group would be asking it again.
  perform pg_temp.check(
    'and it is not sent back through the setup wizard',
    (select onboarding_completed_at is not null from public.accounts where id = v_account),
    'la cuenta nueva quedó marcada como no configurada'
  );

  perform pg_temp.check(
    'the old group is untouched',
    (select count(*) = 1 from public.organizations where account_id = v_acct_old),
    'crear una cuenta movió empresas de la cuenta anterior'
  );
end;
$$;

-- ═══ Starter still allows one company per group ═════════════════════════════

do $$
declare v_failed boolean := false;
begin
  -- Rita's original group is on starter and already has Hotel Rita, so this is
  -- the limit doing its job — the second group changes nothing about the first.
  begin
    perform public.create_company('Hotel Dos', 'hoteleria',
                                  (select acct_rita from pg_temp.t_fixture));
  exception when check_violation then
    v_failed := true;
  end;
  perform pg_temp.check('the plan limit still holds per group', v_failed,
                        'starter aceptó una segunda empresa');
end;
$$;

-- ═══ And an account somebody else governs is not a target ═══════════════════

do $$
declare v_failed boolean := false;
begin
  begin
    perform public.create_company('Empresa Intrusa', null,
                                  (select acct_saul from pg_temp.t_fixture));
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.check(
    'a company cannot be created inside somebody else''s group',
    v_failed,
    'se creó una empresa en una cuenta ajena: el parámetro es explotable'
  );

  perform pg_temp.check(
    'and that group gained nothing',
    pg_temp.company_count((select acct_saul from pg_temp.t_fixture)) = 1,
    'la cuenta ajena terminó con una empresa de más'
  );
end;
$$;

-- ═══ The cap ════════════════════════════════════════════════════════════════
--
-- Ten owned groups is far past any real customer and far short of useful to a
-- script. Rita already owns two, so eight more reach it.

do $$
declare
  v_failed boolean := false;
  i int;
begin
  for i in 1..8 loop
    perform public.create_account('Grupo ' || i, 'Empresa ' || i, null);
  end loop;

  begin
    perform public.create_account('Uno de más', 'Empresa de más', null);
  exception when check_violation then
    v_failed := true;
  end;

  perform pg_temp.check('the account cap holds', v_failed,
                        'se pudo crear una cuenta por encima del tope');
  perform pg_temp.check(
    'and stops exactly at ten',
    (select count(*) = 10 from public.account_memberships
      where user_id = 'd1000000-0000-0000-0000-000000000001' and role = 'owner'),
    'el tope no cortó donde dice'
  );
end;
$$;

-- ═══ Anonymous creates nothing ══════════════════════════════════════════════

reset role;
set local role anon;
set local request.jwt.claim.sub = '';

do $$
declare v_failed boolean := false;
begin
  begin
    perform public.create_account('Cuenta anónima', 'Empresa anónima', null);
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.check('anonymous cannot create a group', v_failed,
                        'anon ejecutó create_account');
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
    raise exception '% multi-account assertion(s) failed', v_failed;
  end if;
  raise notice 'all % multi-account assertions passed', (select count(*) from t_result);
end;
$$;

rollback;
