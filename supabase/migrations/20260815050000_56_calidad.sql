-- ═══════════════════════════════════════════════════════════════════════════
-- 56 — Calidad: controles, lotes y no conformidades
--
-- Un control es una inspección con resultado; una no conformidad es lo que
-- salió mal y qué se hizo al respecto. El lote es texto libre (el número lo
-- define la operación, no el sistema).
--
-- `product_id` opcional con `on delete set null`: un control histórico no
-- desaparece cuando el producto deja de existir.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.quality_checks (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  product_id  uuid references public.products (id) on delete set null,
  batch       text,
  checked_on  date not null default current_date,
  result      text not null default 'aprobado' check (result in ('aprobado', 'rechazado', 'condicional')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index quality_checks_org_date_idx on public.quality_checks (org_id, checked_on desc);

create trigger quality_checks_touch before update on public.quality_checks
  for each row execute function app.touch_updated_at();

comment on table public.quality_checks is
  'Inspecciones de calidad con resultado. El módulo calidad.';

create table public.nonconformities (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  product_id   uuid references public.products (id) on delete set null,
  batch        text,
  description  text not null check (length(btrim(description)) between 2 and 500),
  severity     text not null default 'media' check (severity in ('baja', 'media', 'alta')),
  status       text not null default 'abierta' check (status in ('abierta', 'en_proceso', 'cerrada')),
  action_taken text,
  opened_on    date not null default current_date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index nonconformities_org_status_idx on public.nonconformities (org_id, status);

create trigger nonconformities_touch before update on public.nonconformities
  for each row execute function app.touch_updated_at();

comment on table public.nonconformities is
  'No conformidades: qué falló, qué tan grave y qué se hizo.';

select app.apply_standard_rls('quality_checks', 'calidad:read', 'calidad:write');
select app.apply_standard_rls('nonconformities', 'calidad:read', 'calidad:write');

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
      'cartera', 'notificaciones', 'reportes', 'creditos',
      'donantes', 'suscriptores', 'puestos', 'calidad'
    )
  );
$$;

revoke all on function app.valid_module_keys(text[]) from public, anon;
grant execute on function app.valid_module_keys(text[]) to authenticated;

-- Catálogo de permisos. Derivado de REGISTRY; permissions.test.ts lo fija.
insert into public.permissions (key, module, action, label) values
  ('calidad:read',  'calidad', 'read',  'Ver controles de calidad'),
  ('calidad:write', 'calidad', 'write', 'Gestionar controles de calidad')
on conflict (key) do update set label = excluded.label;

-- Dependencias blandas.
insert into public.module_dependencies (module_key, requires_key, kind) values
  ('calidad', 'catalogos', 'soft')
on conflict (module_key, requires_key) do nothing;

-- ─── Quien administra gana los permisos nuevos ─────────────────────────────

insert into public.role_permissions (org_id, role, permission)
select rp.org_id, rp.role, p.key
from public.role_permissions rp
cross join (values ('calidad:read'), ('calidad:write')) as p(key)
where rp.permission = 'configuracion:manage'
on conflict do nothing;

-- ─── Los sectores que inspeccionan lo que producen ──────────────────────────

insert into public.sector_modules (sector_key, module_key, mode)
  select 'manufactura', k, 'add' from unnest(array['calidad']) as k
  union all
  select 'alimentos', k, 'add' from unnest(array['calidad']) as k
  union all
  select 'agro', k, 'add' from unnest(array['calidad']) as k
on conflict (sector_key, module_key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   delete from public.sector_modules where module_key = 'calidad';
--   delete from public.module_dependencies where module_key = 'calidad';
--   delete from public.role_permissions where permission like 'calidad:%';
--   delete from public.permissions where module = 'calidad';
--   drop table if exists public.nonconformities;
--   drop table if exists public.quality_checks;
--   -- y volver a crear app.valid_module_keys() sin 'calidad'
-- ═══════════════════════════════════════════════════════════════════════════
