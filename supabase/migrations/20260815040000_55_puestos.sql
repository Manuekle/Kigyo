-- ═══════════════════════════════════════════════════════════════════════════
-- 55 — Puestos de servicio: puestos, turnos y cobertura
--
-- El corazón de una empresa de vigilancia no es la ausencia del empleado
-- (eso es `asistencia`): es la cobertura del puesto. Un puesto es el lugar
-- que no puede quedar sin nadie; un turno es quién lo cubre y cuándo.
--
-- `employee_id` opcional con `on delete set null`: un turno puede quedar
-- por asignar — ese es justamente el dato que la pantalla hace visible.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.guard_posts (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 2 and 120),
  client_id  uuid references public.clients (id) on delete set null,
  address    text,
  notes      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index guard_posts_org_active_idx on public.guard_posts (org_id, is_active);

create trigger guard_posts_touch before update on public.guard_posts
  for each row execute function app.touch_updated_at();

comment on table public.guard_posts is
  'Puestos de vigilancia. El módulo puestos.';

create table public.post_shifts (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  post_id      uuid not null references public.guard_posts (id) on delete cascade,
  employee_id  uuid references public.employees (id) on delete set null,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  status       text not null default 'programado'
               check (status in ('programado', 'en_curso', 'completado', 'cancelado')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index post_shifts_org_starts_idx on public.post_shifts (org_id, starts_at desc);
create index post_shifts_post_idx on public.post_shifts (post_id, starts_at desc);

create trigger post_shifts_touch before update on public.post_shifts
  for each row execute function app.touch_updated_at();

comment on table public.post_shifts is
  'Turnos: quién cubre qué puesto y cuándo.';

select app.apply_standard_rls('guard_posts', 'puestos:read', 'puestos:write');
select app.apply_standard_rls('post_shifts', 'puestos:read', 'puestos:write');

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
      'donantes', 'suscriptores', 'puestos'
    )
  );
$$;

revoke all on function app.valid_module_keys(text[]) from public, anon;
grant execute on function app.valid_module_keys(text[]) to authenticated;

-- Catálogo de permisos. Derivado de REGISTRY; permissions.test.ts lo fija.
insert into public.permissions (key, module, action, label) values
  ('puestos:read',  'puestos', 'read',  'Ver puestos de servicio'),
  ('puestos:write', 'puestos', 'write', 'Gestionar puestos de servicio')
on conflict (key) do update set label = excluded.label;

-- Dependencias blandas.
insert into public.module_dependencies (module_key, requires_key, kind) values
  ('puestos', 'empleados', 'soft'),
  ('puestos', 'clientes',  'soft')
on conflict (module_key, requires_key) do nothing;

-- ─── Quien administra gana los permisos nuevos ─────────────────────────────

insert into public.role_permissions (org_id, role, permission)
select rp.org_id, rp.role, p.key
from public.role_permissions rp
cross join (values ('puestos:read'), ('puestos:write')) as p(key)
where rp.permission = 'configuracion:manage'
on conflict do nothing;

-- ─── El sector que vigila ───────────────────────────────────────────────────

insert into public.sector_modules (sector_key, module_key, mode)
  select 'seguridad', k, 'add' from unnest(array['puestos']) as k
on conflict (sector_key, module_key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   delete from public.sector_modules where module_key = 'puestos';
--   delete from public.module_dependencies where module_key = 'puestos';
--   delete from public.role_permissions where permission like 'puestos:%';
--   delete from public.permissions where module = 'puestos';
--   drop table if exists public.post_shifts;
--   drop table if exists public.guard_posts;
--   -- y volver a crear app.valid_module_keys() sin 'puestos'
-- ═══════════════════════════════════════════════════════════════════════════
