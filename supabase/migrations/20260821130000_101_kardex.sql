-- ═══════════════════════════════════════════════════════════════════════════
-- 101 — El inventario deja de ser un número que alguien edita.
--
-- `products.stock` es un `integer` que se muta en sitio. Los cuatro escritores,
-- localizados antes de escribir esto:
--
--     register_pos_sale        update products set stock = stock - qty
--     void_pos_sale            update products set stock = stock + qty
--     place_storefront_order   update products set stock = stock - qty
--     mutations/productos.ts   stock: <lo que el formulario diga>
--
-- No existe tabla de movimientos. Eso significa que a la pregunta «¿por qué
-- tengo 7 y no 9?» el sistema no tiene respuesta — `audit_log` guarda que hubo
-- un UPDATE, no la razón de negocio — y que un inventario físico no se puede
-- cuadrar con un ajuste trazable, solo sobrescribiendo el número. Para algo
-- que se vende como ERP es el hueco más visible el día que un cliente cierra
-- mes.
--
-- Y `products` no tiene `site_id`, así que dos locales de la misma empresa
-- comparten un único saldo: la venta se atribuye a su sucursal (`pos_sales`
-- lleva `site_id` desde la migración 95) pero el descuento es global. El plan
-- Growth vende cinco sucursales y el comercio de dos no puede saber qué hay en
-- cada una.
--
-- ─── El modelo ─────────────────────────────────────────────────────────────
--
--   inventory_movements   el porqué   — append-only, un delta por hecho
--          │ trigger
--          ▼
--   product_stock         el qué      — saldo por (producto, sucursal)
--          │ trigger
--          ▼
--   products.stock        el total    — derivado, ya nadie lo escribe a mano
--
-- Tres decisiones que no son obvias:
--
-- 1. **`qty` es un entero con signo**, no dos columnas entrada/salida. Un
--    movimiento *es* un delta; con dos columnas existe el estado «las dos
--    llenas», que no significa nada y que alguien acabará escribiendo.
--
-- 2. **`site_id` es nullable, y null significa «la empresa»**, no «sin
--    asignar». Hoy no hay una sola fila en `sites` — una empresa sin sucursales
--    tiene un único sitio implícito, y darle una fila fantasma la metería en
--    todos los selectores de sucursal del producto. Cuando abra su primer
--    local, lo que había queda como saldo de la empresa y se traslada
--    explícitamente, que es la operación real.
--
-- 3. **`products.stock` sobrevive como columna derivada.** Cinco archivos de
--    consulta y la interfaz la leen, y «cuánto hay en total» es la respuesta
--    correcta por defecto. Lo que cambia es quién la escribe: solo el trigger.
--
-- ─── Por qué ahora ─────────────────────────────────────────────────────────
--
-- 1 producto, 0 sucursales, 5 ventas. El relleno es una fila. Con un año de
-- operación esto es una reconstrucción de saldos históricos que nadie puede
-- verificar.
-- ═══════════════════════════════════════════════════════════════════════════

/* ─── El libro ─────────────────────────────────────────────────────────────
 *
 * Append-only por grants, no por buena voluntad: al final de la migración se
 * revoca UPDATE y DELETE a `authenticated`. Un kardex que se puede editar no
 * es un kardex — una corrección es otro movimiento, con su propia fecha y su
 * propio motivo, y así el error también queda contado.
 */
create table public.inventory_movements (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  product_id    uuid not null references public.products (id) on delete cascade,
  -- Null = la empresa, no «sin asignar». Ver decisión 2 arriba.
  site_id       uuid references public.sites (id) on delete set null,
  -- Con signo. Negativo saca, positivo mete. Nunca cero: un movimiento que no
  -- mueve nada es una fila que solo puede confundir a quien lea el libro.
  qty           integer not null check (qty <> 0),
  kind          text not null
                check (kind in ('apertura', 'compra', 'venta', 'anulacion',
                                'ajuste', 'traslado', 'merma')),
  /*
   * De dónde vino, como par tabla+id en vez de una FK por origen.
   *
   * Una FK a `pos_sales` y otra a `supplier_invoices` y otra a lo que venga
   * son tres columnas nullable de las que siempre hay dos vacías, y una cuarta
   * el día que aparezca otro origen. El precio de no tener FK es que el enlace
   * no se valida solo; se paga a cambio de que añadir un origen no sea una
   * migración de esquema.
   */
  source_table  text not null default '',
  source_id     uuid,
  note          text not null default '',
  -- Quién lo provocó. Se desnormaliza a `employees` como el resto del producto.
  created_by    uuid references public.employees (id) on delete set null,
  occurred_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index inventory_movements_product_idx
  on public.inventory_movements (product_id, occurred_at desc);
create index inventory_movements_org_idx
  on public.inventory_movements (org_id, occurred_at desc);
create index inventory_movements_source_idx
  on public.inventory_movements (source_table, source_id) where source_id is not null;

/* ─── El saldo ─────────────────────────────────────────────────────────────
 *
 * Podría derivarse con un `sum(qty) group by` cada vez. No se hace, por dos
 * razones que apuntan al mismo sitio: una lista de 300 productos pagaría una
 * agregación sobre todo el histórico en cada carga, y —más importante—
 * `register_pos_sale` necesita algo concreto que bloquear para que dos cajeros
 * no vendan la última unidad. Un agregado no se bloquea; una fila sí.
 *
 * `org_id` va aquí aunque se pueda deducir del producto: es lo que permite que
 * `apply_standard_rls` y la guardia de suspensión de la migración 99 se apliquen
 * tal cual, sin una variante que consulte al padre.
 *
 * La unicidad es `(product_id, site_id)` con site nullable, así que hace falta
 * un índice único parcial para el caso null — en Postgres dos nulls no chocan.
 */
create table public.product_stock (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  site_id     uuid references public.sites (id) on delete cascade,
  qty         integer not null default 0,
  updated_at  timestamptz not null default now()
);

create unique index product_stock_product_site_key
  on public.product_stock (product_id, site_id) where site_id is not null;
create unique index product_stock_product_company_key
  on public.product_stock (product_id) where site_id is null;
create index product_stock_org_idx on public.product_stock (org_id);

/* ─── Movimiento → saldo ───────────────────────────────────────────────────
 *
 * `security definer` porque el trigger tiene que escribir el saldo aunque quien
 * inserte el movimiento no tenga permiso de escritura sobre `product_stock`:
 * un cajero con `pos:write` mueve existencias y no tiene `catalogos:write`.
 * Ese es exactamente el reparto que la migración 43 razonó para el POS.
 *
 * Solo INSERT: la tabla es append-only, así que no hay UPDATE ni DELETE que
 * compensar. Si algún día los hubiera, este trigger tendría que crecer — y el
 * revoke de abajo es lo que garantiza que no aparezcan sin que alguien lo note.
 */
create or replace function app.apply_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_saldo  integer;
  v_nombre text;
begin
  /*
   * Dos sentencias, y no un `on conflict … do update`, por una razón concreta:
   * la unicidad vive en DOS índices parciales —uno para `site_id is not null` y
   * otro para el caso empresa, porque en Postgres dos nulls no chocan— y una
   * sola cláusula `on conflict` no puede apuntar a los dos. La forma de una
   * línea existe solo si se elige entre ellos, y elegir mal falla en silencio
   * justo en el caso que hoy es el único que hay.
   *
   * `on conflict do nothing` sin destino no necesita inferir índice: garantiza
   * que la fila del saldo exista, gane esta inserción o una concurrente. El
   * `update` posterior es el que suma, y `is not distinct from` es lo que hace
   * que el caso empresa (null) compare como igualdad y no como null.
   */
  insert into public.product_stock (org_id, product_id, site_id, qty)
  values (new.org_id, new.product_id, new.site_id, 0)
  on conflict do nothing;

  /*
   * `for update` sobre la fila del saldo, y aquí está el segundo motivo por el
   * que el saldo es una fila y no un agregado.
   *
   * Hasta ahora el candado contra la sobreventa lo ponía `register_pos_sale`
   * bloqueando `public.products`, que es la fila del *catálogo*: dos cajeros
   * vendiendo el mismo artículo se serializaban contra el precio y el nombre,
   * no contra las existencias. Bloquear el saldo bloquea exactamente lo que se
   * está disputando, y lo hace para todos los orígenes a la vez — la venta, la
   * compra y el ajuste manual pasan por aquí.
   */
  select qty into v_saldo
  from public.product_stock
  where product_id = new.product_id
    and site_id is not distinct from new.site_id
  for update;

  /*
   * La comprobación va ANTES de aplicar, y no después de leer el resultado.
   *
   * La primera versión sumaba con `update … returning qty into v_saldo` y
   * miraba el signo a continuación. Nunca llegaba a mirarlo: el `update`
   * completa sus triggers AFTER antes de devolver el control, así que
   * `sync_product_stock_total` ya había recalculado `products.stock` y chocado
   * con `check (stock >= 0)`. El error que salía era
   * `violates check constraint "products_stock_check"` — dos triggers más allá
   * del hecho que lo causó y sin nombrar el producto.
   *
   * KG103 es el código con el que `register_pos_sale` ya rechaza vender sin
   * existencias: para quien llama es el mismo hecho, y darle dos códigos
   * distintos le obligaría a tratarlo dos veces.
   */
  if coalesce(v_saldo, 0) + new.qty < 0 then
    select p.name into v_nombre from public.products p where p.id = new.product_id;
    raise exception '"%" solo tiene % unidad(es) disponible(s) y el movimiento pide %.',
      coalesce(v_nombre, 'El producto'), coalesce(v_saldo, 0), abs(new.qty)
      using errcode = 'KG103';
  end if;

  update public.product_stock
     set qty = qty + new.qty, updated_at = now()
   where product_id = new.product_id
     and site_id is not distinct from new.site_id;

  return new;
end;
$$;

create trigger inventory_movements_apply
after insert on public.inventory_movements
for each row execute function app.apply_inventory_movement();

/* ─── Saldo → total de la empresa ──────────────────────────────────────────
 *
 * `products.stock` pasa a ser un espejo de la suma de sus saldos. Se mantiene
 * como columna en vez de calcularse al leer porque cinco archivos de consulta y
 * la interfaz ya la leen, y «cuánto hay en total» sigue siendo la respuesta por
 * defecto correcta para una empresa sin sucursales — que hoy son todas.
 *
 * Recalcula sumando, no aplicando el delta, y esa diferencia importa: sumar
 * vuelve a preguntarle a la verdad, mientras que ir acumulando incrementos
 * arrastra para siempre cualquier desajuste que se cuele una vez.
 */
create or replace function app.sync_product_stock_total()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_product uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
     set stock = coalesce((
           select sum(s.qty) from public.product_stock s where s.product_id = v_product
         ), 0)
   where p.id = v_product;
  return null;
end;
$$;

create trigger product_stock_sync_total
after insert or update or delete on public.product_stock
for each row execute function app.sync_product_stock_total();

/* ─── Aislamiento ──────────────────────────────────────────────────────────
 *
 * Ambas tablas llevan `org_id`, así que reciben el primitivo congelado tal cual.
 * El permiso de lectura es `inventario:read` y no `catalogos:read`: el kardex
 * responde «qué pasó con las existencias», que es la pregunta de Inventario. El
 * catálogo responde «qué vendemos y a cuánto», que es otra.
 */
select app.apply_standard_rls('inventory_movements', 'inventario:read', 'inventario:write');
select app.apply_standard_rls('product_stock',       'inventario:read', 'inventario:write');

-- La guardia de suspensión de la migración 99, que se aplica por tabla y por
-- eso no alcanza sola a las que nacen después.
select app.apply_active_guard('inventory_movements');
select app.apply_active_guard('product_stock');

-- Sucursal: quien no puede ver el turno del local norte tampoco puede ver ni
-- mover sus existencias. `may_access_site(null)` es true, así que el saldo de
-- empresa lo sigue viendo todo el mundo.
create policy inventory_movements_site_scope on public.inventory_movements
  as restrictive for all to authenticated
  using      (app.may_access_site(site_id))
  with check (app.may_access_site(site_id));

create policy product_stock_site_scope on public.product_stock
  as restrictive for all to authenticated
  using      (app.may_access_site(site_id))
  with check (app.may_access_site(site_id));

/* ─── Append-only, por grants ──────────────────────────────────────────────
 *
 * Una corrección es un movimiento nuevo con su fecha y su motivo, no la edición
 * del que estuvo mal — así el error también queda contado. Igual que
 * `dian_events` desde la migración 92.
 *
 * `product_stock` se revoca entero a `authenticated`: es un derivado, y lo
 * escribe únicamente el trigger, que es `security definer`. Alguien que pudiera
 * escribirlo a mano podría dejarlo diciendo algo que el libro no dice.
 */
revoke update, delete on public.inventory_movements from authenticated;
revoke insert, update, delete on public.product_stock from authenticated;

/*
 * Y TRUNCATE, que es el que de verdad desmentía la palabra «append-only».
 *
 * Las `alter default privileges` de la migración 08 conceden el conjunto
 * completo (`arwdDxtm`) a `authenticated` en toda tabla nueva, así que estas
 * dos nacieron con TRUNCATE, REFERENCES y TRIGGER además de las cuatro que esa
 * migración enumera en su texto. TRUNCATE no pasa por RLS ni por trigger: una
 * sola sentencia vacía el libro entero y no deja rastro de haberlo hecho.
 *
 * No es alcanzable desde PostgREST, que solo emite SELECT/INSERT/UPDATE/DELETE
 * — por eso esto es cerrar una puerta que hoy no da a la calle, y no un
 * incidente. Se cierra igual, porque el coste es una línea y porque una tabla
 * que se anuncia inmutable no debería depender de qué sentencias sabe escribir
 * el cliente que tiene delante.
 *
 * El mismo exceso alcanza a las otras 199 tablas y a `dian_events`, que también
 * se declara append-only. Eso es un arreglo aparte, no un efecto secundario de
 * esta migración.
 */
revoke truncate, references, trigger on public.inventory_movements from authenticated;
revoke truncate, references, trigger on public.product_stock       from authenticated;

/* ─── Apertura ─────────────────────────────────────────────────────────────
 *
 * Lo que hay hoy en `products.stock` entra al libro como un movimiento de
 * apertura, para que el saldo derivado empiece valiendo exactamente lo mismo y
 * la migración no cambie ni una cifra en pantalla. Sin sucursal: no hay una
 * sola fila en `sites`, así que todo lo existente es saldo de empresa.
 *
 * Los productos en cero no reciben movimiento: `qty <> 0` lo rechazaría, y un
 * asiento de apertura por cero no dice nada que la ausencia no diga ya.
 */
insert into public.inventory_movements (org_id, product_id, site_id, qty, kind, note)
select p.org_id, p.id, null, p.stock, 'apertura',
       'Saldo existente al implantar el libro de movimientos'
from public.products p
where p.stock <> 0;

/* ─── Comprobación ─────────────────────────────────────────────────────────
 *
 * El trigger acaba de reescribir `products.stock` desde el saldo. Si la
 * apertura y el derivado no coinciden, la migración no se da por aplicada: el
 * punto entero es que estas dos cifras no puedan divergir, y el momento de
 * demostrarlo es ahora, con una fila, y no dentro de un año con cien mil.
 */
do $$
declare v_mal int;
begin
  select count(*) into v_mal
  from public.products p
  left join (
    select product_id, sum(qty) as qty from public.product_stock group by 1
  ) s on s.product_id = p.id
  where p.stock is distinct from coalesce(s.qty, 0);

  if v_mal > 0 then
    raise exception 'el saldo derivado no cuadra con products.stock en % producto(s)', v_mal;
  end if;
end;
$$;
