-- ═══════════════════════════════════════════════════════════════════════════
-- 100 — La suspensión también dentro de los RPC que saltan RLS.
--
-- La migración 99 cerró el camino de `authenticated` a PostgREST: 543
-- políticas RESTRICTIVE que niegan INSERT/UPDATE/DELETE cuando la empresa no
-- está activa. Queda un camino que esa capa no puede cubrir por construcción.
--
-- Las funciones `security definer` son de `postgres`, y `postgres` tiene
-- `rolbypassrls = true` — verificado en `pg_roles`. No ven ninguna política,
-- ni la de aislamiento ni la de suspensión. Lo que sí ven es lo que ellas
-- mismas comprueban, y todas comprueban `app.orgs_with('x:write')`, que
-- responde «esta persona puede escribir aquí» y nunca «esta empresa está al
-- día». Como además están concedidas a `authenticated`, se pueden llamar
-- directamente desde el navegador con la anon key pública, sin que corra una
-- línea de `requirePermission`.
--
-- ─── Las tres, y por qué solo estas tres ───────────────────────────────────
--
--   · `register_pos_sale`       — una empresa impaga vendiendo
--   · `place_storefront_order`  — su tienda online tomando pedidos
--   · `void_pos_sale`           — anulando ventas, que también mueve stock
--
-- Las otras cuatro `definer` que escriben y están concedidas a `authenticated`
-- —`post_auto_entry`, `lock_payroll_period`, `create_ticket_portal_token`,
-- `revoke_ticket_portal_tokens`— quedan sin tocar en esta migración, y es una
-- decisión, no un olvido: ninguna crea negocio nuevo. La primera solo anota lo
-- que otra operación ya hizo; las otras cierran un periodo o reparten un enlace.
-- Van cuando toque, con su propia prueba.
--
-- Fuera también, a propósito: `complete_company_setup`, `join_company`,
-- `set_active_company`, `create_account`. Son el ciclo de vida de la cuenta, y
-- bloquearlas dejaría a alguien encerrado fuera de la empresa que está
-- intentando pagar — el estado del que no se sale desde dentro.
--
-- Y fuera el portal público (`portal_view`, `portal_open_ticket`,
-- `portal_reply_ticket`): quien los usa es un cliente de la empresa, un
-- tercero que no tiene nada que ver con la deuda de su proveedor. Romperle un
-- enlace a él para cobrarle a otro es cobrarle a quien no debe.
--
-- ─── Cómo se escribió esta migración ───────────────────────────────────────
--
-- Los tres cuerpos NO están transcritos a mano. Se leyeron de
-- `pg_get_functiondef()` y se les insertó el bloque por búsqueda exacta de la
-- línea que ya lanzaba el error de permiso, verificando que el ancla apareciera
-- exactamente una vez. Cada función crece 9 líneas y ni una más — es
-- comprobable comparando contra la definición anterior. La primera vez que
-- reescribí un RPC de estos a mano, en la migración 98, se me desviaron tres
-- cosas (un `round` por un cast, `subtotal_cents` sin escribir, una variable
-- perdida). No se repite el método.
--
-- `KG106` es el código nuevo, para que la aplicación pueda distinguir «tu plan
-- está inactivo» de «no tienes permiso» (KG101) sin leer el texto del mensaje.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── register_pos_sale ─────────────────────────────────────────────────

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
    select w.product_id, w.quantity, p.id as found_id, p.name, p.stock, p.price_cents
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

  v_total := greatest(v_subtotal - least(p_discount_cents, v_subtotal), 0);

  update public.products p
     set stock = p.stock - w.quantity
    from unnest(v_ids, v_quantities) as w(product_id, quantity)
   where p.id     = w.product_id
     and p.org_id = p_org_id;

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
     total_cents, payment_method, sold_by, notes, status, client_uuid)
  values
    (p_org_id, v_session_id, coalesce(v_site_id, p_site_id),
     coalesce(btrim(p_customer_name), ''), v_subtotal,
     least(coalesce(p_discount_cents, 0), v_subtotal), v_total,
     coalesce(p_payment_method, 'Efectivo'), v_employee_id, coalesce(p_notes, ''),
     case when p_pending then 'Pendiente' else 'Pagada' end,
     p_client_uuid)
  returning id into v_sale_id;

  insert into public.pos_sale_items
    (sale_id, product_id, sku, name, quantity, unit_price_cents, total_cents)
  select v_sale_id, p.id, p.sku, p.name, w.quantity, p.price_cents,
         p.price_cents * w.quantity
  from unnest(v_ids, v_quantities) as w(product_id, quantity)
  join public.products p on p.id = w.product_id and p.org_id = p_org_id;

  return query
  select s.id, s.code, s.total_cents from public.pos_sales s where s.id = v_sale_id;
end;
$function$;

-- ─── void_pos_sale ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.void_pos_sale(p_sale_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_org_id uuid;
  v_status text;
begin
  select s.org_id, s.status into v_org_id, v_status
  from public.pos_sales s where s.id = p_sale_id;

  if v_org_id is null then
    raise exception 'Esa venta no existe.' using errcode = 'KG102';
  end if;

  if v_org_id not in (select app.orgs_with('pos:write')) then
    raise exception 'No tienes permiso para anular ventas.' using errcode = 'KG101';
  end if;

  -- La suspensión, que esta función no puede ver por su cuenta.
  --
  -- La migración 99 la puso en RLS como política RESTRICTIVE, y eso cubre a
  -- `authenticated` hablando con PostgREST. No cubre esto: la función es
  -- `security definer` y su dueño es `postgres`, que tiene `rolbypassrls`, así
  -- que ninguna política la toca. Y está concedida a `authenticated`, o sea
  -- que se puede llamar directamente sin pasar por `requirePermission`.
  if not app.company_is_active(v_org_id) then
    raise exception 'Esta empresa está en modo solo lectura: el plan está inactivo.'
      using errcode = 'KG106';
  end if;

  if v_status = 'Anulada' then
    return true;
  end if;

  update public.products p
     set stock = p.stock + i.quantity
    from public.pos_sale_items i
   where i.sale_id    = p_sale_id
     and p.id         = i.product_id
     and p.org_id     = v_org_id;

  update public.pos_sales set status = 'Anulada' where id = p_sale_id;
  return true;
end;
$function$;

-- ─── place_storefront_order ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.place_storefront_order(p_org_id uuid, p_items jsonb)
 RETURNS TABLE(order_code text, order_item text, order_quantity integer, order_price_cents bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ids         uuid[];
  v_quantities  int[];
  v_employee_id uuid;
  v_line        record;
begin
  -- SECURITY DEFINER bypasses RLS, so authorization is checked here instead.
  -- The permission asked for is `tienda:write`, not `catalogos:write`: buying
  -- moves stock, and a buyer should be able to do that without also being
  -- allowed to edit the catalogue — which is what the RLS policy on `products`
  -- demands, and why the old application-side UPDATE silently affected zero
  -- rows for anyone who was not also a catalogue editor.
  if p_org_id is null or p_org_id not in (select app.orgs_with('tienda:write')) then
    raise exception 'No tienes permiso para comprar en la tienda.'
      using errcode = 'KG001';
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

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío.' using errcode = 'KG002';
  end if;

  if jsonb_array_length(p_items) > 50 then
    raise exception 'El carrito tiene demasiadas líneas.' using errcode = 'KG002';
  end if;

  -- Folded by product: the same item added twice is one decrement of the sum,
  -- not two decrements computed from the same stale stock where the last write
  -- wins and the difference disappears.
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
    raise exception 'El carrito no es válido.' using errcode = 'KG002';
  end if;

  if exists (select 1 from unnest(v_quantities) q where q is null or q < 1 or q > 9999) then
    raise exception 'La cantidad pedida no es válida.' using errcode = 'KG002';
  end if;

  -- Locks every line before anything is read for the check below, in id order
  -- so two carts holding the same two products cannot deadlock by taking them
  -- in opposite orders. The lock is what makes read-then-decrement safe: a
  -- concurrent checkout now waits here and re-reads the stock it left behind.
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

  update public.products p
     set stock = p.stock - w.quantity
    from unnest(v_ids, v_quantities) as w(product_id, quantity)
   where p.id     = w.product_id
     and p.org_id = p_org_id;

  -- Who asked. The column existed and was never filled, which left the
  -- inventory screen showing orders nobody appeared to have placed.
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
           p.price_cents * w.quantity,
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
