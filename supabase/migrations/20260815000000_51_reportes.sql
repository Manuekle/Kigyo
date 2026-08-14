-- ═══════════════════════════════════════════════════════════════════════════
-- 51 — Reportes: reportes guardados por módulo y exportación
--
-- Un reporte guardado es una vista con nombre: qué módulo, qué periodo y una
-- nota de quién lo guardó. La exportación CSV sale de las tablas del módulo
-- con el filtro de periodo — la misma aritmética que la pantalla, en texto.
--
-- Deliberadamente simple: no hay motor de gráficos ni programador. El valor
-- hoy es «el gerente guarda lo que revisa cada semana y lo exporta»; el resto
-- llega cuando la demanda lo pida.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.saved_reports (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null check (length(btrim(name)) between 2 and 80),
  module_key  text not null,
  -- Periodo: 'hoy' | 'semana' | 'mes' | 'trimestre' | 'todo'
  period      text not null default 'mes' check (period in ('hoy', 'semana', 'mes', 'trimestre', 'todo')),
  notes       text,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index saved_reports_org_idx on public.saved_reports (org_id, created_at desc);

create trigger saved_reports_touch before update on public.saved_reports
  for each row execute function app.touch_updated_at();

comment on table public.saved_reports is
  'Reportes guardados por módulo y periodo. El módulo reportes.';

select app.apply_standard_rls('saved_reports', 'reportes:read', 'reportes:write');

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
      'cartera', 'notificaciones', 'reportes'
    )
  );
$$;

revoke all on function app.valid_module_keys(text[]) from public, anon;
grant execute on function app.valid_module_keys(text[]) to authenticated;

-- Catálogo de permisos. Derivado de REGISTRY; permissions.test.ts lo fija.
insert into public.permissions (key, module, action, label) values
  ('reportes:read',  'reportes', 'read',  'Ver reportes'),
  ('reportes:write', 'reportes', 'write', 'Gestionar reportes')
on conflict (key) do update set label = excluded.label;

-- ─── Quien administra gana los permisos nuevos ─────────────────────────────

insert into public.role_permissions (org_id, role, permission)
select rp.org_id, rp.role, p.key
from public.role_permissions rp
cross join (values ('reportes:read'), ('reportes:write')) as p(key)
where rp.permission = 'configuracion:manage'
on conflict do nothing;

-- ─── Todos los sectores revisan sus números ─────────────────────────────────

insert into public.sector_modules (sector_key, module_key, mode)
  select 'construccion', k, 'add' from unnest(array['reportes']) as k
  union all
  select 'energia', k, 'add' from unnest(array['reportes']) as k
  union all
  select 'manufactura', k, 'add' from unnest(array['reportes']) as k
  union all
  select 'comercio', k, 'add' from unnest(array['reportes']) as k
  union all
  select 'ecommerce', k, 'add' from unnest(array['reportes']) as k
  union all
  select 'servicios', k, 'add' from unnest(array['reportes']) as k
  union all
  select 'tecnologia', k, 'add' from unnest(array['reportes']) as k
  union all
  select 'salud', k, 'add' from unnest(array['reportes']) as k
  union all
  select 'educacion', k, 'add' from unnest(array['reportes']) as k
  union all
  select 'logistica', k, 'add' from unnest(array['reportes']) as k
  union all
  select 'alimentos', k, 'add' from unnest(array['reportes']) as k
  union all
  select 'agro', k, 'add' from unnest(array['reportes']) as k
  union all
  select 'inmobiliario', k, 'add' from unnest(array['reportes']) as k
  union all
  select 'hoteleria', k, 'add' from unnest(array['reportes']) as k
  union all
  select 'financiero', k, 'add' from unnest(array['reportes']) as k
  union all
  select 'mineria', k, 'add' from unnest(array['reportes']) as k
  union all
  select 'telecomunicaciones', k, 'add' from unnest(array['reportes']) as k
  union all
  select 'seguridad', k, 'add' from unnest(array['reportes']) as k
  union all
  select 'medios', k, 'add' from unnest(array['reportes']) as k
  union all
  select 'ong', k, 'add' from unnest(array['reportes']) as k
  union all
  select 'gobierno', k, 'add' from unnest(array['reportes']) as k
  union all
  select 'otro', k, 'add' from unnest(array['reportes']) as k
  union all
  select 'fitness-bienestar', k, 'add' from unnest(array['reportes']) as k
on conflict (sector_key, module_key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   delete from public.sector_modules where module_key = 'reportes';
--   delete from public.role_permissions where permission like 'reportes:%';
--   delete from public.permissions where module = 'reportes';
--   drop table if exists public.saved_reports;
--   -- y volver a crear app.valid_module_keys() sin 'reportes'
-- ═══════════════════════════════════════════════════════════════════════════
