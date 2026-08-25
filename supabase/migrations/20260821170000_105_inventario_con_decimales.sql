-- ═══════════════════════════════════════════════════════════════════════════
-- 105 — El inventario admite decimales.
--
-- Hasta ahora `inventory_movements.qty`, `product_stock.qty`,
-- `products.stock`, `pos_sale_items.quantity` e `inventory_orders.quantity`
-- eran `integer`. Una compra de 2,5 kg se redondeaba al entrar al libro, y el
-- kardex —que se vende como ERP— no podía representar lo que un almacén
-- verdad: pesaje, fracciones de empaque, producción por lote.
--
-- El resto del producto ya usa `numeric(12,2)` para cantidades (ver
-- `quote_items`, `invoice_items`, `purchase_*`, `production_*`), así que el POS
-- era el outlier. Esta migración lo alinea.
--
-- `numeric(12,2)`: 10 enteros + 2 decimales. Suficiente para kilos de café y
-- para unidades enteras (que caben sin perder nada). No `numeric` sin escala
-- porque `round()` sin argumentos sobre `numeric` libre devuelve más
-- decimales de los que un recibo necesita y rompe los `::bigint` de los
-- totales que ya funcionan.
--
-- ─── Lo que NO cambia ─────────────────────────────────────────────────────
--
-- · `app.orgs_with`, `apply_standard_rls`, `apply_child_rls`: congeladas.
-- · El trigger `sync_product_stock_total` ya usa `sum(qty)`, que sobre
--   `numeric` devuelve `numeric` — no necesita tocar.
-- · El check `qty <> 0` sigue válido: un movimiento que no mueve nada sigue
--   sin significar nada, venga en entero o en decimal.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Columnas ─────────────────────────────────────────────────────────────

alter table public.products
  alter column stock type numeric(12,2) using stock::numeric(12,2);
alter table public.products
  drop constraint if exists products_stock_check;
alter table public.products
  add constraint products_stock_check check (stock >= 0);

alter table public.inventory_movements
  alter column qty type numeric(12,2) using qty::numeric(12,2);
-- `qty <> 0` ya estaba; sobre numeric sigue siendo válido. No se toca.

alter table public.product_stock
  alter column qty type numeric(12,2) using qty::numeric(12,2);

alter table public.pos_sale_items
  alter column quantity type numeric(12,2) using quantity::numeric(12,2);
alter table public.pos_sale_items
  drop constraint if exists pos_sale_items_quantity_check;
alter table public.pos_sale_items
  add constraint pos_sale_items_quantity_check check (quantity > 0);

alter table public.inventory_orders
  alter column quantity type numeric(12,2) using quantity::numeric(12,2);
alter table public.inventory_orders
  drop constraint if exists inventory_orders_quantity_check;
alter table public.inventory_orders
  add constraint inventory_orders_quantity_check check (quantity > 0);

-- ─── Trigger apply_inventory_movement: v_saldo integer → numeric ─────────

create or replace function app.apply_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_saldo  numeric(12,2);
  v_nombre text;
begin
  insert into public.product_stock (org_id, product_id, site_id, qty)
  values (new.org_id, new.product_id, new.site_id, 0)
  on conflict do nothing;

  select qty into v_saldo
  from public.product_stock
  where product_id = new.product_id
    and site_id is not distinct from new.site_id
  for update;

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

-- ─── RPCs: v_quantities int[] → numeric[], (e ->> 'quantity')::int → ::numeric
--         y order_quantity integer → numeric
--
-- Solo se reemplazan las líneas que cambian de tipo. El cuerpo sale de
-- pg_get_functiondef y el cambio es por búsqueda exacta del ancla.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── register_pos_sale (versión mig 104, la vigente) ──────────────────────

CREATE OR REPLACE FUNCTION public.register_pos_sale(p_org_id uuid, p_items jsonb, p_payment_method text DEFAULT 'Efectivo'::text, p_customer_name text DEFAULT ''::text, p_discount_cents bigint DEFAULT 0, p_notes text DEFAULT ''::text, p_pending boolean DEFAULT false, p_client_uuid uuid DEFAULT NULL::uuid, p_site_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(sale_id uuid, sale_code text, sale_total_cents bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_existing public.pos_sales%rowtype;
  v_ids         uuid[];
  v_quantities  numeric(12,2)[];
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

  if not app.company_is_active(p_org_id) then
    raise exception 'Esta empresa está en modo solo lectura: el plan está inactivo.'
      using errcode = 'KG106';
  end if;

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
           sum((e ->> 'quantity')::numeric(12,2))::numeric(12,2) as quantity
    from jsonb_array_elements(p_items) e
    group by 1
  ) w;

  if v_ids is null or array_position(v_ids, null) is not null then
    raise exception 'La venta no es válida.' using errcode = 'KG102';
  end if;

  -- Cero o negativo no es una venta; el límite superior sigue siendo 9999
  -- porque la unidad sigue siendo «un artículo» y el carrito no es un pallet.
  if exists (select 1 from unnest(v_quantities) q where q is null or q <= 0 or q > 9999) then
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

  select e.id into v_employee_id
  from public.employees e
  where e.org_id = p_org_id
    and e.user_id = (select auth.uid())
    and e.deleted_at is null
  limit 1;

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
         round(p.price_cents * w.quantity)::bigint,
         p.tax_rate,
         case when p.tax_rate > 0 and v_subtotal > 0 then
           round(
             round(p.price_cents * w.quantity * (v_subtotal - v_discount)::numeric / v_subtotal)
             * p.tax_rate / (100 + p.tax_rate)
           )
         else 0 end
  from unnest(v_ids, v_quantities) as w(product_id, quantity)
  join public.products p on p.id = w.product_id and p.org_id = p_org_id;

  insert into public.inventory_movements
    (org_id, product_id, site_id, qty, kind, source_table, source_id, created_by)
  select p_org_id, w.product_id, coalesce(v_site_id, p_site_id), -w.quantity,
         'venta', 'pos_sales', v_sale_id, v_employee_id
  from unnest(v_ids, v_quantities) as w(product_id, quantity);

  return query
  select s.id, s.code, s.total_cents from public.pos_sales s where s.id = v_sale_id;
end;
$function$;

-- ─── place_storefront_order (versión mig 104, la vigente) ─────────────────
--
-- Esta sí necesita `drop` antes: `order_quantity` es un parámetro OUT y pasa de
-- `integer` a `numeric(12,2)`, así que cambia el tipo de fila que devuelve.
-- `create or replace` lo rechaza —«cannot change return type of existing
-- function»— aunque la firma de entrada sea idéntica, que es lo que engaña.
-- `register_pos_sale` no lo necesita: sus tipos de salida no se tocan, solo
-- variables internas.
--
-- El `drop` se lleva los permisos por delante, así que se vuelven a conceder
-- abajo con los mismos que tenía (`authenticated` + `service_role`, migración
-- 12). Sin eso, PostgREST contesta «function not found» a la tienda entera.

drop function if exists public.place_storefront_order(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.place_storefront_order(p_org_id uuid, p_items jsonb)
 RETURNS TABLE(order_code text, order_item text, order_quantity numeric(12,2), order_price_cents bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ids         uuid[];
  v_quantities  numeric(12,2)[];
  v_employee_id uuid;
  v_line        record;
begin
  if p_org_id is null or p_org_id not in (select app.orgs_with('tienda:write')) then
    raise exception 'No tienes permiso para comprar en la tienda.'
      using errcode = 'KG001';
  end if;

  if not app.company_is_active(p_org_id) then
    raise exception 'Esta empresa está en modo solo lectura: el plan está inactivo.'
      using errcode = 'KG106';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío.' using errcode = 'KG002';
  end if;

  if jsonb_array_length(p_items) > 50 then
    raise exception 'El carrito tiene demasiadas líneas.' using errcode = 'KG002';
  end if;

  select array_agg(w.product_id order by w.product_id),
         array_agg(w.quantity   order by w.product_id)
    into v_ids, v_quantities
  from (
    select (e ->> 'product_id')::uuid        as product_id,
           sum((e ->> 'quantity')::numeric(12,2))::numeric(12,2) as quantity
    from jsonb_array_elements(p_items) e
    group by 1
  ) w;

  if v_ids is null or array_position(v_ids, null) is not null then
    raise exception 'El carrito no es válido.' using errcode = 'KG002';
  end if;

  if exists (select 1 from unnest(v_quantities) q where q is null or q <= 0 or q > 9999) then
    raise exception 'La cantidad pedida no es válida.' using errcode = 'KG002';
  end if;

  perform 1
  from public.products p
  where p.org_id = p_org_id
    and p.id = any (v_ids)
  order by p.id
  for update;

  for v_line in
    select w.product_id,
           w.quantity,
           p.id as found_id,
           p.name,
           p.stock
    from unnest(v_ids, v_quantities) as w(product_id, quantity)
    left join public.products p
      on  p.id         = w.product_id
      and p.org_id     = p_org_id
      and p.deleted_at is null
      and p.is_active
      and p.in_storefront
    order by w.product_id
  loop
    if v_line.found_id is null then
      raise exception 'Uno de los productos ya no está disponible.'
        using errcode = 'KG003';
    end if;

    if v_line.stock < v_line.quantity then
      raise exception '"%" solo tiene % unidades disponibles.', v_line.name, v_line.stock
        using errcode = 'KG003';
    end if;
  end loop;

  insert into public.inventory_movements
    (org_id, product_id, site_id, qty, kind, source_table, note)
  select p_org_id, w.product_id, null, -w.quantity, 'venta', 'storefront',
         'Pedido desde la tienda en línea'
  from unnest(v_ids, v_quantities) as w(product_id, quantity);

  select e.id into v_employee_id
  from public.employees e
  where e.org_id     = p_org_id
    and e.user_id    = (select auth.uid())
    and e.deleted_at is null
  limit 1;

  return query
  with inserted as (
    insert into public.inventory_orders
      (org_id, item, supplier, quantity, est_price_cents, requested_by_id, status)
    select p_org_id,
           p.sku || ' · ' || p.name,
           p.supplier,
           w.quantity,
           round(p.price_cents * w.quantity)::bigint,
           v_employee_id,
           'Solicitado'
    from unnest(v_ids, v_quantities) as w(product_id, quantity)
    join public.products p
      on p.id     = w.product_id
     and p.org_id = p_org_id
    returning code, item, quantity, est_price_cents
  )
  select i.code, i.item, i.quantity, i.est_price_cents
  from inserted i
  order by i.item;
end;
$function$;

-- Los permisos que el `drop` de arriba se llevó. Mismos que la migración 12.
revoke all    on function public.place_storefront_order(uuid, jsonb) from public, anon;
grant  execute on function public.place_storefront_order(uuid, jsonb) to authenticated, service_role;

-- ─── Comprobación ─────────────────────────────────────────────────────────
-- Igual que en la 101: si el saldo derivado no cuadra con products.stock, la
-- migración no se da por aplicada. El cambio de tipo no toca ninguna cifra,
-- pero la comprobación es barata y es la que garantiza que el cast no perdió
-- datos.

do $$
declare v_mal int;
begin
  -- El `drop` de place_storefront_order deja la tienda muda si los permisos no
  -- vuelven, y eso no se nota hasta que alguien intenta comprar.
  if not has_function_privilege(
       'authenticated', 'public.place_storefront_order(uuid, jsonb)', 'execute') then
    raise exception 'place_storefront_order perdió el grant a authenticated';
  end if;

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
