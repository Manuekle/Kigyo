-- ═══════════════════════════════════════════════════════════════════════════
-- 12 — Storefront checkout, in one transaction.
--
-- The checkout used to run from the application: read the products, then one
-- UPDATE per line to move stock, then one INSERT for the order. Through
-- PostgREST each of those is its own transaction, so a connection lost halfway
-- left stock deducted for goods nobody ordered and no order to reconcile it
-- against. Two people buying the last unit at the same time both saw it
-- available, because nothing held a lock between the read and the write.
--
-- PostgREST runs one function call inside one transaction. Moving the whole
-- checkout in here makes it atomic — either stock moved and the order exists,
-- or neither happened — and lets it take row locks that survive until commit.
-- ═══════════════════════════════════════════════════════════════════════════

-- Business failures raise with a `KG…` SQLSTATE so the application can tell
-- "the cart is stale" from "the database is broken", and can show the message
-- verbatim: every KG message is written here for the buyer to read.
--
--   KG001 — not allowed to buy in this organization
--   KG002 — the cart itself is malformed
--   KG003 — a line no longer holds (product gone, or not enough stock)
create or replace function public.place_storefront_order(
  p_org_id uuid,
  p_items  jsonb
)
returns table (
  order_code        text,
  order_item        text,
  order_quantity    int,
  order_price_cents bigint
)
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

-- CREATE FUNCTION grants EXECUTE to PUBLIC, and migration 08's default
-- privileges cover tables and sequences, not functions — so without this the
-- anon key could call a SECURITY DEFINER function that writes stock.
revoke all    on function public.place_storefront_order(uuid, jsonb) from public, anon;
grant  execute on function public.place_storefront_order(uuid, jsonb) to authenticated;
