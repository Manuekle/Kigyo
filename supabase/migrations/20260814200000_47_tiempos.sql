-- ═══════════════════════════════════════════════════════════════════════════
-- 47 — Tiempos: horas facturables por persona, proyecto y tarifa
--
-- El hueco que desbloquea servicios, tecnología y medios de una vez: esos
-- presets dicen «se factura tiempo» y no había dónde registrarlo. Una hora
-- es una fila: quién la trabajó, en qué proyecto, cuándo, cuánto duró, a qué
-- tarifa y una nota.
--
-- ─── Qué NO es ─────────────────────────────────────────────────────────────
--
-- No es asistencia ni nómina. Asistencia responde «¿estuvo?»; tiempos
-- responde «¿en qué gastó la hora y a cuánto la cobramos?». No hay cálculo
-- de salarios: la facturación se hace desde facturacion, con los datos de
-- aquí como insumo.
--
-- `employee_id` y `project_id` son opcionales y `on delete set null`: borrar
-- un proyecto no debe borrar las horas que alguien le facturó a un cliente.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.time_entries (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid references public.employees (id) on delete set null,
  project_id  uuid references public.projects (id) on delete set null,
  work_date   date not null default current_date,
  minutes     int  not null check (minutes between 1 and 1440),
  rate_cents  int  check (rate_cents is null or rate_cents >= 0),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index time_entries_org_date_idx on public.time_entries (org_id, work_date desc);

create trigger time_entries_touch before update on public.time_entries
  for each row execute function app.touch_updated_at();

comment on table public.time_entries is
  'Horas facturables por persona, proyecto y tarifa. El módulo tiempos.';

comment on column public.time_entries.minutes is
  'Duración en minutos. Minutos, no horas: la hora la divide la persona, el sistema no.';

select app.apply_standard_rls('time_entries', 'tiempos:read', 'tiempos:write');

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
      'hoteleria', 'socios', 'tiempos'
    )
  );
$$;

revoke all on function app.valid_module_keys(text[]) from public, anon;
grant execute on function app.valid_module_keys(text[]) to authenticated;

-- Catálogo de permisos. Derivado de REGISTRY; permissions.test.ts lo fija.
insert into public.permissions (key, module, action, label) values
  ('tiempos:read',  'tiempos', 'read',  'Ver horas registradas'),
  ('tiempos:write', 'tiempos', 'write', 'Gestionar horas registradas')
on conflict (key) do update set label = excluded.label;

-- Dependencias blandas: las horas se cargan contra una persona del directorio
-- y, cuando hay obra, contra un proyecto. Ninguna bloquea el módulo.
insert into public.module_dependencies (module_key, requires_key, kind) values
  ('tiempos', 'empleados',  'soft'),
  ('tiempos', 'proyectos',  'soft')
on conflict (module_key, requires_key) do nothing;

-- ─── Los tres sectores que viven de facturar tiempo ─────────────────────────

insert into public.sector_modules (sector_key, module_key, mode)
  select 'servicios', k, 'add' from unnest(array['tiempos']) as k
  union all
  select 'tecnologia', k, 'add' from unnest(array['tiempos']) as k
  union all
  select 'medios', k, 'add' from unnest(array['tiempos']) as k
on conflict (sector_key, module_key) do nothing;

-- ─── Quien administra gana los permisos nuevos ─────────────────────────────
-- Los roles que ya administran la configuración reciben tiempos:read y
-- tiempos:write, igual que las migraciones 42 y 43 hicieron con socios, caja
-- y pos. Sin esto, un Administrador existente vería el módulo en el preset y
-- no podría abrirlo.

insert into public.role_permissions (org_id, role, permission)
select rp.org_id, rp.role, p.key
from public.role_permissions rp
cross join (values ('tiempos:read'), ('tiempos:write')) as p(key)
where rp.permission = 'configuracion:manage'
on conflict do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   delete from public.sector_modules where module_key = 'tiempos';
--   delete from public.module_dependencies where module_key = 'tiempos';
--   delete from public.role_permissions where permission like 'tiempos:%';
--   delete from public.permissions where module = 'tiempos';
--   drop table if exists public.time_entries;
--   -- y volver a crear app.valid_module_keys() sin 'tiempos'
-- ═══════════════════════════════════════════════════════════════════════════
