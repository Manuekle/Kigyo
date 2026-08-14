-- ═══════════════════════════════════════════════════════════════════════════
-- Onboarding, the fiscal fields, and branding.
--
-- Three things worth asserting from the database's side:
--
--   1. signup now leaves `onboarding_completed_at` null — and still leaves a
--      complete, working company behind. A wizard that could only be entered
--      from a broken account would be a much worse trade than the one made
--      here, so "the company works before the wizard runs" is the assertion
--      that keeps the design honest;
--   2. `complete_onboarding` is idempotent, and is not a way to finish
--      somebody else's setup;
--   3. `branding` accepts what the product renders and refuses everything
--      else. The accent is interpolated into a CSS custom property, so an
--      unvalidated value there is an injection rather than a cosmetic problem —
--      and a rule enforced only by the application is one the next writer skips.
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

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1000000-0000-0000-0000-000000000001', 'nora@nueva.test',
   '{"full_name":"Nora Nueva","company":"Clínica Nueva","company_type":"salud"}'),
  ('b1000000-0000-0000-0000-000000000002', 'omar@otra.test',
   '{"full_name":"Omar Otra","company":"Otra Cuenta"}');

select
  (select org_id from public.memberships
     where user_id = 'a1000000-0000-0000-0000-000000000001') as org_nora,
  (select org_id from public.memberships
     where user_id = 'b1000000-0000-0000-0000-000000000002') as org_omar
\gset

select
  (select account_id from public.organizations where id = :'org_nora') as acct_nora,
  (select account_id from public.organizations where id = :'org_omar') as acct_omar
\gset

create temporary table t_fixture (org_nora uuid, acct_nora uuid, acct_omar uuid) on commit drop;
insert into t_fixture values (:'org_nora', :'acct_nora', :'acct_omar');
grant select on t_fixture to authenticated, anon;

-- ═══ Signup leaves work for the wizard, and a working company ═══════════════

do $$
declare v_org uuid; v_acct uuid;
begin
  select org_nora, acct_nora into v_org, v_acct from pg_temp.t_fixture;

  perform pg_temp.check(
    'a fresh signup has not been through onboarding',
    (select onboarding_completed_at is null from public.accounts where id = v_acct),
    'la cuenta nueva ya figura como configurada'
  );

  -- The load-bearing half. Leaving onboarding unfinished must not leave the
  -- customer with a company they cannot use: the wizard improves an account
  -- that already works, and skipping it is allowed.
  perform pg_temp.check(
    'and still has a complete company: roles, membership and grants',
    (select count(*) = 3 from public.roles where org_id = v_org)
    and (select count(*) = 1 from public.memberships where org_id = v_org)
    and (select count(*) > 0 from public.role_permissions
          where org_id = v_org and role = 'Administrador'),
    'la empresa quedó incompleta antes del asistente'
  );

  perform pg_temp.check(
    'the fiscal fields default rather than arriving null',
    (select country = 'CO' and currency = 'COP' and timezone = 'America/Bogota'
       from public.organizations where id = v_org),
    'los valores por defecto no se aplicaron'
  );

  perform pg_temp.check(
    'branding starts empty, not null',
    (select branding = '{}'::jsonb from public.organizations where id = v_org),
    'branding no arrancó como objeto vacío'
  );
end;
$$;

\o /dev/null

-- ═══ Nora — owner, mid-onboarding ═══════════════════════════════════════════

set local role authenticated;
set local request.jwt.claim.sub = 'a1000000-0000-0000-0000-000000000001';

select pg_temp.check(
  'the owner can read their own onboarding state',
  (select count(*) = 1 from public.accounts
    where id = (select acct_nora from pg_temp.t_fixture)),
  'no pudo leer su propia cuenta'
);

select pg_temp.check(
  'finishing onboarding reports success',
  public.complete_onboarding() = true,
  'complete_onboarding no confirmó'
);

select pg_temp.check(
  'and the account is marked finished',
  (select onboarding_completed_at is not null from public.accounts
    where id = (select acct_nora from pg_temp.t_fixture)),
  'la marca no se escribió'
);

-- Idempotent: the wizard's last step can be retried after a network error
-- without moving the moment the customer actually arrived.
do $$
declare v_first timestamptz; v_second timestamptz; v_acct uuid;
begin
  select acct_nora into v_acct from pg_temp.t_fixture;
  select onboarding_completed_at into v_first from public.accounts where id = v_acct;
  perform public.complete_onboarding();
  select onboarding_completed_at into v_second from public.accounts where id = v_acct;

  perform pg_temp.check('finishing twice keeps the first time', v_first = v_second,
                        'la segunda llamada reescribió la marca');
end;
$$;

-- ─── The fiscal fields, and what they refuse ────────────────────────────────

do $$
declare
  v_org    uuid;
  v_failed boolean := false;
begin
  select org_nora into v_org from pg_temp.t_fixture;

  update public.organizations
     set legal_name = 'Servicios Médicos del Norte S.A.S.',
         tax_id     = '900.123.456-7',
         country    = 'MX',
         currency   = 'MXN'
   where id = v_org;

  perform pg_temp.check(
    'an administrator can set the details a document needs',
    (select legal_name is not null and tax_id is not null and currency = 'MXN'
       from public.organizations where id = v_org),
    'no se pudieron guardar los datos fiscales'
  );

  -- Shape is enforced, not merely expected: a lowercase or three-letter country
  -- would reach every invoice template unchallenged.
  begin
    update public.organizations set country = 'mex' where id = v_org;
  exception when check_violation then
    v_failed := true;
  end;
  perform pg_temp.check('a malformed country is refused', v_failed,
                        'se aceptó un país que no es ISO-3166 alpha-2');
end;
$$;

-- ─── Branding ───────────────────────────────────────────────────────────────

do $$
declare
  v_org    uuid;
  v_failed boolean;
begin
  select org_nora into v_org from pg_temp.t_fixture;

  update public.organizations
     set branding = '{"accent": "#1D4ED8", "logo_url": "https://cdn.example.com/logo.png"}'::jsonb
   where id = v_org;

  perform pg_temp.check(
    'branding accepts the two keys the product renders',
    (select branding ->> 'accent' = '#1D4ED8' from public.organizations where id = v_org),
    'no se pudo guardar la marca'
  );

  -- The accent lands in a CSS custom property. Anything that is not a hex
  -- triple is a style injection waiting for a template that interpolates it.
  v_failed := false;
  begin
    update public.organizations
       set branding = '{"accent": "red; background: url(//evil)"}'::jsonb
     where id = v_org;
  exception when check_violation then
    v_failed := true;
  end;
  perform pg_temp.check('an accent that is not a hex colour is refused', v_failed,
                        'FUGA: se aceptó un color arbitrario para interpolar en CSS');

  v_failed := false;
  begin
    update public.organizations
       set branding = '{"logo_url": "javascript:alert(1)"}'::jsonb
     where id = v_org;
  exception when check_violation then
    v_failed := true;
  end;
  perform pg_temp.check('a logo that is not an https URL is refused', v_failed,
                        'se aceptó un esquema de URL arbitrario');

  -- An unknown key is refused rather than ignored: a blob nobody validates
  -- collects four spellings of the same field before anyone notices.
  v_failed := false;
  begin
    update public.organizations
       set branding = '{"accentColor": "#000000"}'::jsonb
     where id = v_org;
  exception when check_violation then
    v_failed := true;
  end;
  perform pg_temp.check('an unknown branding key is refused', v_failed,
                        'branding acepta claves que nada renderiza');
end;
$$;

-- ═══ Omar — a different account entirely ════════════════════════════════════

set local request.jwt.claim.sub = 'b1000000-0000-0000-0000-000000000002';

select pg_temp.check(
  'finishing onboarding touches only your own account',
  (select onboarding_completed_at is null from public.accounts
    where id = (select acct_omar from pg_temp.t_fixture)),
  'la cuenta ajena quedó marcada'
);

do $$
declare v_org uuid; v_count int;
begin
  select org_nora into v_org from pg_temp.t_fixture;
  update public.organizations set tax_id = '000' where id = v_org;
  get diagnostics v_count = row_count;
  perform pg_temp.check('an outsider cannot rewrite another company''s tax id', v_count = 0,
                        v_count::text || ' filas actualizadas');
end;
$$;

-- ═══ Anonymous ══════════════════════════════════════════════════════════════

set local role anon;
set local request.jwt.claim.sub = '';

do $$
declare v_failed boolean := false;
begin
  begin
    perform public.complete_onboarding();
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.check('anonymous cannot finish anybody''s onboarding', v_failed,
                        'anon ejecutó complete_onboarding');
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
    raise exception '% onboarding assertion(s) failed', v_failed;
  end if;
  raise notice 'all % onboarding assertions passed', (select count(*) from t_result);
end;
$$;

rollback;
