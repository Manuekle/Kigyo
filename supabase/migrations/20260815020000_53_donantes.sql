-- ═══════════════════════════════════════════════════════════════════════════
-- 53 — Donantes: donantes, donaciones y rendición de cuentas
--
-- La mitad del trabajo de una ONG es conseguir y agradecer. Un donante es una
-- fila; una donación, otra. Los totales por periodo se derivan, no se guardan.
--
-- `donor_id` es `on delete set null`: borrar un donante no borra la historia
-- de lo que dio, y la fila de donación queda con el nombre que tenía.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.donors (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 2 and 120),
  email      text,
  phone      text,
  kind       text not null default 'persona' check (kind in ('persona', 'empresa')),
  status     text not null default 'activo' check (status in ('activo', 'inactivo')),
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index donors_org_status_idx on public.donors (org_id, status);

create trigger donors_touch before update on public.donors
  for each row execute function app.touch_updated_at();

comment on table public.donors is
  'Donantes: personas o empresas que aportan. El módulo donantes.';

create table public.donations (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  donor_id     uuid references public.donors (id) on delete set null,
  donor_name   text,
  kind         text not null default 'monetaria' check (kind in ('monetaria', 'especie', 'tiempo')),
  amount_cents int check (amount_cents is null or amount_cents >= 0),
  description  text,
  donated_on   date not null default current_date,
  campaign     text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index donations_org_date_idx on public.donations (org_id, donated_on desc);

create trigger donations_touch before update on public.donations
  for each row execute function app.touch_updated_at();

comment on table public.donations is
  'Donaciones: monetarias, en especie o en tiempo.';

select app.apply_standard_rls('donors', 'donantes:read', 'donantes:write');
select app.apply_standard_rls('donations', 'donantes:read', 'donantes:write');

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
      'donantes'
    )
  );
$$;

revoke all on function app.valid_module_keys(text[]) from public, anon;
grant execute on function app.valid_module_keys(text[]) to authenticated;

-- Catálogo de permisos. Derivado de REGISTRY; permissions.test.ts lo fija.
insert into public.permissions (key, module, action, label) values
  ('donantes:read',  'donantes', 'read',  'Ver donantes'),
  ('donantes:write', 'donantes', 'write', 'Gestionar donantes')
on conflict (key) do update set label = excluded.label;

-- ─── Quien administra gana los permisos nuevos ─────────────────────────────

insert into public.role_permissions (org_id, role, permission)
select rp.org_id, rp.role, p.key
from public.role_permissions rp
cross join (values ('donantes:read'), ('donantes:write')) as p(key)
where rp.permission = 'configuracion:manage'
on conflict do nothing;

-- ─── El sector que vive de donaciones ───────────────────────────────────────

insert into public.sector_modules (sector_key, module_key, mode)
  select 'ong', k, 'add' from unnest(array['donantes']) as k
on conflict (sector_key, module_key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   delete from public.sector_modules where module_key = 'donantes';
--   delete from public.role_permissions where permission like 'donantes:%';
--   delete from public.permissions where module = 'donantes';
--   drop table if exists public.donations;
--   drop table if exists public.donors;
--   -- y volver a crear app.valid_module_keys() sin 'donantes'
-- ═══════════════════════════════════════════════════════════════════════════
