-- ═══════════════════════════════════════════════════════════════════════════
-- 93 — POS offline: cola local con idempotencia por client_uuid
--
-- El punto fino de la ventas offline es qué hace el servidor cuando una
-- venta se reintenta: la red vuelve, el reintento dispara, la venta ya
-- llegó, y el segundo intento o bien duplica o bien hay que saber que ya
-- existía. El Idempotency-Key del navegador entra como `client_uuid`: si
-- la venta ya está registrada con ese uuid, el segundo intento encuentra
-- su venta y la devuelve sin recobrar existencias ni reescribir nada.
--
-- La columna `client_uuid` es nullable y se queda nullable para que las
-- ventas antiguas y las que vayan online directo sigan funcionando sin
-- enviarlo. El índice unique parcial (org_id, client_uuid) where not null
-- es la protección: dos ventas con el mismo client_uuid para la misma
-- empresa no existen; el segundo intento choca y se recupera vía el
-- early return de la función.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.pos_sales
  add column if not exists client_uuid uuid;

-- Unique por (org_id, client_uuid) pero solo donde client_uuid está
-- presente: un null significa "venta en línea, sin cola", y dos ventas
-- en línea no deben romper un unique index.
create unique index if not exists pos_sales_org_client_uuid_key
  on public.pos_sales (org_id, client_uuid)
  where client_uuid is not null;

-- ─── register_pos_sale con client_uuid e idempotencia ─────────────────────

-- La firma anterior tenía siete parámetros (p_org_id, p_items,
-- p_payment_method, p_customer_name, p_discount_cents, p_notes, p_pending).
-- Drop y recreo con `p_client_uuid` añadido al final (default null):
-- callers antiguos que no envían el parámetro siguen funcionando.
drop function if exists public.register_pos_sale(uuid, jsonb, text, text, bigint, text, boolean);

create or replace function public.register_pos_sale(
  p_org_id         uuid,
  p_items          jsonb,
  p_payment_method text default 'Efectivo',
  p_customer_name  text default '',
  p_discount_cents bigint default 0,
  p_notes          text default '',
  p_pending        boolean default false,
  p_client_uuid    uuid default null
)
returns table (sale_id uuid, sale_code text, sale_total_cents bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.pos_sales%rowtype;
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
     total_cents, payment_method, sold_by, notes, status, client_uuid)
  values
    (p_org_id, v_session_id, coalesce(btrim(p_customer_name), ''), v_subtotal,
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
$$;

revoke all on function public.register_pos_sale(uuid, jsonb, text, text, bigint, text, boolean, uuid)
  from public, anon;
grant execute on function public.register_pos_sale(uuid, jsonb, text, text, bigint, text, boolean, uuid)
  to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop function if exists public.register_pos_sale(uuid, jsonb, text, text, bigint, text, boolean, uuid);
--   -- y recrear la 43 sin p_client_uuid:
--   -- create or replace function public.register_pos_sale(...) sin client_uuid
--   -- y replicar el cuerpo previo (mig 84).
--   drop index if exists pos_sales_org_client_uuid_key;
--   alter table public.pos_sales drop column if exists client_uuid;
-- ═══════════════════════════════════════════════════════════════════════════