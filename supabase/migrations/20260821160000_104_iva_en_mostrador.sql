-- ═══════════════════════════════════════════════════════════════════════════
-- 104 — El IVA del mostrador existe, y `price_cents` pasa a significar una cosa.
--
-- Dos hechos medidos antes de escribir esto:
--
-- 1. `pos_sales.tax_cents` existe desde la migración 43 y **nunca lo escribe
--    nadie**. Ninguna función lo menciona; las cinco ventas de la base lo
--    tienen en 0. La columna promete un desglose que no hay: una venta de un
--    producto con IVA del 19% queda registrada con impuesto cero.
--
-- 2. Peor, y es lo que de verdad urge: `products.price_cents` ya significa dos
--    cosas distintas según quién lo lea.
--
--        POS         cobra ese número tal cual   → es precio con IVA
--        Facturación lo copia a la línea y suma  → es precio sin IVA
--
--    En `facturacion/client.tsx` el selector de producto escribe
--    `product.priceCents` en `unitPrice`, y `totalsOf()` calcula
--    `total = subtotal + tax`. Facturar un producto a su precio de góndola le
--    cobra al cliente un 19% de más, y nada en el código lo desmiente.
--
-- ─── La decisión ───────────────────────────────────────────────────────────
--
-- `products.price_cents` es **el precio con IVA incluido**: lo que el cliente
-- paga en el mostrador. Es la lectura que el POS ya venía usando, es la que
-- exige el etiquetado al público en Colombia, y —lo que decide— es la única
-- que no cambia ni un precio existente. La contraria haría que cada producto
-- de la base subiera un 19% el día del despliegue, en silencio.
--
-- De ahí salen las dos mitades del arreglo:
--
--   · El POS **extrae** el IVA de lo que cobra, no lo suma:
--       impuesto = bruto × tasa / (100 + tasa)
--     El total que paga el cliente es exactamente el de hoy.
--
--   · La factura **convierte** al copiar el precio: neto = bruto ÷ (1 + tasa),
--     y su `total = subtotal + tax` vuelve al mismo bruto. Eso va en código,
--     en el mismo commit.
--
-- ─── Por qué `pos_sales` no adopta `total = subtotal + tax` ────────────────
--
-- Podría parecer que las dos tablas deberían compartir la fórmula. No deben, y
-- conviene decirlo aquí para que nadie lo «arregle» más adelante.
--
-- El recibo imprime, y un cliente puede comprobar con la vista:
--
--       Subtotal      11.900
--       Descuento     −1.000
--       Total          10.900
--       IVA incluido    1.740
--
-- `subtotal` sigue siendo el bruto antes de descuento y `total` sigue siendo
-- `subtotal − descuento`, exactamente como hoy. `tax_cents` no se suma a nada:
-- dice cuánto de ese total ya era impuesto. Un recibo de mostrador y una
-- factura B2B presentan el IVA de forma distinta en la vida real —incluido en
-- uno, añadido en la otra— y forzar una sola forma sobre las dos es justo lo
-- que produjo el problema 2.
--
-- Ninguna de las cinco ventas existentes cambia de valor. Lo único que deja de
-- ser siempre cero es `tax_cents`.
-- ═══════════════════════════════════════════════════════════════════════════

/* ─── La tasa ──────────────────────────────────────────────────────────────
 *
 * Por producto, porque en Colombia conviven varias: 19% general, 5% para parte
 * de la canasta, y exentos y excluidos al 0%. Una tasa por empresa obligaría a
 * la tienda que vende arroz y cerveza a elegir cuál miente.
 *
 * Por defecto 0 y no 19: el valor por defecto entra en cada producto que ya
 * existe y en cada uno que se cree sin tocar el campo, y estrenar impuesto
 * sobre catálogos que nadie ha revisado es cambiarle los números a alguien sin
 * preguntar. Cero es lo que el sistema hacía hasta hoy — la migración no altera
 * ninguna cifra, solo abre la posibilidad de declararla.
 *
 * `numeric(5,2)` acepta 19.00 y también 4.50; el rango se acota porque una tasa
 * negativa o del 300% solo puede ser un dedazo.
 */
alter table public.products
  add column if not exists tax_rate numeric(5,2) not null default 0
    check (tax_rate >= 0 and tax_rate <= 100);

comment on column public.products.tax_rate is
  'IVA del producto, en porcentaje. `price_cents` YA LO INCLUYE: el POS lo '
  'extrae y la factura lo descuenta al copiar el precio. Ver migración 104.';

comment on column public.products.price_cents is
  'Precio con IVA incluido — lo que el cliente paga en el mostrador. '
  'Facturación lo convierte a neto al copiarlo. Ver migración 104.';

/* ─── El desglose por línea ────────────────────────────────────────────────
 *
 * La tasa se copia a la línea en vez de leerse del producto al consultar, por
 * la misma razón por la que la línea ya guarda `sku`, `name` y
 * `unit_price_cents`: un recibo tiene que seguir diciendo lo que decía aunque
 * el producto cambie de precio, de nombre o de tasa mañana.
 *
 * Y porque es lo que pedirá la factura electrónica: el UBL de `lib/dian/ubl.ts`
 * necesita `Percent` y `TaxAmount` **por línea**, no un total. Hoy DIAN solo
 * lee `invoices`, así que esto todavía no alimenta nada — se guarda ahora
 * porque el dato solo existe en el momento de la venta.
 */
alter table public.pos_sale_items
  add column if not exists tax_rate  numeric(5,2) not null default 0,
  add column if not exists tax_cents bigint       not null default 0;

-- ─── register_pos_sale ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.register_pos_sale(p_org_id uuid, p_items jsonb, p_payment_method text DEFAULT 'Efectivo'::text, p_customer_name text DEFAULT ''::text, p_discount_cents bigint DEFAULT 0, p_notes text DEFAULT ''::text, p_pending boolean DEFAULT false, p_client_uuid uuid DEFAULT NULL::uuid, p_site_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(sale_id uuid, sale_code text, sale_total_cents bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_existing public.pos_sales%rowtype;
  v_ids         uuid[];
  v_quantities  int[];
  v_line        record;
  v_employee_id uuid;
  v_session_id  uuid;
  v_site_id     uuid;
  v_sale_id     uuid;
  v_subtotal    bigint := 0;
  v_tax         bigint := 0;
  v_discount    bigint := 0;
  v_total       bigint;
begin
  if p_org_id is null or p_org_id not in (select app.orgs_with('pos:write')) then
    raise exception 'No tienes permiso para vender.' using errcode = 'KG101';
  end if;

  -- La suspensión, que esta función no puede ver por su cuenta.
  --
  -- La migración 99 la puso en RLS como política RESTRICTIVE, y eso cubre a
  -- `authenticated` hablando con PostgREST. No cubre esto: la función es
  -- `security definer` y su dueño es `postgres`, que tiene `rolbypassrls`, así
  -- que ninguna política la toca. Y está concedida a `authenticated`, o sea
  -- que se puede llamar directamente sin pasar por `requirePermission`.
  if not app.company_is_active(p_org_id) then
    raise exception 'Esta empresa está en modo solo lectura: el plan está inactivo.'
      using errcode = 'KG106';
  end if;

  -- Idempotencia: si llega client_uuid y ya hay venta con ese uuid, la
  -- devolvemos sin tocar stock ni reescribir. Es el reintento de offline.
  if p_client_uuid is not null then
    select * into v_existing
    from public.pos_sales
    where org_id = p_org_id and client_uuid = p_client_uuid
    limit 1;
    if v_existing.id is not null then
      return query
      select v_existing.id, v_existing.code, v_existing.total_cents;
      return;
    end if;
  end if;

  -- La sucursal pedida debe ser de esta empresa y accesible para quien
  -- vende. `may_access_site` por sí solo no basta: alguien sin restricciones
  -- de sucursal en otra empresa de su cuenta pasaría la comprobación, y la
  -- venta no puede apuntar a una sucursal de otra empresa.
  if p_site_id is not null then
    if not exists (
      select 1
      from public.sites s
      where s.id = p_site_id and s.org_id = p_org_id and s.deleted_at is null
    ) then
      raise exception 'La sucursal no existe.' using errcode = 'KG102';
    end if;
    if not app.may_access_site(p_site_id) then
      raise exception 'No tienes acceso a esa sucursal.' using errcode = 'KG101';
    end if;
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene líneas.' using errcode = 'KG102';
  end if;

  if jsonb_array_length(p_items) > 100 then
    raise exception 'La venta tiene demasiadas líneas.' using errcode = 'KG102';
  end if;

  if p_discount_cents is null or p_discount_cents < 0 then
    raise exception 'El descuento no es válido.' using errcode = 'KG102';
  end if;

  select array_agg(w.product_id order by w.product_id),
         array_agg(w.quantity   order by w.product_id)
    into v_ids, v_quantities
  from (
    select (e ->> 'product_id')::uuid        as product_id,
           sum((e ->> 'quantity')::int)::int as quantity
    from jsonb_array_elements(p_items) e
    group by 1
  ) w;

  if v_ids is null or array_position(v_ids, null) is not null then
    raise exception 'La venta no es válida.' using errcode = 'KG102';
  end if;

  if exists (select 1 from unnest(v_quantities) q where q is null or q < 1 or q > 9999) then
    raise exception 'La cantidad vendida no es válida.' using errcode = 'KG102';
  end if;

  perform 1
  from public.products p
  where p.org_id = p_org_id
    and p.id = any (v_ids)
  order by p.id
  for update;

  for v_line in
    select w.product_id, w.quantity, p.id as found_id, p.name, p.stock,
           p.price_cents, p.tax_rate
    from unnest(v_ids, v_quantities) as w(product_id, quantity)
    left join public.products p
      on  p.id         = w.product_id
      and p.org_id     = p_org_id
      and p.deleted_at is null
      and p.is_active
    order by w.product_id
  loop
    if v_line.found_id is null then
      raise exception 'Uno de los productos ya no está disponible.' using errcode = 'KG103';
    end if;
    if v_line.stock < v_line.quantity then
      raise exception '"%" solo tiene % unidades disponibles.', v_line.name, v_line.stock
        using errcode = 'KG103';
    end if;
    v_subtotal := v_subtotal + (v_line.price_cents * v_line.quantity);
  end loop;

  v_discount := least(coalesce(p_discount_cents, 0), v_subtotal);
  v_total    := greatest(v_subtotal - v_discount, 0);

  /*
   * El IVA que ya viene dentro de lo que se cobra.
   *
   * `products.price_cents` es precio con impuesto incluido (migración 104), así
   * que aquí no se suma nada: se separa qué parte del total ya era impuesto.
   *
   *     impuesto = bruto × tasa / (100 + tasa)
   *
   * El descuento se reparte proporcionalmente entre las líneas antes de
   * extraer, porque un descuento sobre el carrito rebaja también el impuesto
   * que contiene — cobrar menos y declarar el IVA del precio de lista sería
   * declarar un impuesto que nadie pagó.
   *
   * La suma de los redondeos por línea puede quedar a uno o dos centavos de
   * extraer sobre el total de una vez. Se acepta a cambio de que cada línea
   * cuadre consigo misma, que es lo que un desglose tiene que hacer y lo que
   * la factura electrónica pedirá línea por línea. `v_total` no depende de
   * esto: se calcula aparte y es el mismo número de siempre.
   */
  if v_subtotal > 0 then
    select coalesce(sum(
             round(
               round(p.price_cents * w.quantity * (v_subtotal - v_discount)::numeric / v_subtotal)
               * p.tax_rate / (100 + p.tax_rate)
             )
           ), 0)
      into v_tax
    from unnest(v_ids, v_quantities) as w(product_id, quantity)
    join public.products p on p.id = w.product_id and p.org_id = p_org_id
    where p.tax_rate > 0;
  end if;

  -- El descuento de existencias ya no se hace aquí. Ver el bloque de
  -- movimientos al final: necesita el id de la venta, que todavía no existe en
  -- este punto, y la sucursal, que se resuelve unas líneas más abajo con el
  -- turno de caja abierto.

  select e.id into v_employee_id
  from public.employees e
  where e.org_id = p_org_id
    and e.user_id = (select auth.uid())
    and e.deleted_at is null
  limit 1;

  -- El turno abierto, si lo hay, y su sucursal. La venta enganchada a un
  -- turno hereda la sucursal del turno — quien abre caja en el norte no
  -- puede vender en nombre del sur. Sin turno, vale la pedida por el cajero.
  select s.id, s.site_id into v_session_id, v_site_id
  from public.cash_sessions s
  where s.org_id = p_org_id and s.status = 'Abierta'
  limit 1;

  insert into public.pos_sales
    (org_id, session_id, site_id, customer_name, subtotal_cents, discount_cents,
     tax_cents, total_cents, payment_method, sold_by, notes, status, client_uuid)
  values
    (p_org_id, v_session_id, coalesce(v_site_id, p_site_id),
     coalesce(btrim(p_customer_name), ''), v_subtotal,
     v_discount, v_tax, v_total,
     coalesce(p_payment_method, 'Efectivo'), v_employee_id, coalesce(p_notes, ''),
     case when p_pending then 'Pendiente' else 'Pagada' end,
     p_client_uuid)
  returning id into v_sale_id;

  insert into public.pos_sale_items
    (sale_id, product_id, sku, name, quantity, unit_price_cents, total_cents,
     tax_rate, tax_cents)
  select v_sale_id, p.id, p.sku, p.name, w.quantity, p.price_cents,
         p.price_cents * w.quantity,
         -- La tasa se copia, no se referencia: el recibo tiene que seguir
         -- diciendo lo mismo si el producto cambia de tasa mañana.
         p.tax_rate,
         case when p.tax_rate > 0 and v_subtotal > 0 then
           round(
             round(p.price_cents * w.quantity * (v_subtotal - v_discount)::numeric / v_subtotal)
             * p.tax_rate / (100 + p.tax_rate)
           )
         else 0 end
  from unnest(v_ids, v_quantities) as w(product_id, quantity)
  join public.products p on p.id = w.product_id and p.org_id = p_org_id;

  /*
   * El movimiento de inventario, que sustituye al `update products set stock`.
   *
   * Va aquí y no arriba por dos motivos que solo se cumplen en este punto: la
   * venta ya tiene id, así que el asiento puede decir de dónde viene, y la
   * sucursal ya está resuelta — la misma expresión que la venta usó, para que
   * el libro y la venta no puedan contar sucursales distintas.
   *
   * La validación de existencias de arriba se conserva tal cual, pero deja de
   * ser la única: el trigger de `inventory_movements` vuelve a comprobar contra
   * el saldo de *esa* sucursal, con `for update` sobre la fila del saldo. Esa
   * es la comprobación que manda. La de arriba mira el total de la empresa y
   * sigue sirviendo para lo que siempre sirvió — dar el error pronto y con el
   * nombre del producto — pero una empresa con dos locales puede pasarla y ser
   * rechazada después por el trigger, con el mismo código KG103. Es el orden
   * correcto: el chequeo barato primero, el que tiene el candado al final.
   */
  insert into public.inventory_movements
    (org_id, product_id, site_id, qty, kind, source_table, source_id, created_by)
  select p_org_id, w.product_id, coalesce(v_site_id, p_site_id), -w.quantity,
         'venta', 'pos_sales', v_sale_id, v_employee_id
  from unnest(v_ids, v_quantities) as w(product_id, quantity);

  return query
  select s.id, s.code, s.total_cents from public.pos_sales s where s.id = v_sale_id;
end;
$function$;
