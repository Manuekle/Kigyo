-- ═══════════════════════════════════════════════════════════════════════════
-- 88 — Pedidos B2B (plan CRM/ERP/POS 4.1)
--
-- `online_orders` cubre el ecommerce público; un pedido comercial de cliente
-- no tenía dónde vivir. Estas dos tablas son ese lugar: el pedido recuerda la
-- cotización de la que nació (`quote_id`) y el cliente al que va dirigido
-- (`client_id`), ambos nullable porque un pedido puede crearse a mano sin
-- origen y un cliente puede borrarse sin arrastrar su historial.
--
-- La conversión cotización → pedido es un RPC (`create_order_from_quote`):
-- valida que la cotización exista, esté Aceptada y no tenga ya un pedido
-- activo, y copia sus líneas sin duplicar (cada línea guarda su origen en
-- `quote_item_id`). El pedido → factura se construye sobre `facturacion` en
-- la UI, no aquí.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.sales_orders (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations (id) on delete cascade,
  code              text,
  client_id         uuid references public.clients (id) on delete set null,
  -- Kept alongside the FK: a sales order must still print the client name it
  -- was made for even if the client row is later removed (quotes only carry
  -- the textual name).
  client_name       text not null default '',
  quote_id          uuid references public.quotes (id) on delete set null,
  status            text not null default 'Borrador'
                    check (status in ('Borrador', 'Confirmado', 'En preparación',
                                      'Despachado', 'Entregado', 'Cancelado')),
  issued_on         date not null default current_date,
  due_on            date,
  payment_terms     text not null default '',
  shipping_address  text not null default '',
  notes             text not null default '',
  subtotal_cents    bigint not null default 0 check (subtotal_cents >= 0),
  discount_cents    bigint not null default 0 check (discount_cents >= 0),
  tax_cents         bigint not null default 0 check (tax_cents >= 0),
  total_cents       bigint not null default 0 check (total_cents >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create table public.sales_order_items (
  id                uuid primary key default gen_random_uuid(),
  sales_order_id    uuid not null references public.sales_orders (id) on delete cascade,
  product_id        uuid references public.products (id) on delete set null,
  quote_item_id     uuid,
  description       text not null,
  quantity          numeric(12, 3) not null check (quantity > 0),
  unit              text not null default 'UN',
  unit_price_cents  bigint not null check (unit_price_cents >= 0),
  subtotal_cents    bigint not null check (subtotal_cents >= 0),
  position          int not null default 0,
  created_at        timestamptz not null default now()
);

create index sales_orders_org_idx
  on public.sales_orders (org_id, created_at desc) where deleted_at is null;
create index sales_orders_quote_idx
  on public.sales_orders (org_id, quote_id) where quote_id is not null and deleted_at is null;
create index sales_order_items_order_idx
  on public.sales_order_items (sales_order_id, position);

create trigger sales_orders_code before insert on public.sales_orders
  for each row execute function app.set_code('sales_order', 'PD', '4');
create trigger sales_orders_touch before update on public.sales_orders
  for each row execute function app.touch_updated_at();

insert into public.permissions (key, module, action, label) values
  ('pedidos:read',  'pedidos', 'read',  'Ver pedidos'),
  ('pedidos:write', 'pedidos', 'write', 'Gestionar pedidos')
on conflict (key) do update set label = excluded.label;

create or replace function app.valid_module_keys(keys text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select keys is null or not exists (
    select 1
    from unnest(keys) as k
    where k not in (
      'empleados', 'asistencia', 'nomina', 'riesgos',
      'reclutamiento', 'capacitacion', 'desempeno', 'proyectos',
      'hseq', 'inventario', 'mantenimiento', 'flota',
      'produccion', 'trazabilidad', 'clientes', 'cotizaciones',
      'leads', 'facturacion', 'compras', 'catalogos',
      'contabilidad', 'caja', 'pos', 'tienda',
      'ecommerce', 'canales', 'tickets', 'firmas',
      'documentos', 'contratos', 'calendario', 'consultoria',
      'ia', 'pacientes', 'estudiantes', 'restaurante',
      'agro', 'inmobiliario', 'hoteleria', 'socios',
      'tiempos', 'suscripciones', 'cartera', 'notificaciones',
      'reportes', 'creditos', 'donantes', 'suscriptores',
      'puestos', 'calidad', 'obra', 'ph',
      'contratacion', 'marketing', 'integraciones', 'portal',
      'pedidos'
    )
  );
$$;

comment on table public.sales_orders is
  'Pedidos comerciales B2B. Nacen de una cotización aceptada o a mano.';
comment on table public.sales_order_items is
  'Líneas de un pedido. `quote_item_id` recuerda la línea de cotización de origen para no duplicarla.';

select app.apply_standard_rls('sales_orders', 'pedidos:read', 'pedidos:write');
select app.apply_child_rls('sales_order_items', 'sales_orders', 'sales_order_id',
                           'pedidos:read', 'pedidos:write');

/**
 * Guardia: el cliente, la cotización y el producto referenciados deben
 * pertenecer a la misma empresa que el pedido.
 */
create or replace function app.guard_sales_order_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.client_id is not null and not exists (
    select 1 from public.clients c
    where c.id = new.client_id and c.org_id = new.org_id and c.deleted_at is null
  ) then
    raise exception 'el cliente debe pertenecer a la misma empresa'
      using errcode = 'check_violation';
  end if;
  if new.quote_id is not null and not exists (
    select 1 from public.quotes q
    where q.id = new.quote_id and q.org_id = new.org_id and q.deleted_at is null
  ) then
    raise exception 'la cotización debe pertenecer a la misma empresa'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger sales_orders_guard_refs
  before insert or update of client_id, quote_id, org_id on public.sales_orders
  for each row execute function app.guard_sales_order_refs();

/**
 * Guardia de líneas: la línea pertenece a un pedido de la misma empresa y su
 * producto (si lo tiene) también. Las líneas no llevan `org_id`; la empresa se
 * averigua desde el pedido padre.
 */
create or replace function app.guard_sales_order_item_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select o.org_id into v_org
  from public.sales_orders o
  where o.id = new.sales_order_id and o.deleted_at is null;

  if v_org is null then
    raise exception 'la línea debe pertenecer a un pedido de la misma empresa'
      using errcode = 'check_violation';
  end if;
  if new.product_id is not null and not exists (
    select 1 from public.products p
    where p.id = new.product_id and p.org_id = v_org and p.deleted_at is null
  ) then
    raise exception 'el producto debe pertenecer a la misma empresa'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger sales_order_items_guard_refs
  before insert or update of product_id on public.sales_order_items
  for each row execute function app.guard_sales_order_item_refs();

/**
 * Conversión cotización aceptada → pedido.
 *
 * Security invoker: leer la cotización pasa por la RLS de quotes (cotizaciones:read)
 * y escribir por la de sales_orders (pedidos:write). Rechaza cotizaciones que
 * no estén Aceptadas o que ya tengan un pedido activo, y copia las líneas
 * guardando `quote_item_id` — la referencia que impide duplicar.
 *
 * Las líneas de cotización se leen del origen en el mismo orden, sin tocar
 * precios ni cantidades.
 */
create or replace function public.create_order_from_quote(
  p_quote_id uuid,
  p_issued_on date default null,
  p_due_on date default null,
  p_payment_terms text default '',
  p_shipping_address text default '',
  p_notes text default ''
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quote   record;
  v_order   uuid;
  v_total   bigint := 0;
  v_item    record;
begin
  if p_quote_id is null then
    raise exception 'falta la cotización' using errcode = 'KG102';
  end if;

  select * into v_quote
  from public.quotes
  where id = p_quote_id and deleted_at is null;

  if v_quote.id is null then
    raise exception 'la cotización no existe o no puedes verla' using errcode = 'KG103';
  end if;
  if v_quote.status <> 'Aceptada' then
    raise exception 'solo una cotización aceptada genera un pedido' using errcode = 'KG104';
  end if;
  if exists (
    select 1 from public.sales_orders o
    where o.quote_id = p_quote_id and o.deleted_at is null
      and o.status <> 'Cancelado'
  ) then
    raise exception 'esta cotización ya tiene un pedido' using errcode = 'KG105';
  end if;

  insert into public.sales_orders (
    org_id, client_id, client_name, quote_id, status, issued_on, due_on,
    payment_terms, shipping_address, notes
  ) values (
    v_quote.org_id, null, v_quote.client, p_quote_id, 'Confirmado',
    coalesce(p_issued_on, current_date), p_due_on,
    btrim(p_payment_terms), btrim(p_shipping_address), btrim(p_notes)
  )
  returning id into v_order;

  for v_item in
    select i.id, i.product_id, i.description, i.quantity, i.unit_price_cents, i.position
    from public.quote_items i
    where i.quote_id = p_quote_id
    order by i.position
  loop
    insert into public.sales_order_items (
      sales_order_id, product_id, quote_item_id, description, quantity,
      unit, unit_price_cents, subtotal_cents, position
    ) values (
      v_order, v_item.product_id, v_item.id, v_item.description, v_item.quantity,
      'UN', v_item.unit_price_cents,
      (v_item.unit_price_cents * v_item.quantity)::bigint, v_item.position
    );
    v_total := v_total + (v_item.unit_price_cents * v_item.quantity)::bigint;
  end loop;

  update public.sales_orders
  set subtotal_cents = v_total, total_cents = v_total
  where id = v_order;

  return v_order;
end;
$$;

revoke all on function public.create_order_from_quote(uuid, date, date, text, text, text) from public, anon;
grant execute on function public.create_order_from_quote(uuid, date, date, text, text, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop function if exists public.create_order_from_quote(uuid, date, date, text, text, text);
--   drop trigger if exists sales_order_items_guard_refs on public.sales_order_items;
--   drop function if exists app.guard_sales_order_item_refs();
--   drop trigger if exists sales_orders_guard_refs on public.sales_orders;
--   drop function if exists app.guard_sales_order_refs();
--   drop table if exists public.sales_order_items;
--   drop table if exists public.sales_orders;
-- ═══════════════════════════════════════════════════════════════════════════