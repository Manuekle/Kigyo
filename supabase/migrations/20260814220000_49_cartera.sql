-- ═══════════════════════════════════════════════════════════════════════════
-- 49 — Cartera: cuentas por cobrar, vencimientos y acuerdos de pago
--
-- Sobre `invoices` (facturacion) y `clients`: una fila es una deuda pendiente
-- — o un acuerdo para pagarla. La factura sigue siendo la fuente del cargo;
-- la cartera responde «¿cuánto deben, desde cuándo, y cómo acordaron pagar?».
--
-- `invoice_id` y `client_id` son opcionales con `on delete set null`: una
-- deuda puede existir sin factura (acuerdo verbal) y una factura borrada no
-- borra la historia del cobro.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.receivable_agreements (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  invoice_id   uuid references public.invoices (id) on delete set null,
  client_id    uuid references public.clients (id) on delete set null,
  amount_cents int  not null check (amount_cents > 0),
  due_date     date not null,
  status       text not null default 'pendiente'
               check (status in ('pendiente', 'pagada', 'vencida', 'mora')),
  paid_at      timestamptz,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index receivable_agreements_org_status_idx on public.receivable_agreements (org_id, status);
create index receivable_agreements_due_idx on public.receivable_agreements (org_id, due_date);

create trigger receivable_agreements_touch before update on public.receivable_agreements
  for each row execute function app.touch_updated_at();

comment on table public.receivable_agreements is
  'Cuentas por cobrar y acuerdos de pago sobre facturas y clientes. El módulo cartera.';

select app.apply_standard_rls('receivable_agreements', 'cartera:read', 'cartera:write');

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
      'facturacion', 'compras', 'catalogos', 'caja',
      'pos', 'tienda', 'ecommerce', 'canales',
      'tickets', 'firmas', 'documentos', 'contratos',
      'calendario', 'consultoria', 'ia', 'pacientes',
      'estudiantes', 'restaurante', 'agro', 'inmobiliario',
      'hoteleria', 'socios', 'tiempos', 'suscripciones',
      'cartera'
    )
  );
$$;

revoke all on function app.valid_module_keys(text[]) from public, anon;
grant execute on function app.valid_module_keys(text[]) to authenticated;

-- Catálogo de permisos. Derivado de REGISTRY; permissions.test.ts lo fija.
insert into public.permissions (key, module, action, label) values
  ('cartera:read',  'cartera', 'read',  'Ver cuentas por cobrar'),
  ('cartera:write', 'cartera', 'write', 'Gestionar cuentas por cobrar')
on conflict (key) do update set label = excluded.label;

-- Dependencias blandas.
insert into public.module_dependencies (module_key, requires_key, kind) values
  ('cartera', 'facturacion', 'soft'),
  ('cartera', 'clientes',    'soft')
on conflict (module_key, requires_key) do nothing;

-- ─── Quien administra gana los permisos nuevos ─────────────────────────────

insert into public.role_permissions (org_id, role, permission)
select rp.org_id, rp.role, p.key
from public.role_permissions rp
cross join (values ('cartera:read'), ('cartera:write')) as p(key)
where rp.permission = 'configuracion:manage'
on conflict do nothing;

-- ─── Los sectores que viven de cobrar después ───────────────────────────────

insert into public.sector_modules (sector_key, module_key, mode)
  select 'financiero', k, 'add' from unnest(array['cartera']) as k
  union all
  select 'salud', k, 'add' from unnest(array['cartera']) as k
  union all
  select 'educacion', k, 'add' from unnest(array['cartera']) as k
  union all
  select 'servicios', k, 'add' from unnest(array['cartera']) as k
on conflict (sector_key, module_key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   delete from public.sector_modules where module_key = 'cartera';
--   delete from public.module_dependencies where module_key = 'cartera';
--   delete from public.role_permissions where permission like 'cartera:%';
--   delete from public.permissions where module = 'cartera';
--   drop table if exists public.receivable_agreements;
--   -- y volver a crear app.valid_module_keys() sin 'cartera'
-- ═══════════════════════════════════════════════════════════════════════════
