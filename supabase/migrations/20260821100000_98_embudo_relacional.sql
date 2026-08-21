-- ═══════════════════════════════════════════════════════════════════════════
-- 98 — El embudo comercial deja de ser una cadena de nombres sueltos.
--
-- La interfaz enseña Lead → Cliente → Cotización → Pedido → Factura → Pago, y
-- de esa cadena solo tres eslabones existían como relación:
--
--     leads.converted_client_id  → clients.id     ✓
--     quotes.client              = text                 ✗ nombre, no ficha
--     sales_orders.client_id     = null siempre         ✗ ver abajo
--     sales_orders.quote_id      → quotes.id       ✓
--     invoices.quote_id          → quotes.id       ✓
--     invoices.sales_order_id    no existía             ✗
--     invoice_payments.invoice_id→ invoices.id     ✓
--
-- Dos consecuencias, y ninguna es cosmética:
--
-- 1. «¿Qué le hemos cotizado a este cliente?» no se puede responder con un
--    join. Se puede responder comparando cadenas, que es otra cosa: dos
--    clientes que se llamen «Distribuciones del Norte» son el mismo cliente
--    para esa consulta, y el mismo cliente escrito «Distr. del Norte» en una
--    cotización y «Distribuciones del Norte» en otra son dos.
--
-- 2. `leads_convert()` crea una ficha de cliente que la cotización siguiente
--    no usa. El embudo que el producto vende como continuo se corta justo
--    después de la conversión, que es donde empieza a valer dinero.
--
-- Y `create_order_from_quote` lo hacía explícito, insertando null a mano:
--
--     insert into public.sales_orders (org_id, client_id, client_name, …)
--     values (v_quote.org_id, null, v_quote.client, …)
--
-- No era un descuido: la cotización no tenía de dónde sacar el id. Esta
-- migración le da uno, y el RPC deja de escribir null.
--
-- ─── Por qué ahora ─────────────────────────────────────────────────────────
--
-- Porque hoy sale gratis. Medido antes de escribir esto:
--
--     quotes 0 · sales_orders 0 · invoices 0 · clients 0
--
-- No hay una sola fila que rellenar, ni un solo nombre ambiguo que resolver a
-- mano. Dentro de seis meses esta misma migración es un proyecto de conciliación
-- con un informe de casos dudosos, y alguien decidiendo cliente por cliente.
--
-- ─── Por qué `quotes.client` sobrevive ─────────────────────────────────────
--
-- Se queda como estaba, y no como duplicado por pereza: es el mismo patrón que
-- `invoices.client_name` ya usa. El nombre impreso en un documento comercial es
-- el nombre que se pactó ese día. Si el cliente se renombra —o se borra— la
-- cotización de marzo debe seguir diciendo lo que decía en marzo. La ficha
-- responde «quién es»; el texto responde «cómo se llamaba». `on delete set
-- null` hace justo eso: se pierde el vínculo, nunca el documento.
--
-- Ambas columnas quedan nullable a propósito. Una cotización a alguien que
-- todavía no es cliente —el caso normal en frío— tiene que poder existir.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Cotización → ficha de cliente ─────────────────────────────────────────

alter table public.quotes
  add column if not exists client_id uuid references public.clients (id) on delete set null;

comment on column public.quotes.client_id is
  'Ficha del cliente, cuando ya existe. `client` conserva el nombre pactado.';

-- Parcial por `deleted_at`: el índice sirve a «cotizaciones de este cliente»,
-- que nunca quiere las borradas.
create index if not exists quotes_client_idx
  on public.quotes (client_id) where deleted_at is null;

-- ─── Pedido → factura ──────────────────────────────────────────────────────

alter table public.invoices
  add column if not exists sales_order_id uuid references public.sales_orders (id) on delete set null;

comment on column public.invoices.sales_order_id is
  'Pedido que originó la factura. Null en una factura directa, sin pedido previo.';

create index if not exists invoices_sales_order_idx
  on public.invoices (sales_order_id) where deleted_at is null;

-- ─── Que la referencia no cruce empresas ───────────────────────────────────
--
-- La RLS impide leer filas de otra empresa, pero no impide *apuntar* a una: un
-- id ajeno en un insert pasa la política de la fila que se escribe, porque la
-- política mira `org_id` de la propia fila y no a dónde apuntan sus columnas.
-- Es el mismo agujero que `guard_supplier_ref` y `guard_quote_stage_org` ya
-- tapan, y se tapa igual.

create or replace function app.guard_quote_client_org()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.client_id is not null and not exists (
    select 1 from public.clients c
    where c.id = new.client_id and c.org_id = new.org_id
  ) then
    raise exception 'el cliente debe pertenecer a la misma empresa que la cotización'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_client_same_org on public.quotes;
create trigger quotes_client_same_org
before insert or update of client_id, org_id on public.quotes
for each row execute function app.guard_quote_client_org();

create or replace function app.guard_invoice_order_org()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.sales_order_id is not null and not exists (
    select 1 from public.sales_orders o
    where o.id = new.sales_order_id and o.org_id = new.org_id
  ) then
    raise exception 'el pedido debe pertenecer a la misma empresa que la factura'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_order_same_org on public.invoices;
create trigger invoices_order_same_org
before insert or update of sales_order_id, org_id on public.invoices
for each row execute function app.guard_invoice_order_org();

-- ─── El RPC deja de escribir null ──────────────────────────────────────────
--
-- Mismo cuerpo que la migración 88 salvo la línea del cliente. Se reescribe
-- entero porque `create or replace` lo exige, no porque haya cambiado nada más
-- — las cinco comprobaciones (KG102 falta cotización, KG103 no existe, KG104 no
-- aceptada, KG105 ya tiene pedido) siguen palabra por palabra.

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
    -- Aquí estaba el `null`. El pedido hereda la ficha de la cotización y el
    -- nombre por separado, que es exactamente lo que la factura ya hacía.
    v_quote.org_id, v_quote.client_id, v_quote.client, p_quote_id, 'Confirmado',
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

-- Nota sobre lo que esta migración deliberadamente NO cambia: `quantity` es
-- numeric(12,2), así que `(unit_price_cents * quantity)::bigint` trunca en vez
-- de redondear — media unidad a 333 centavos factura 166, no 167. Es el
-- comportamiento vigente desde la migración 88 y se conserva palabra por
-- palabra. Corregirlo aquí sería meter un cambio de importes dentro de un
-- cambio de relaciones, y quien revise esta migración por el cliente no estaría
-- revisando eso. Va aparte, con su propia prueba.
