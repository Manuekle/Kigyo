-- ═══════════════════════════════════════════════════════════════════════════
-- The account scope, and the one thing it must NOT do.
--
-- Kigyo is multi-company: `public.accounts` is the commercial account and
-- `public.organizations` is the operating company beneath it. An account can
-- own several companies, and the whole point of the design is that owning the
-- account is **not** a way into the companies' data.
--
-- The central assertion is `owner of the account sees nothing in a company they
-- did not join`. Everything else here defends the edges of that: the plan has
-- to be readable (the product gates modules on it), the billing references must
-- not be, and neither may be reached by someone outside the group.
--
-- Written before the migration that adds these tables, so the assertions
-- describe the contract rather than the implementation.
-- Contract: docs/FASE_0_CONTRATOS.md §9.
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
-- Three independent signups. Each builds an account, a company, an
-- Administrador membership and an owner account_membership.

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ana@grupo.test',
   '{"full_name":"Ana Grupo","company":"Clínica del Grupo"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'beto@grupo.test',
   '{"full_name":"Beto Grupo","company":"Restaurante del Grupo"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'caro@ajena.test',
   '{"full_name":"Caro Ajena","company":"Empresa Ajena"}');

select
  (select org_id from public.memberships
     where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') as org_a,
  (select org_id from public.memberships
     where user_id = 'bbbbbbbb-0000-0000-0000-000000000002') as org_b,
  (select org_id from public.memberships
     where user_id = 'cccccccc-0000-0000-0000-000000000003') as org_c
\gset

select
  (select account_id from public.organizations where id = :'org_a') as acct_a,
  (select account_id from public.organizations where id = :'org_c') as acct_c
\gset

-- Build the group: account A ends up owning BOTH companies.
--
-- The plan comes first. Migration 28 caps companies per account (Starter
-- allows one), and a group that runs two businesses is by definition on a plan
-- that permits two — so this is the fixture becoming more realistic, not the
-- limit being worked around.
update public.accounts set plan = 'growth' where id = :'acct_a';

-- Order matters. `organizations.account_id` cascades on delete, so company B
-- has to be re-pointed at account A *before* account B is removed — otherwise
-- dropping the account takes the company with it.
update public.organizations set account_id = :'acct_a' where id = :'org_b';

delete from public.accounts
 where id not in (:'acct_a', :'acct_c');

-- Ana now owns an account with two companies and is a member of only one.
-- Beto is a member of company B and of no account at all: his owner row went
-- with the account that was folded into the group. That is exactly the shape
-- the "unirme a esta empresa" flow has to work against.

insert into public.employees (org_id, full_name, position, department) values
  (:'org_a', 'Médico de la Clínica', 'Médico',  'Asistencial'),
  (:'org_b', 'Mesero del Restaurante', 'Mesero', 'Salón');

insert into public.tickets (org_id, subject, area) values
  (:'org_a', 'Ticket Clínica',     'TI'),
  (:'org_b', 'Ticket Restaurante', 'TI');

insert into public.documents (org_id, name) values
  (:'org_a', 'Historia clínica'),
  (:'org_b', 'Carta del menú');

update public.accounts
   set billing_customer_id = 'cus_secreto_del_grupo',
       billing_status      = 'active'
 where id = :'acct_a';

create temporary table t_fixture (org_a uuid, org_b uuid, org_c uuid, acct_a uuid, acct_c uuid)
  on commit drop;
insert into t_fixture values (:'org_a', :'org_b', :'org_c', :'acct_a', :'acct_c');
grant select on t_fixture to authenticated, anon;

-- ═══ Schema-level invariants (owner, before any impersonation) ══════════════

do $$
begin
  perform pg_temp.check(
    'every company belongs to an account',
    (select count(*) = 0 from public.organizations where account_id is null),
    (select count(*) from public.organizations where account_id is null)::text || ' huérfanas'
  );
end;
$$;

-- Assertion 7 of the contract: correlatives are per COMPANY, not per account.
-- Both companies live under account A, so if the counter had been keyed on the
-- account the second employee would have been EMP-0002.
do $$
declare
  v_a text;
  v_b text;
begin
  select code into v_a from public.employees where full_name = 'Médico de la Clínica';
  select code into v_b from public.employees where full_name = 'Mesero del Restaurante';
  perform pg_temp.check(
    'correlatives restart per company, not per account',
    v_a = 'EMP-0001' and v_b = 'EMP-0001',
    'clínica=' || coalesce(v_a, '∅') || ' restaurante=' || coalesce(v_b, '∅')
  );
end;
$$;

\o /dev/null

-- ═══ Ana — owner of the account, member of company A only ═══════════════════

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Positive control. If this fails, the rest proves nothing.
select pg_temp.check(
  'owner reads their own company',
  (select count(*) = 1 and bool_and(full_name = 'Médico de la Clínica') from public.employees),
  'vio ' || coalesce((select string_agg(full_name, ', ') from public.employees), '∅')
);

-- ─── THE central assertion (contract §9.4, decision M4) ─────────────────────
-- Owning the account is not a way into a company's data. Ana owns the account
-- that owns the restaurant; she never joined the restaurant; she sees nothing
-- of it. This is the assertion that would fail if account scope ever leaked
-- into a business-table RLS policy.

select pg_temp.check(
  'account owner sees NO employees of a company they did not join',
  (select count(*) = 0 from public.employees
    where org_id = (select org_b from pg_temp.t_fixture)),
  'fuga: vio empleados del restaurante'
);

select pg_temp.check(
  'account owner sees NO tickets of a company they did not join',
  (select count(*) = 0 from public.tickets
    where org_id = (select org_b from pg_temp.t_fixture)),
  'fuga: vio tickets del restaurante'
);

select pg_temp.check(
  'account owner sees NO documents of a company they did not join',
  (select count(*) = 0 from public.documents
    where org_id = (select org_b from pg_temp.t_fixture)),
  'fuga: vio documentos del restaurante'
);

select pg_temp.check(
  'account owner sees only the companies they joined',
  (select count(*) = 1 from public.organizations),
  'vio ' || (select count(*) from public.organizations)::text || ' empresas'
);

-- Writing into the sibling company is refused as hard as writing into a
-- stranger's. Same guarantee, and it is the one an owner would expect to be
-- able to bend.
do $$
declare
  v_failed boolean := false;
  v_org_b  uuid;
begin
  select org_b into v_org_b from pg_temp.t_fixture;
  begin
    insert into public.employees (org_id, full_name) values (v_org_b, 'Intruso del dueño');
  exception when insufficient_privilege or check_violation then
    v_failed := true;
  end;
  perform pg_temp.check('account owner cannot write into a sibling company', v_failed,
                        'el dueño escribió en una empresa que no integró');
end;
$$;

-- ─── The plan is readable; the billing is not ───────────────────────────────

select pg_temp.check(
  'member reads the plan of their own account',
  (select count(*) = 1 from public.accounts
    where id = (select acct_a from pg_temp.t_fixture)
      and plan in ('starter', 'growth', 'enterprise')),
  'no pudo leer el plan de su cuenta'
);

-- Column-level privilege, not RLS. `authenticated` never received a grant on
-- the billing columns, so the reference is refused before any policy runs.
do $$
declare v_failed boolean := false;
begin
  begin
    execute 'select billing_customer_id from public.accounts limit 1';
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.check('billing references are invisible to authenticated', v_failed,
                        'billing_customer_id fue legible');
end;
$$;

-- Consequence the application has to live with, pinned here so nobody
-- "fixes" it by widening the grant: `select *` on accounts is refused, because
-- * expands to columns that were never granted. Every read must name columns.
do $$
declare v_failed boolean := false;
begin
  begin
    execute 'select * from public.accounts limit 1';
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.check('select * on accounts is refused (columns must be named)', v_failed,
                        'select * pasó: el grant por columna se aflojó');
end;
$$;

select pg_temp.check(
  'member cannot see an unrelated account',
  (select count(*) = 0 from public.accounts
    where id = (select acct_c from pg_temp.t_fixture)),
  'vio la cuenta de otro cliente'
);

-- The plan is bought, not set. Same guarantee migration 14 gives on
-- organizations, now on the table that actually owns it.
do $$
declare
  v_failed boolean := false;
  v_acct   uuid;
begin
  select acct_a into v_acct from pg_temp.t_fixture;
  begin
    update public.accounts set plan = 'enterprise' where id = v_acct;
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.check('account owner cannot raise their own plan', v_failed,
                        'el dueño se cambió el plan');
end;
$$;

-- ═══ Beto — member of company B, member of no account ═══════════════════════
-- The company he belongs to sits under Ana's account. He must be able to read
-- the plan that gates his modules, and nothing else about the group.

set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

select pg_temp.check(
  'company member reads the plan of the account above them',
  (select count(*) = 1 from public.accounts
    where id = (select acct_a from pg_temp.t_fixture)),
  'no pudo leer la cuenta de su propia empresa'
);

select pg_temp.check(
  'company member cannot see who administers the account',
  (select count(*) = 0 from public.account_memberships),
  'vio ' || (select count(*) from public.account_memberships)::text || ' filas de account_memberships'
);

select pg_temp.check(
  'company member sees only their own company',
  (select count(*) = 1 and bool_and(full_name = 'Mesero del Restaurante') from public.employees),
  'vio ' || coalesce((select string_agg(full_name, ', ') from public.employees), '∅')
);

do $$
declare
  v_failed boolean := false;
  v_acct   uuid;
begin
  select acct_a into v_acct from pg_temp.t_fixture;
  begin
    update public.accounts set name = 'Secuestrada' where id = v_acct;
    -- No exception: RLS filters the row out instead, so the update touches
    -- nothing. Either outcome is acceptable; silently changing it is not.
    v_failed := not exists (select 1 from public.accounts
                             where id = v_acct and name = 'Secuestrada');
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.check('non-owner cannot rename the account', v_failed,
                        'un miembro sin rol de cuenta renombró la cuenta');
end;
$$;

-- ═══ Caro — outside the group entirely ══════════════════════════════════════

set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

select pg_temp.check(
  'outsider sees exactly one account: their own',
  (select count(*) = 1 from public.accounts
    where id = (select acct_c from pg_temp.t_fixture)),
  'vio ' || (select count(*) from public.accounts)::text || ' cuentas'
);

select pg_temp.check(
  'outsider sees nothing of the group''s account',
  (select count(*) = 0 from public.accounts
    where id = (select acct_a from pg_temp.t_fixture)),
  'vio la cuenta del grupo'
);

select pg_temp.check(
  'outsider sees no company of the group',
  (select count(*) = 0 from public.organizations
    where id in (select org_a from pg_temp.t_fixture)
       or id in (select org_b from pg_temp.t_fixture)),
  'vio empresas del grupo'
);

select pg_temp.check(
  'outsider sees no employee of the group',
  (select count(*) = 0 from public.employees
    where org_id in (select org_a from pg_temp.t_fixture)
       or org_id in (select org_b from pg_temp.t_fixture)),
  'vio empleados del grupo'
);

-- ═══ Anonymous ══════════════════════════════════════════════════════════════
-- Migration 08 revokes everything in `public` from anon, and the new tables
-- inherit that through `alter default privileges`. Refused at the privilege
-- layer, before RLS is consulted at all.

set local role anon;
set local request.jwt.claim.sub = '';

do $$
declare
  t        text;
  v_ok     boolean;
  v_denied int := 0;
  v_total  int := 0;
begin
  foreach t in array array['accounts', 'account_memberships'] loop
    v_total := v_total + 1;
    v_ok := false;
    begin
      execute format('select 1 from public.%I limit 1', t);
    exception when insufficient_privilege then
      v_ok := true;
    end;
    if v_ok then v_denied := v_denied + 1; end if;
  end loop;

  perform pg_temp.check(
    'anonymous is denied on the account tables',
    v_denied = v_total,
    v_denied::text || '/' || v_total::text || ' tablas denegadas'
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
    raise exception '% account isolation assertion(s) failed', v_failed;
  end if;
  raise notice 'all % account isolation assertions passed', (select count(*) from t_result);
end;
$$;

rollback;
