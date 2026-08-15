-- ═══════════════════════════════════════════════════════════════════════════
-- 59 — PH: asambleas, cuotas y zonas comunes
--
-- El corazón de la administración de propiedad horizontal no es el inmueble
-- (eso es `inmobiliario`): es la vida del edificio. Una asamblea es la
-- decisión colectiva; una cuota es lo que cada unidad debe y si pagó; una
-- zona común es lo que todos comparten y hay que mantener.
--
-- `unidad` en las cuotas es texto libre (apto 301, local 2…): la matrícula
-- de unidades vive en `inmobiliario`, que es dependencia blanda.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.ph_asambleas (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  fecha       date not null default current_date,
  tema        text not null check (length(btrim(tema)) between 2 and 160),
  tipo        text not null default 'ordinaria'
              check (tipo in ('ordinaria', 'extraordinaria')),
  estado      text not null default 'convocada'
              check (estado in ('convocada', 'realizada', 'acta_firmada')),
  asistentes  int not null default 0 check (asistentes >= 0),
  decisiones  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index ph_asambleas_org_fecha_idx on public.ph_asambleas (org_id, fecha desc);

create trigger ph_asambleas_touch before update on public.ph_asambleas
  for each row execute function app.touch_updated_at();

comment on table public.ph_asambleas is
  'Asambleas del edificio con estado y decisiones. El módulo ph.';

create table public.ph_cuotas (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  unidad      text not null check (length(btrim(unidad)) between 2 and 40),
  periodo     text not null check (length(btrim(periodo)) between 2 and 20),
  tipo        text not null default 'ordinaria'
              check (tipo in ('ordinaria', 'extraordinaria')),
  monto       numeric(14,2) not null default 0 check (monto >= 0),
  estado      text not null default 'pendiente'
              check (estado in ('pendiente', 'pagada')),
  vence       date,
  pagada_on   date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index ph_cuotas_org_estado_idx on public.ph_cuotas (org_id, estado);

create trigger ph_cuotas_touch before update on public.ph_cuotas
  for each row execute function app.touch_updated_at();

comment on table public.ph_cuotas is
  'Cuotas por unidad y periodo: lo que cada una debe y si pagó.';

create table public.ph_zonas (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 2 and 120),
  tipo       text not null default 'otro'
             check (tipo in ('salon', 'piscina', 'gimnasio', 'parqueadero', 'otro')),
  estado     text not null default 'operativa'
             check (estado in ('operativa', 'mantenimiento', 'cerrada')),
  notas      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ph_zonas_org_idx on public.ph_zonas (org_id);

create trigger ph_zonas_touch before update on public.ph_zonas
  for each row execute function app.touch_updated_at();

comment on table public.ph_zonas is
  'Zonas comunes del edificio y su estado.';

select app.apply_standard_rls('ph_asambleas', 'ph:read', 'ph:write');
select app.apply_standard_rls('ph_cuotas', 'ph:read', 'ph:write');
select app.apply_standard_rls('ph_zonas', 'ph:read', 'ph:write');

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
      'donantes', 'suscriptores', 'puestos', 'calidad',
      'obra', 'ph'
    )
  );
$$;

revoke all on function app.valid_module_keys(text[]) from public, anon;
grant execute on function app.valid_module_keys(text[]) to authenticated;

-- Catálogo de permisos. Derivado de REGISTRY; permissions.test.ts lo fija.
insert into public.permissions (key, module, action, label) values
  ('ph:read',  'ph', 'read',  'Ver propiedad horizontal'),
  ('ph:write', 'ph', 'write', 'Gestionar propiedad horizontal')
on conflict (key) do update set label = excluded.label;

-- Dependencias blandas.
insert into public.module_dependencies (module_key, requires_key, kind) values
  ('ph', 'inmobiliario', 'soft')
on conflict (module_key, requires_key) do nothing;

-- ─── Quien administra gana los permisos nuevos ─────────────────────────────

insert into public.role_permissions (org_id, role, permission)
select rp.org_id, rp.role, p.key
from public.role_permissions rp
cross join (values ('ph:read'), ('ph:write')) as p(key)
where rp.permission = 'configuracion:manage'
on conflict do nothing;

-- ─── El subsector que administra edificios ──────────────────────────────────

-- Solo `inmobiliario-ph`: quien arrienda o corretaje no administra copropiedad.
insert into public.sector_modules (sector_key, module_key, mode)
  select 'inmobiliario-ph', k, 'add' from unnest(array['ph']) as k
on conflict (sector_key, module_key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   delete from public.sector_modules where module_key = 'ph';
--   delete from public.module_dependencies where module_key = 'ph';
--   delete from public.role_permissions where permission like 'ph:%';
--   delete from public.permissions where module = 'ph';
--   drop table if exists public.ph_zonas;
--   drop table if exists public.ph_cuotas;
--   drop table if exists public.ph_asambleas;
--   -- y volver a crear app.valid_module_keys() sin 'ph'
-- ═══════════════════════════════════════════════════════════════════════════
