-- ═══════════════════════════════════════════════════════════════════════════
-- La costura de facturación.
--
-- `public.apply_subscription` is the only thing in the schema that can raise a
-- plan, and `public.billing_events` is the only place a payment provider's
-- events land. Between them they decide what a customer has bought and which of
-- their companies can still be written to, so the assertions here are about the
-- two ways that goes wrong:
--
--   1. somebody who is not the billing process reaching either of them — a
--      customer who can call `apply_subscription` has a free Enterprise plan;
--   2. the reconciliation itself: a downgrade must suspend and never delete, a
--      cancellation must suspend everything, and both must be idempotent
--      because a webhook *will* deliver the same event twice.
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
-- Tere owns a group with three companies, which needs Enterprise to be legal.

insert into auth.users (id, email, raw_user_meta_data) values
  ('e1000000-0000-0000-0000-000000000001', 'tere@grupo.test',
   '{"full_name":"Tere Grupo","company":"Hotel Tere","company_type":"hoteleria"}');

select (select org_id from public.memberships
          where user_id = 'e1000000-0000-0000-0000-000000000001') as org_tere \gset
select (select account_id from public.organizations where id = :'org_tere') as acct_tere \gset

-- Enterprise first, so the two extra companies clear the limit trigger.
select public.apply_subscription(:'acct_tere', 'enterprise', 'active');

insert into public.organizations (name, slug, account_id, created_at) values
  ('Restaurante Tere', 'restaurante-tere', :'acct_tere', now() + interval '1 minute'),
  ('Clínica Tere',     'clinica-tere',     :'acct_tere', now() + interval '2 minutes');

create temporary table t_fixture (org_tere uuid, acct_tere uuid) on commit drop;
insert into t_fixture values (:'org_tere', :'acct_tere');
grant select on t_fixture to authenticated, anon;

-- ═══ Un downgrade suspende, nunca borra ═════════════════════════════════════

do $$
declare v_acct uuid;
begin
  select acct_tere into v_acct from pg_temp.t_fixture;

  perform public.apply_subscription(v_acct, 'starter', 'active');

  -- The load-bearing one. The customer's data is the customer's.
  perform pg_temp.check(
    'a downgrade deletes nothing',
    (select count(*) = 3 from public.organizations where account_id = v_acct),
    'bajar de plan borró empresas'
  );

  perform pg_temp.check(
    'starter leaves exactly one company writable',
    (select count(*) = 1 from public.organizations
      where account_id = v_acct and status = 'active'),
    'el número de empresas activas no coincide con el límite del plan'
  );

  -- Oldest-first is the only ordering a customer can predict without being
  -- told which one the product decided to keep.
  perform pg_temp.check(
    'and it is the oldest one',
    (select status = 'active' from public.organizations
      where id = (select org_tere from pg_temp.t_fixture)),
    'la empresa que sobrevivió no es la primera'
  );

  -- A webhook will deliver the same event twice. Running it again must not
  -- rotate which company is suspended.
  perform public.apply_subscription(v_acct, 'starter', 'active');
  perform pg_temp.check(
    'applying the same subscription twice changes nothing',
    (select count(*) = 1 from public.organizations
      where account_id = v_acct and status = 'active')
    and (select status = 'active' from public.organizations
          where id = (select org_tere from pg_temp.t_fixture)),
    'reaplicar el mismo plan movió la suspensión'
  );
end;
$$;

-- ═══ Volver a subir devuelve todo ═══════════════════════════════════════════

do $$
declare v_acct uuid;
begin
  select acct_tere into v_acct from pg_temp.t_fixture;

  perform public.apply_subscription(v_acct, 'enterprise', 'active');

  perform pg_temp.check(
    'raising the plan reactivates every company',
    (select count(*) = 3 from public.organizations
      where account_id = v_acct and status = 'active'),
    'subir de plan no devolvió las empresas suspendidas'
  );
end;
$$;

-- ═══ Dejar de pagar suspende todo, sin tocar el plan ════════════════════════

do $$
declare v_acct uuid;
begin
  select acct_tere into v_acct from pg_temp.t_fixture;

  perform public.apply_subscription(v_acct, null, 'past_due');

  perform pg_temp.check(
    'an unpaid subscription suspends every company',
    (select count(*) = 3 from public.organizations
      where account_id = v_acct and status = 'suspended'),
    'una suscripción impaga dejó empresas escribibles'
  );

  -- The tier is what they bought; the status is whether they are current. A
  -- missed payment must not silently downgrade what they own, or paying again
  -- would restore the wrong thing.
  perform pg_temp.check(
    'and does not change the tier they bought',
    (select plan = 'enterprise' from public.accounts where id = v_acct),
    'dejar de pagar cambió el plan'
  );

  perform public.apply_subscription(v_acct, null, 'active');
  perform pg_temp.check(
    'paying again brings them all back',
    (select count(*) = 3 from public.organizations
      where account_id = v_acct and status = 'active'),
    'ponerse al día no reactivó las empresas'
  );
end;
$$;

-- ═══ Un plan que no existe ══════════════════════════════════════════════════

do $$
declare v_failed boolean := false;
begin
  begin
    perform public.apply_subscription(
      (select acct_tere from pg_temp.t_fixture), 'ultra', 'active');
  exception when check_violation then
    v_failed := true;
  end;
  perform pg_temp.check('an unknown plan is refused', v_failed,
                        'se aceptó un plan que no está en plan_limits');
end;
$$;

-- ═══ Nadie más puede llamarla, ni leer los eventos ══════════════════════════

\o /dev/null
set local role authenticated;
set local request.jwt.claim.sub = 'e1000000-0000-0000-0000-000000000001';

do $$
declare v_failed boolean := false;
begin
  -- The one that matters most: a customer who can call this has every plan for
  -- free, and owning the account is not a defence — it is the exact person who
  -- would want to.
  begin
    perform public.apply_subscription(
      (select acct_tere from pg_temp.t_fixture), 'enterprise', 'active');
    v_failed := false;
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.check('an account owner cannot apply a subscription', v_failed,
                        'authenticated ejecutó apply_subscription: el plan es gratis');

  begin
    perform count(*) from public.billing_events;
    v_failed := false;
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.check('and cannot read the event log', v_failed,
                        'authenticated lee billing_events');

  begin
    insert into public.billing_events (provider, event_id, kind)
    values ('manual', 'inventado', 'subscription.updated');
    v_failed := false;
  exception when insufficient_privilege then
    v_failed := true;
  end;
  perform pg_temp.check('nor forge an event', v_failed,
                        'authenticated escribió en billing_events');
end;
$$;

reset role;
\o

-- ═══ El registro es idempotente por construcción ════════════════════════════

do $$
declare v_failed boolean := false;
begin
  insert into public.billing_events (provider, event_id, kind, account_id)
  values ('manual', 'evt_1', 'subscription.updated',
          (select acct_tere from pg_temp.t_fixture));

  -- The unique constraint *is* the idempotency strategy: two deliveries
  -- arriving at once would both pass a `select` and both apply.
  begin
    insert into public.billing_events (provider, event_id, kind)
    values ('manual', 'evt_1', 'subscription.updated');
  exception when unique_violation then
    v_failed := true;
  end;
  perform pg_temp.check('the same event cannot be recorded twice', v_failed,
                        'se registró dos veces el mismo evento del proveedor');

  -- Same id from a different processor is a different event.
  insert into public.billing_events (provider, event_id, kind)
  values ('otro', 'evt_1', 'subscription.updated');
  perform pg_temp.check(
    'but two providers may use the same id',
    (select count(*) = 2 from public.billing_events where event_id = 'evt_1'),
    'la unicidad no distingue proveedores'
  );
end;
$$;

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
    raise exception '% billing assertion(s) failed', v_failed;
  end if;
  raise notice 'all % billing assertions passed', (select count(*) from t_result);
end;
$$;

rollback;
