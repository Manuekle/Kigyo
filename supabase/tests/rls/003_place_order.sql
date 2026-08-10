-- ═══════════════════════════════════════════════════════════════════════════
-- Checkout is all-or-nothing.
--
-- The property under test is not "the happy path works" but its opposite: when
-- one line of a cart fails, nothing that came before it may survive. The old
-- application-side loop could not promise that — it moved stock line by line,
-- each write its own transaction.
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

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000001', 'ana@tienda.test',
   '{"full_name":"Ana Alfa","company":"Alfa Energía"}'),
  ('b0000000-0000-4000-8000-000000000001', 'beto@tienda.test',
   '{"full_name":"Beto Beta","company":"Beta Solar"}'),
  ('c0000000-0000-4000-8000-000000000001', 'caro@tienda.test',
   '{"full_name":"Caro Alfa","company":"Caro Alfa"}');

select
  (select org_id from public.memberships
     where user_id = 'a0000000-0000-4000-8000-000000000001') as org_a,
  (select org_id from public.memberships
     where user_id = 'b0000000-0000-4000-8000-000000000001') as org_b
\gset

-- Caro joins Alfa as a plain Empleado: `tienda:read`, no `tienda:write`. Her
-- own signup organization is dropped rather than her membership deleted — she
-- is its only administrator, and the last-admin guard refuses.
delete from public.organizations
 where id in (select org_id from public.memberships
               where user_id = 'c0000000-0000-4000-8000-000000000001');

insert into public.memberships (org_id, user_id, role)
values (:'org_a', 'c0000000-0000-4000-8000-000000000001', 'Empleado');

-- Ana has an employee record linked to her login, so the order can record who
-- placed it.
insert into public.employees (org_id, user_id, full_name, position, department)
values (:'org_a', 'a0000000-0000-4000-8000-000000000001',
        'Ana Alfa', 'Compras', 'Operaciones');

insert into public.products (id, org_id, sku, name, price_cents, stock, supplier, in_storefront)
values
  ('d0000000-0000-4000-8000-00000000aaa1', :'org_a', 'PANEL-1', 'Panel 550W',
   100000, 10, 'Solarex', true),
  ('d0000000-0000-4000-8000-00000000aaa2', :'org_a', 'CABLE-1', 'Cable 6mm',
   5000, 1, 'Solarex', true),
  ('d0000000-0000-4000-8000-00000000bbb1', :'org_b', 'BETA-1', 'Inversor Beta',
   200000, 50, 'Betasol', true);

-- Sold through procurement, never through the store.
insert into public.products (id, org_id, sku, name, price_cents, stock, in_storefront)
values ('d0000000-0000-4000-8000-00000000aaa3', :'org_a', 'INTERNO-1', 'Repuesto interno',
        1000, 99, false);

create temporary table t_fixture (org_a uuid, org_b uuid) on commit drop;
insert into t_fixture values (:'org_a', :'org_b');
grant select on t_fixture to authenticated;

\o /dev/null

-- ═══ Ana — Administrador of Alfa ════════════════════════════════════════════

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000001';

do $$
declare v_rows int;
begin
  select count(*) into v_rows
  from public.place_storefront_order(
    (select org_a from t_fixture),
    '[{"product_id":"d0000000-0000-4000-8000-00000000aaa1","quantity":2},
      {"product_id":"d0000000-0000-4000-8000-00000000aaa2","quantity":1}]'::jsonb
  );
  perform pg_temp.check('el checkout devuelve una línea por producto', v_rows = 2,
                        'devolvió ' || v_rows::text);
end;
$$;

-- The whole point: one bad line and the good ones must not have happened.
-- Cable is down to zero after the order above, so this cart cannot complete —
-- and the panel it asks for first must not move.
do $$
declare v_state text;
begin
  begin
    perform 1 from public.place_storefront_order(
      (select org_a from t_fixture),
      '[{"product_id":"d0000000-0000-4000-8000-00000000aaa1","quantity":1},
        {"product_id":"d0000000-0000-4000-8000-00000000aaa2","quantity":1}]'::jsonb
    );
    v_state := 'aceptado';
  exception when others then
    v_state := sqlstate;
  end;
  perform pg_temp.check('el carrito sin stock se rechaza', v_state = 'KG003',
                        'estado ' || v_state);
end;
$$;

-- Same product twice is one decrement of the sum, not two writes racing off
-- the same stale read.
do $$
declare v_rows int;
begin
  select count(*) into v_rows
  from public.place_storefront_order(
    (select org_a from t_fixture),
    '[{"product_id":"d0000000-0000-4000-8000-00000000aaa1","quantity":2},
      {"product_id":"d0000000-0000-4000-8000-00000000aaa1","quantity":3}]'::jsonb
  );
  perform pg_temp.check('las líneas repetidas se agrupan en una', v_rows = 1,
                        'devolvió ' || v_rows::text);
end;
$$;

do $$
declare v_state text;
begin
  begin
    perform 1 from public.place_storefront_order(
      (select org_a from t_fixture),
      '[{"product_id":"d0000000-0000-4000-8000-00000000aaa3","quantity":1}]'::jsonb
    );
    v_state := 'aceptado';
  exception when others then
    v_state := sqlstate;
  end;
  perform pg_temp.check('un producto fuera de la tienda no se puede comprar',
                        v_state = 'KG003', 'estado ' || v_state);
end;
$$;

-- Tenant isolation, from both directions: Alfa cannot buy against Beta's
-- organization, and Beta's products do not exist inside Alfa's checkout.
do $$
declare v_state text;
begin
  begin
    perform 1 from public.place_storefront_order(
      (select org_b from t_fixture),
      '[{"product_id":"d0000000-0000-4000-8000-00000000bbb1","quantity":1}]'::jsonb
    );
    v_state := 'aceptado';
  exception when others then
    v_state := sqlstate;
  end;
  perform pg_temp.check('no se puede comprar en otra organización',
                        v_state = 'KG001', 'estado ' || v_state);
end;
$$;

do $$
declare v_state text;
begin
  begin
    perform 1 from public.place_storefront_order(
      (select org_a from t_fixture),
      '[{"product_id":"d0000000-0000-4000-8000-00000000bbb1","quantity":1}]'::jsonb
    );
    v_state := 'aceptado';
  exception when others then
    v_state := sqlstate;
  end;
  perform pg_temp.check('un producto de otra organización no existe aquí',
                        v_state = 'KG003', 'estado ' || v_state);
end;
$$;

-- ═══ Caro — Empleado of Alfa (tienda:read only) ═════════════════════════════

set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-000000000001';

do $$
declare v_state text;
begin
  begin
    perform 1 from public.place_storefront_order(
      (select org_a from t_fixture),
      '[{"product_id":"d0000000-0000-4000-8000-00000000aaa1","quantity":1}]'::jsonb
    );
    v_state := 'aceptado';
  exception when others then
    v_state := sqlstate;
  end;
  perform pg_temp.check('sin tienda:write el checkout se rechaza',
                        v_state = 'KG001', 'estado ' || v_state);
end;
$$;

reset role;
\o

-- ═══ Resulting state ════════════════════════════════════════════════════════

do $$
begin
  perform pg_temp.check(
    'el stock refleja exactamente lo comprado',
    (select stock = 3 from public.products
      where id = 'd0000000-0000-4000-8000-00000000aaa1'),
    'panel en ' || (select stock from public.products
                     where id = 'd0000000-0000-4000-8000-00000000aaa1')::text || ', se esperaba 3'
  );

  perform pg_temp.check(
    'el pedido rechazado no dejó rastro',
    (select count(*) = 3 from public.inventory_orders),
    'hay ' || (select count(*) from public.inventory_orders)::text || ' pedidos, se esperaban 3'
  );

  perform pg_temp.check(
    'cada pedido lleva código y quién lo pidió',
    (select bool_and(code is not null and requested_by_id is not null)
       from public.inventory_orders),
    'hay pedidos sin código o sin solicitante'
  );

  perform pg_temp.check(
    'el precio estimado es precio × cantidad',
    (select est_price_cents = 200000 from public.inventory_orders
      where item like 'PANEL-1%' and quantity = 2),
    'la primera línea de paneles no cuadra'
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
    raise exception '% checkout assertion(s) failed', v_failed;
  end if;
  raise notice 'all % checkout assertions passed', (select count(*) from t_result);
end;
$$;

rollback;
