-- ═══════════════════════════════════════════════════════════════════════════
-- 103 — Crear un producto con existencia sigue funcionando.
--
-- Las migraciones 101 y 102 convirtieron `products.stock` en columna derivada:
-- la escribe solo el trigger que suma los saldos. Lo que no cubrieron es el
-- `insert` que trae la cantidad puesta:
--
--     insert into products (…, stock, …) values (…, 5, …);
--
-- Eso escribe la columna y no crea saldo. El resultado es la única cosa que
-- este rediseño existía para hacer imposible: `products.stock` diciendo 5
-- mientras el libro dice 0. Y en cuanto alguien intenta vender una unidad, el
-- trigger la rechaza — «solo tiene 0 unidades disponibles» sobre un producto
-- que en pantalla muestra 5.
--
-- Encontrado por el smoke de POS offline, que siembra su producto así. No es un
-- problema del fixture: `scripts/seed-demo.mjs` hace lo mismo, y cualquiera que
-- cargue un catálogo inicial con un `insert` lo haría también. Arreglar la
-- prueba habría dejado el agujero para el primer cliente que importe productos.
--
-- ─── El arreglo ────────────────────────────────────────────────────────────
--
-- Una cantidad puesta al crear el producto ES una declaración de existencia
-- inicial, así que se convierte en lo que es: un asiento de apertura. Es el
-- mismo razonamiento con el que la migración 101 rellenó lo que ya había.
--
-- Solo `after insert`, y eso importa: el trigger de saldo termina haciendo
-- `update products set stock = …`, y si este disparara también con UPDATE se
-- llamarían en círculo. Con INSERT solo, la cadena es
--
--     insert products (stock=5)
--       → asiento 'apertura' +5
--         → saldo = 5
--           → update products set stock = 5     ← no vuelve a disparar
--
-- y acaba en el mismo número que se pidió.
--
-- Actualizar `stock` a mano con un UPDATE sí divergiría, y no se bloquea aquí:
-- ya no queda una sola línea en la aplicación que lo haga —los cuatro
-- escritores originales pasan por el libro desde la 102— y un trigger que
-- intente distinguir «este UPDATE viene del trigger de saldo» de «este lo
-- escribió alguien» es más frágil que el problema que resuelve.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.open_product_stock()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  -- Cero no genera asiento: `qty <> 0` lo rechazaría, y un movimiento de
  -- apertura por cero no dice nada que la ausencia de movimientos no diga ya.
  if new.stock is distinct from 0 then
    insert into public.inventory_movements
      (org_id, product_id, site_id, qty, kind, source_table, source_id, note)
    values
      (new.org_id, new.id, null, new.stock, 'apertura', 'products', new.id,
       'Existencia inicial al crear el producto');
  end if;
  return null;
end;
$$;

comment on function app.open_product_stock() is
  'Convierte la existencia inicial de un producto recién creado en un asiento '
  'de apertura. Sin esto, `products.stock` —derivada desde la migración 101— '
  'puede nacer diciendo algo que el libro de movimientos no dice.';

drop trigger if exists products_open_stock on public.products;

create trigger products_open_stock
after insert on public.products
for each row execute function app.open_product_stock();

-- ─── Lo que ya nació torcido ───────────────────────────────────────────────
--
-- Entre la 101 y esta, cualquier producto creado con existencia quedó con la
-- columna puesta y sin saldo. Se le da su apertura, igual que hizo la 101 con
-- lo que había antes. La condición es «tiene stock y no tiene saldo», no «se
-- creó después de tal fecha»: describe el estado que hay que corregir en vez
-- de adivinar cómo se llegó a él.

insert into public.inventory_movements
  (org_id, product_id, site_id, qty, kind, source_table, source_id, note)
select p.org_id, p.id, null, p.stock, 'apertura', 'products', p.id,
       'Existencia inicial (recuperada)'
from public.products p
where p.stock <> 0
  and not exists (select 1 from public.product_stock s where s.product_id = p.id);

-- ─── Comprobación ──────────────────────────────────────────────────────────

do $$
declare v_mal int;
begin
  select count(*) into v_mal
  from public.products p
  left join (select product_id, sum(qty) as qty from public.product_stock group by 1) s
    on s.product_id = p.id
  where p.stock is distinct from coalesce(s.qty, 0);

  if v_mal > 0 then
    raise exception 'el saldo derivado no cuadra con products.stock en % producto(s)', v_mal;
  end if;
end;
$$;
