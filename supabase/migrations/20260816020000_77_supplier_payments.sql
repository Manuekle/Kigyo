-- ═══════════════════════════════════════════════════════════════════════════
-- 77 — Pagos a proveedores y calendario (plan CRM/ERP/POS 2.3)
--
-- Las facturas de proveedor existían desde la migración 03, pero un pago
-- contra ellas no se registraba en ningún lado: el estado pasaba a «Pagada»
-- a mano y el calendario de lo que hay que pagar vivía en la cabeza de
-- alguien. Un pago es una fila, y con filas se puede sumar, programar y
-- anticipar la semana.
--
-- Cada fila es pago hecho (`paid_on`) O pago programado (`scheduled_on`),
-- nunca ambos — el check lo dice. El RPC registra el pago y, cuando la suma
-- cubre la factura, la marca Pagada en la misma transacción; la UI nunca
-- vuelve a tocar el estado a mano para esto.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.supplier_payments (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations (id) on delete cascade,
  supplier_invoice_id uuid not null references public.supplier_invoices (id) on delete cascade,
  amount_cents        bigint not null check (amount_cents > 0),
  method              text not null default 'Transferencia',
  reference           text not null default '',
  paid_on             date,
  scheduled_on        date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check ((paid_on is null) <> (scheduled_on is null))
);

create index supplier_payments_invoice_idx
  on public.supplier_payments (supplier_invoice_id, created_at desc);
create index supplier_payments_scheduled_idx
  on public.supplier_payments (org_id, scheduled_on) where scheduled_on is not null;

create trigger supplier_payments_touch before update on public.supplier_payments
  for each row execute function app.touch_updated_at();

comment on table public.supplier_payments is
  'Pagos hechos o programados contra facturas de proveedor. Uno u otro: paid_on o scheduled_on.';

-- Mismo par de permisos que supplier_invoices (migración 03): el inventario
-- es quien paga a sus proveedores.
select app.apply_standard_rls('supplier_payments', 'inventario:read', 'inventario:write');

/**
 * El pago pertenece a una factura de la misma empresa.
 */
create or replace function app.guard_supplier_payment_org()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.supplier_invoices i
    where i.id = new.supplier_invoice_id and i.org_id = new.org_id and i.deleted_at is null
  ) then
    raise exception 'el pago debe pertenecer a una factura de la misma empresa'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger supplier_payments_guard_org
  before insert or update of supplier_invoice_id, org_id on public.supplier_payments
  for each row execute function app.guard_supplier_payment_org();

/**
 * Registra un pago (hecho o programado) y, si la factura queda cubierta,
 * la marca Pagada.
 *
 * Security invoker: leer la factura pasa por la RLS de supplier_invoices
 * (inventario:read) e insertar el pago por la de supplier_payments
 * (inventario:write). El sobrepago se rechaza aquí mismo — el error de
 * negocio no tiene pantalla en PostgREST.
 */
create or replace function public.register_supplier_payment(
  p_invoice_id   uuid,
  p_amount_cents bigint,
  p_method       text default 'Transferencia',
  p_reference    text default '',
  p_paid_on      date default null,
  p_scheduled_on date default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice public.supplier_invoices%rowtype;
  v_total   bigint;
  v_paid    bigint;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'el monto debe ser positivo' using errcode = 'KG101';
  end if;
  if (p_paid_on is null) = (p_scheduled_on is null) then
    raise exception 'el pago es hecho o programado, no ambos ni ninguno' using errcode = 'KG102';
  end if;

  select * into v_invoice
  from public.supplier_invoices
  where id = p_invoice_id and deleted_at is null;

  if v_invoice.id is null then
    raise exception 'la factura no existe o no puedes verla' using errcode = 'KG103';
  end if;
  if v_invoice.status in ('Pagada', 'Anulada') then
    raise exception 'esta factura ya está cerrada' using errcode = 'KG104';
  end if;

  select coalesce(sum(i.subtotal_cents), 0) into v_total
  from public.supplier_invoice_items i
  where i.supplier_invoice_id = p_invoice_id;

  select coalesce(sum(p.amount_cents), 0) into v_paid
  from public.supplier_payments p
  where p.supplier_invoice_id = p_invoice_id and p.paid_on is not null;

  if p_paid_on is not null and v_paid + p_amount_cents > v_total then
    raise exception 'el pago supera el saldo de la factura' using errcode = 'KG105';
  end if;

  insert into public.supplier_payments (
    org_id, supplier_invoice_id, amount_cents, method, reference, paid_on, scheduled_on
  ) values (
    v_invoice.org_id, p_invoice_id, p_amount_cents, btrim(p_method), btrim(p_reference),
    p_paid_on, p_scheduled_on
  );

  if p_paid_on is not null and v_paid + p_amount_cents >= v_total then
    update public.supplier_invoices
    set status = 'Pagada'
    where id = p_invoice_id and status in ('Pendiente', 'En revisión');
  end if;

  return true;
end;
$$;

revoke all on function public.register_supplier_payment(uuid, bigint, text, text, date, date) from public, anon;
grant execute on function public.register_supplier_payment(uuid, bigint, text, text, date, date) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop function if exists public.register_supplier_payment(uuid, bigint, text, text, date, date);
--   drop trigger if exists supplier_payments_guard_org on public.supplier_payments;
--   drop function if exists app.guard_supplier_payment_org();
--   drop table if exists public.supplier_payments;
-- ═══════════════════════════════════════════════════════════════════════════
