-- ═══════════════════════════════════════════════════════════════════════════
-- 84 — Venta pendiente de pago en línea (plan CRM/ERP/POS 3.3, decisión:
--      pasarela = capability Enterprise)
--
-- El flujo QR: el POS crea la venta como Pendiente (existencias ya
-- descontadas, misma atomicidad que cobrar en efectivo) y la intención de
-- pago se crea contra Wompi; solo el webhook firmado la marca Pagada. La
-- venta NUNCA se cobra por sondeo del cliente — el proveedor es la fuente de
-- verdad, el webhook es el único camino a «Pagada».
--
-- Una venta Pendiente se ve en el historial y se puede anular como cualquier
-- otra (void_pos_sale devuelve existencias y la marca Anulada).
-- ═══════════════════════════════════════════════════════════════════════════

-- El estado nuevo entra al vocabulario de la venta.
alter table public.pos_sales
  drop constraint if exists pos_sales_status_check;
alter table public.pos_sales
  add constraint pos_sales_status_check
  check (status in ('Pagada', 'Pendiente', 'Anulada'));

alter table public.pos_sales
  drop constraint if exists pos_sales_payment_method_check;
alter table public.pos_sales
  add constraint pos_sales_payment_method_check
  check (payment_method in ('Transferencia', 'Efectivo', 'Tarjeta', 'Cheque', 'QR Wompi', 'Otro'));

-- register_pos_sale aprende a dejar la venta pendiente. La firma cambia
-- (parámetro con default), así que se suelta y se recrea: los callers pasan
-- argumentos con nombre y no notan la diferencia.
drop function if exists public.register_pos_sale(uuid, jsonb, text, text, bigint, text);

create or replace function public.register_pos_sale(
  p_org_id         uuid,
  p_items          jsonb,
  p_payment_method text default 'Efectivo',
  p_customer_name  text default '',
  p_discount_cents bigint default 0,
  p_notes          text default '',
  p_pending        boolean default false
)
returns table (sale_id uuid, sale_code text, sale_total_cents bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids         uuid[];
  v_quantities  int[];
  v_line        record;
  v_employee_id uuid;
  v_session_id  uuid;
  v_sale_id     uuid;
  v_subtotal    bigint := 0;
  v_total       bigint;
begin
  if p_org_id is null or p_org_id not in (select app.orgs_with('pos:write')) then
    raise exception 'No tienes permiso para vender.' using errcode = 'KG101';
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

  select s.id into v_session_id
  from public.cash_sessions s
  where s.org_id = p_org_id and s.status = 'Abierta'
  limit 1;

  insert into public.pos_sales
    (org_id, session_id, customer_name, subtotal_cents, discount_cents,
     total_cents, payment_method, sold_by, notes, status)
  values
    (p_org_id, v_session_id, coalesce(btrim(p_customer_name), ''), v_subtotal,
     least(coalesce(p_discount_cents, 0), v_subtotal), v_total,
     coalesce(p_payment_method, 'Efectivo'), v_employee_id, coalesce(p_notes, ''),
     case when p_pending then 'Pendiente' else 'Pagada' end)
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
$$;

revoke all on function public.register_pos_sale(uuid, jsonb, text, text, bigint, text, boolean)
  from public, anon;
grant execute on function public.register_pos_sale(uuid, jsonb, text, text, bigint, text, boolean)
  to authenticated;

/**
 * Confirma un pago en línea a partir del evento del proveedor.
 *
 * SOLO lo llama el webhook con service role (la política de pos_payments no
 * deja escribir a nadie más). Idempotente: un evento reentregado encuentra el
 * pago ya Confirmado y responde true sin tocar nada. El Rechazo no anula la
 * venta — la deja Pendiente, visible en el historial para anularla a mano.
 */
create or replace function public.confirm_pos_payment(p_event_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.pos_payments%rowtype;
begin
  select * into v_payment
  from public.pos_payments
  where event_id = p_event_id;

  if v_payment.id is null then
    return false;
  end if;

  if v_payment.status = 'Confirmado' then
    return true; -- reentrega: ya aplicado
  end if;

  update public.pos_payments
  set status = 'Confirmado', confirmed_at = now()
  where id = v_payment.id;

  update public.pos_sales
  set status = 'Pagada'
  where id = v_payment.sale_id
    and status = 'Pendiente';

  return true;
end;
$$;

revoke all on function public.confirm_pos_payment(text) from public, anon, authenticated;

/**
 * Marca el rechazo del proveedor. La venta queda Pendiente para anularla.
 */
create or replace function public.reject_pos_payment(p_event_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.pos_payments%rowtype;
begin
  select * into v_payment
  from public.pos_payments
  where event_id = p_event_id;

  if v_payment.id is null then
    return false;
  end if;

  update public.pos_payments
  set status = 'Rechazado'
  where id = v_payment.id
    and status <> 'Confirmado';

  return true;
end;
$$;

revoke all on function public.reject_pos_payment(text) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop function if exists public.reject_pos_payment(text);
--   drop function if exists public.confirm_pos_payment(text);
--   drop function if exists public.register_pos_sale(uuid, jsonb, text, text, bigint, text, boolean);
--   -- y recrear la register_pos_sale de la 43 sin p_pending, y los checks
--   -- anteriores de pos_sales
-- ═══════════════════════════════════════════════════════════════════════════
