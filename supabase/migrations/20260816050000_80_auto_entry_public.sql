-- ═══════════════════════════════════════════════════════════════════════════
-- 80 — post_auto_entry vive en public (corrección de la 79)
--
-- La 79 creó el RPC de asientos automáticos en `app`, que PostgREST no
-- expone: los mutations del servidor nunca lo habrían podido invocar. Mismo
-- patrón que la 58: la función se recrea en public y se suelta la de app.
-- El cuerpo es idéntico salvo el esquema.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.post_auto_entry(
  p_org_id        uuid,
  p_concepto      text,
  p_source        text,
  p_source_id     uuid,
  p_memo          text,
  p_entry_date    date,
  p_amount_cents  bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_debit   text;
  v_credit  text;
  v_entry   uuid;
  v_amount  bigint := p_amount_cents;
begin
  -- Validación de membresía dentro del definer: post_auto_entry lo llaman
  -- mutations que ya pasaron requirePermission, pero un definer no hereda la
  -- RLS del caller y este es el único chequeo que importa.
  if not exists (
    select 1 from public.organizations o
    where o.id = p_org_id
      and o.id in (select app.orgs_with('contabilidad:write'))
  ) then
    raise exception 'sin permiso para contabilizar' using errcode = 'insufficient_privilege';
  end if;

  if p_amount_cents = 0 then
    return null; -- nada que contabilizar (p. ej. cierre de caja cuadrado)
  end if;

  -- El mapeo por empresa gana; si no existe, el código fijo del concepto.
  select
    coalesce((select m.account_id from public.org_account_mappings m
              where m.org_id = p_org_id and m.concepto = p_concepto), d.debit),
    coalesce((select m.account_id from public.org_account_mappings m
              where m.org_id = p_org_id and m.concepto = p_concepto), d.credit)
  into v_debit, v_credit
  from (values
    ('venta_credito',   '1305', '4135'),
    ('cobro',           '1105', '1305'),
    ('compra',          '1435', '2205'),
    ('pago_proveedor',  '2205', '1105'),
    ('caja_diferencia', null,   null)
  ) as d(concepto, debit, credit)
  where d.concepto = p_concepto;

  if v_debit is null and p_concepto = 'caja_diferencia' then
    -- Un faltante es un gasto diverso; un sobrante, un ingreso diverso.
    if v_amount > 0 then
      v_debit := '5195'; v_credit := '1105';
    else
      v_debit := '1105'; v_credit := '4295';
      v_amount := -v_amount;
    end if;
  end if;

  if v_debit is null or v_credit is null then
    raise exception 'concepto desconocido: %', p_concepto;
  end if;

  insert into public.journal_entries (org_id, entry_date, memo, source, source_id, status, posted_at)
  values (p_org_id, p_entry_date, btrim(p_memo), p_source, p_source_id, 'Publicado', now())
  returning id into v_entry;

  insert into public.journal_lines (org_id, entry_id, account_id, description, debit_cents, credit_cents) values
    (p_org_id, v_entry, v_debit,  btrim(p_memo), v_amount, 0),
    (p_org_id, v_entry, v_credit, btrim(p_memo), 0,       v_amount);

  return v_entry;
end;
$$;

revoke all on function public.post_auto_entry(uuid, text, text, uuid, text, date, bigint) from public, anon;
grant execute on function public.post_auto_entry(uuid, text, text, uuid, text, date, bigint) to authenticated;

drop function if exists app.post_auto_entry(uuid, text, text, uuid, text, date, bigint);

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop function if exists public.post_auto_entry(uuid, text, text, uuid, text, date, bigint);
-- ═══════════════════════════════════════════════════════════════════════════
