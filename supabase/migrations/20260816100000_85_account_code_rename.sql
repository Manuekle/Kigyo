-- ═══════════════════════════════════════════════════════════════════════════
-- 85 — account_id → account_code en contabilidad
--
-- El test de alcance de cuenta (account-scope.test.ts) barre las migraciones
-- y exige que ninguna tabla de negocio declare una columna `account_id`:
-- las tablas de negocio aíslan por org_id, que significa empresa (AGENTS.md).
-- En contabilidad la columna referencia el plan de cuentas PUC, que es data
-- global — el nombre correcto era `account_code` (es un código de cuenta,
-- no una entidad). Se renombra en ambas tablas.
--
-- Patrón 57/58: la 79 queda corregida para bases frescas y esta migración
-- renombra en la remota ya aplicada.
-- ═══════════════════════════════════════════════════════════════════════════

drop index if exists public.journal_lines_account_idx;

-- RENAME COLUMN no admite IF EXISTS; el rename condicional se hace a mano
-- para que la 85 corra igual sobre una remota (que ya traía account_id de
-- la 79 original) que sobre una base fresca (donde la 79 corregida ya usa
-- account_code).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'journal_lines'
      and column_name = 'account_id'
  ) then
    alter table public.journal_lines rename column account_id to account_code;
  end if;
end;
$$;

create index journal_lines_account_idx
  on public.journal_lines (org_id, account_code);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'org_account_mappings'
      and column_name = 'account_id'
  ) then
    alter table public.org_account_mappings rename column account_id to account_code;
  end if;
end;
$$;

-- El RPC usa la columna nueva desde la 79 corregida; en la remota la función
-- viva aún referencia account_id, así que se recrea el cuerpo con el nombre
-- correcto (misma lógica, solo el rename).
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
  if not exists (
    select 1 from public.organizations o
    where o.id = p_org_id
      and o.id in (select app.orgs_with('contabilidad:write'))
  ) then
    raise exception 'sin permiso para contabilizar' using errcode = 'insufficient_privilege';
  end if;

  if p_amount_cents = 0 then
    return null;
  end if;

  select
    coalesce((select m.account_code from public.org_account_mappings m
              where m.org_id = p_org_id and m.concepto = p_concepto), d.debit),
    coalesce((select m.account_code from public.org_account_mappings m
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

  insert into public.journal_lines (org_id, entry_id, account_code, description, debit_cents, credit_cents) values
    (p_org_id, v_entry, v_debit,  btrim(p_memo), v_amount, 0),
    (p_org_id, v_entry, v_credit, btrim(p_memo), 0,       v_amount);

  return v_entry;
end;
$$;

revoke all on function public.post_auto_entry(uuid, text, text, uuid, text, date, bigint) from public, anon;
grant execute on function public.post_auto_entry(uuid, text, text, uuid, text, date, bigint) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback: no aplica — es rename + recreación de función.
-- ═══════════════════════════════════════════════════════════════════════════
