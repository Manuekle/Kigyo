-- ═══════════════════════════════════════════════════════════════════════════
-- 81 — register_supplier_payment devuelve el id del pago
--
-- La 77 devolvía boolean, y el asiento automático del pago a proveedor
-- necesita el id de la fila como source_id (idempotencia por evento).
-- Mismo cuerpo, retorno uuid. Patrón 57/58: create or replace sobre la ya
-- aplicada.
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.register_supplier_payment(uuid, bigint, text, text, date, date);

create or replace function public.register_supplier_payment(
  p_invoice_id   uuid,
  p_amount_cents bigint,
  p_method       text default 'Transferencia',
  p_reference    text default '',
  p_paid_on      date default null,
  p_scheduled_on date default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice public.supplier_invoices%rowtype;
  v_total   bigint;
  v_paid    bigint;
  v_payment uuid;
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
  )
  returning id into v_payment;

  if p_paid_on is not null and v_paid + p_amount_cents >= v_total then
    update public.supplier_invoices
    set status = 'Pagada'
    where id = p_invoice_id and status in ('Pendiente', 'En revisión');
  end if;

  return v_payment;
end;
$$;


revoke all on function public.register_supplier_payment(uuid, bigint, text, text, date, date) from public, anon;
grant execute on function public.register_supplier_payment(uuid, bigint, text, text, date, date) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   -- recrear la versión boolean de la 77 si hiciera falta
-- ═══════════════════════════════════════════════════════════════════════════
