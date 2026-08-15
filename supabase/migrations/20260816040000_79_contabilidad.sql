-- ═══════════════════════════════════════════════════════════════════════════
-- 79 — Contabilidad: partida doble sobre PUC (plan CRM/ERP/POS 2.1)
--
-- Principio: partida doble sobre el plan de cuentas colombiano, sin inventar
-- el catálogo. `gl_accounts` es data global (el PUC es el mismo para todos);
-- lo que es de cada empresa son los asientos que lo usan.
--
-- Las reglas duras viven en la base, no en la pantalla:
--   · un asiento publicado es inmutable (ni filas, ni líneas, ni borrado);
--   · las líneas de un asiento publicado no se tocan;
--   · cada línea es débito o crédito, nunca ambos ni ninguno;
--   · publicar exige que la suma de débitos iguale la de créditos.
--
-- Los asientos automáticos (venta a crédito, cobro, pago a proveedor, cierre
-- de caja) entran por `app.post_auto_entry` con mapeo por concepto consultado
-- en `org_account_mappings` y caída a códigos fijos — el contador los ajusta
-- por empresa sin deploy. Un auto-asiento se genera una sola vez por evento
-- (índice único parcial sobre source/source_id).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Plan de cuentas (data global) ──────────────────────────────────────────

create table public.gl_accounts (
  code        text primary key check (code ~ '^[0-9]{1,8}$'),
  name        text not null check (length(btrim(name)) between 2 and 120),
  nature      text not null check (nature in ('Débito', 'Crédito')),
  kind        text not null check (kind in ('Activo', 'Pasivo', 'Patrimonio', 'Ingresos', 'Gastos', 'Costos')),
  parent_code text references public.gl_accounts (code) on delete cascade,
  is_active   boolean not null default true
);

comment on table public.gl_accounts is
  'Plan de cuentas PUC (Colombia), sembrado con el núcleo que usa una pyme. Data, no esquema.';

alter table public.gl_accounts enable row level security;
alter table public.gl_accounts force  row level security;

create policy gl_accounts_select on public.gl_accounts
  for select to authenticated using (true);

revoke insert, update, delete on public.gl_accounts from authenticated;

insert into public.gl_accounts (code, name, nature, kind, parent_code, is_active) values
  ('1',      'Activos',                      'Débito',  'Activo',     null, true),
  ('1105',   'Caja',                         'Débito',  'Activo',     '1',   true),
  ('1110',   'Bancos',                       'Débito',  'Activo',     '1',   true),
  ('1305',   'Clientes',                     'Débito',  'Activo',     '1',   true),
  ('1355',   'Anticipo de impuestos',        'Débito',  'Activo',     '1',   true),
  ('1435',   'Inventarios',                  'Débito',  'Activo',     '1',   true),
  ('1524',   'Equipo de oficina',            'Débito',  'Activo',     '1',   true),
  ('1528',   'Equipo de cómputo',            'Débito',  'Activo',     '1',   true),
  ('1540',   'Flota y equipo de transporte', 'Débito',  'Activo',     '1',   true),
  ('1592',   'Depreciación acumulada',       'Crédito', 'Activo',     '1',   true),
  ('1705',   'Gastos pagados por anticipado','Débito',  'Activo',     '1',   true),

  ('2',      'Pasivos',                      'Crédito', 'Pasivo',     null, true),
  ('2205',   'Proveedores',                  'Crédito', 'Pasivo',     '2',   true),
  ('2335',   'Costos y gastos por pagar',    'Crédito', 'Pasivo',     '2',   true),
  ('2365',   'Retención en la fuente',       'Crédito', 'Pasivo',     '2',   true),
  ('2368',   'Impuestos por pagar',          'Crédito', 'Pasivo',     '2',   true),
  ('2370',   'Retenciones y aportes de nómina','Crédito','Pasivo',    '2',   true),
  ('2408',   'IVA por pagar',                'Crédito', 'Pasivo',     '2',   true),
  ('2505',   'Obligaciones financieras',     'Crédito', 'Pasivo',     '2',   true),
  ('2610',   'Obligaciones laborales',       'Crédito', 'Pasivo',     '2',   true),

  ('3',      'Patrimonio',                   'Crédito', 'Patrimonio', null, true),
  ('3105',   'Capital suscrito',             'Crédito', 'Patrimonio', '3',   true),
  ('3605',   'Utilidad del ejercicio',       'Crédito', 'Patrimonio', '3',   true),
  ('3610',   'Utilidades acumuladas',        'Crédito', 'Patrimonio', '3',   true),

  ('4',      'Ingresos',                     'Crédito', 'Ingresos',   null, true),
  ('4135',   'Venta de mercancías',          'Crédito', 'Ingresos',   '4',   true),
  ('4175',   'Servicios',                    'Crédito', 'Ingresos',   '4',   true),
  ('4195',   'Devoluciones en ventas',       'Débito',  'Ingresos',   '4',   true),
  ('4230',   'Ingresos financieros',         'Crédito', 'Ingresos',   '4',   true),
  ('4295',   'Ingresos diversos',            'Crédito', 'Ingresos',   '4',   true),

  ('5',      'Gastos',                       'Débito',  'Gastos',     null, true),
  ('5105',   'Gastos de personal',           'Débito',  'Gastos',     '5',   true),
  ('5110',   'Honorarios',                   'Débito',  'Gastos',     '5',   true),
  ('5115',   'Servicios',                    'Débito',  'Gastos',     '5',   true),
  ('5120',   'Arrendamientos',               'Débito',  'Gastos',     '5',   true),
  ('5135',   'Seguros',                      'Débito',  'Gastos',     '5',   true),
  ('5140',   'Mantenimiento',                'Débito',  'Gastos',     '5',   true),
  ('5155',   'Transporte',                   'Débito',  'Gastos',     '5',   true),
  ('5160',   'Depreciación',                 'Débito',  'Gastos',     '5',   true),
  ('5195',   'Gastos diversos',              'Débito',  'Gastos',     '5',   true),
  ('5205',   'Gastos de personal (admin.)',  'Débito',  'Gastos',     '5',   true),
  ('5305',   'Gastos financieros',           'Débito',  'Gastos',     '5',   true),
  ('5315',   'Impuestos',                    'Débito',  'Gastos',     '5',   true),

  ('6',      'Costos',                       'Débito',  'Costos',     null, true),
  ('6105',   'Materia prima',                'Débito',  'Costos',     '6',   true),
  ('6135',   'Costo de mercancía vendida',   'Débito',  'Costos',     '6',   true),
  ('6145',   'Costo de servicios',           'Débito',  'Costos',     '6',   true),
  ('6155',   'Costos de personal',           'Débito',  'Costos',     '6',   true);

-- ─── Asientos ───────────────────────────────────────────────────────────────

create table public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  entry_date date not null default current_date,
  memo       text not null check (length(btrim(memo)) between 1 and 400),
  source     text not null default 'Manual'
               check (source in ('Manual', 'Venta', 'Cobro', 'Compra', 'Pago', 'Caja')),
  source_id  uuid,
  status     text not null default 'Borrador' check (status in ('Borrador', 'Publicado')),
  posted_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index journal_entries_auto_once
  on public.journal_entries (org_id, source, source_id)
  where source <> 'Manual' and deleted_at is null;

create index journal_entries_org_idx
  on public.journal_entries (org_id, entry_date desc) where deleted_at is null;

create trigger journal_entries_touch before update on public.journal_entries
  for each row execute function app.touch_updated_at();

comment on table public.journal_entries is
  'Asientos de partida doble. Publicado = inmutable. source/source_id atan el asiento al hecho que lo generó.';

create table public.journal_lines (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  entry_id    uuid not null references public.journal_entries (id) on delete cascade,
  account_id  text not null references public.gl_accounts (code),
  description text not null default '',
  debit_cents  bigint not null default 0 check (debit_cents >= 0),
  credit_cents bigint not null default 0 check (credit_cents >= 0),
  check ((debit_cents > 0) <> (credit_cents > 0))
);

create index journal_lines_entry_idx on public.journal_lines (entry_id);
create index journal_lines_account_idx on public.journal_lines (org_id, account_id);

comment on table public.journal_lines is
  'Líneas de un asiento. Una línea es débito o crédito, nunca ambos.';

select app.apply_standard_rls('journal_entries', 'contabilidad:read', 'contabilidad:write');
select app.apply_standard_rls('journal_lines', 'contabilidad:read', 'contabilidad:write');

/**
 * Reglas duras de la partida doble.
 */

-- Un asiento publicado es inmutable: ni sus campos, ni sus líneas, ni su
-- borrado. Corregir un asiento publicado se hace con un asiento reverso.
create or replace function app.guard_journal_entry_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'Publicado' then
    raise exception 'un asiento publicado es inmutable; registra un asiento reverso'
      using errcode = 'check_violation';
  end if;
  -- BEFORE DELETE no tiene `new`: devolver NULL cancelaría el borrado en
  -- silencio, así que el borrado permitido devuelve `old`.
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger journal_entries_guard_immutable
  before update or delete on public.journal_entries
  for each row execute function app.guard_journal_entry_immutable();

create or replace function app.guard_journal_line()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.journal_entries
  where id = coalesce(new.entry_id, old.entry_id);

  if v_status = 'Publicado' then
    raise exception 'las líneas de un asiento publicado no se tocan'
      using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger journal_lines_guard
  before insert or update or delete on public.journal_lines
  for each row execute function app.guard_journal_line();

-- Publicar exige que el asiento cuadre.
create or replace function app.guard_journal_entry_balanced()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'Publicado' and old.status = 'Borrador' then
    if (select coalesce(sum(debit_cents), 0) - coalesce(sum(credit_cents), 0)
        from public.journal_lines where entry_id = new.id) <> 0 then
      raise exception 'el asiento no cuadra: débitos y créditos deben sumar igual'
        using errcode = 'check_violation';
    end if;
    new.posted_at := now();
  end if;
  return new;
end;
$$;

create trigger journal_entries_guard_balanced
  before update of status on public.journal_entries
  for each row execute function app.guard_journal_entry_balanced();

-- ─── Mapeo de cuentas por concepto, por empresa ─────────────────────────────

create table public.org_account_mappings (
  org_id     uuid not null references public.organizations (id) on delete cascade,
  concepto   text not null check (concepto in
               ('venta_credito', 'cobro', 'compra', 'pago_proveedor', 'caja_diferencia')),
  account_id text not null references public.gl_accounts (code),
  auto       boolean not null default true,
  primary key (org_id, concepto)
);

comment on table public.org_account_mappings is
  'Qué cuenta usa cada concepto al generar asientos automáticos. El contador la ajusta sin deploy.';

alter table public.org_account_mappings enable row level security;
alter table public.org_account_mappings force  row level security;

create policy org_account_mappings_select on public.org_account_mappings
  for select to authenticated using (org_id in (select app.orgs_with('contabilidad:read')));

create policy org_account_mappings_write on public.org_account_mappings
  for insert to authenticated with check (org_id in (select app.orgs_with('contabilidad:write')));

create policy org_account_mappings_update on public.org_account_mappings
  for update to authenticated using (org_id in (select app.orgs_with('contabilidad:write')));

-- ─── Asientos automáticos ───────────────────────────────────────────────────

create or replace function app.post_auto_entry(
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

revoke all on function app.post_auto_entry(uuid, text, text, uuid, text, date, bigint) from public, anon, authenticated;

-- ─── El catálogo reconoce el módulo nuevo ───────────────────────────────────

-- Los módulos que enabled_modules acepta. Espejo de SWITCHABLE en
-- src/lib/modules/registry.ts; registry.test.ts lo fija en ambos sentidos.
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
      'contratacion', 'marketing', 'integraciones', 'portal'
    )
  );
$$;

revoke all on function app.valid_module_keys(text[]) from public, anon;
grant execute on function app.valid_module_keys(text[]) to authenticated;

-- Catálogo de permisos. Derivado de REGISTRY; permissions.test.ts lo fija.
insert into public.permissions (key, module, action, label) values
  ('contabilidad:read',  'contabilidad', 'read',  'Ver contabilidad'),
  ('contabilidad:write', 'contabilidad', 'write', 'Registrar asientos')
on conflict (key) do update set label = excluded.label;

-- Dependencias blandas: el módulo funciona solo, pero registra menos.
insert into public.module_dependencies (module_key, requires_key, kind) values
  ('contabilidad', 'facturacion', 'soft'),
  ('contabilidad', 'compras', 'soft'),
  ('contabilidad', 'nomina', 'soft')
on conflict (module_key, requires_key) do update set kind = excluded.kind;

-- ─── Quien administra gana los permisos nuevos ─────────────────────────────

insert into public.role_permissions (org_id, role, permission)
select rp.org_id, rp.role, p.key
from public.role_permissions rp
cross join (values ('contabilidad:read'), ('contabilidad:write')) as p(key)
where rp.permission = 'configuracion:manage'
on conflict do nothing;

-- Ningún sector lo propone: la contabilidad la pide un contador, no el sector.

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   delete from public.role_permissions where permission like 'contabilidad:%';
--   delete from public.permissions where module = 'contabilidad';
--   delete from public.module_dependencies where module_key = 'contabilidad';
--   drop function if exists app.post_auto_entry(uuid, text, text, uuid, text, date, bigint);
--   drop table if exists public.org_account_mappings;
--   drop trigger if exists journal_entries_guard_balanced on public.journal_entries;
--   drop function if exists app.guard_journal_entry_balanced();
--   drop trigger if exists journal_lines_guard on public.journal_lines;
--   drop function if exists app.guard_journal_line();
--   drop trigger if exists journal_entries_guard_immutable on public.journal_entries;
--   drop function if exists app.guard_journal_entry_immutable();
--   drop table if exists public.journal_lines;
--   drop table if exists public.journal_entries;
--   drop table if exists public.gl_accounts;
--   -- y volver a crear app.valid_module_keys() sin 'contabilidad'
-- ═══════════════════════════════════════════════════════════════════════════
