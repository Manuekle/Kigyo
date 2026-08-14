-- ═══════════════════════════════════════════════════════════════════════════
-- 54 — Suscriptores: planes de servicio y abonados
--
-- Lo que un ISP, una televisión por cable o un servicio de alarmas administra:
-- un plan es la oferta (nombre, precio, velocidad o descripción); un
-- suscriptor es un cliente dentro de un plan con su estado de servicio.
--
-- Deliberadamente distinto de `suscripciones` (cobro recurrente): allí la
-- pregunta es «¿cuánto y cada cuánto cobra?»; aquí es «¿está activo el
-- servicio y desde cuándo?». Un ISP usa ambos: este módulo para la red,
-- aquel para el cobro.
--
-- `client_id` opcional con `on delete set null`: el servicio puede existir sin
-- ficha comercial formal.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.service_plans (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  name         text not null check (length(btrim(name)) between 2 and 80),
  price_cents  int  not null check (price_cents >= 0),
  description  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger service_plans_touch before update on public.service_plans
  for each row execute function app.touch_updated_at();

comment on table public.service_plans is
  'Oferta de servicio: nombre, precio y descripción. El módulo suscriptores.';

create table public.subscribers (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  plan_id      uuid references public.service_plans (id) on delete set null,
  client_id    uuid references public.clients (id) on delete set null,
  name         text not null check (length(btrim(name)) between 2 and 120),
  address      text,
  phone        text,
  status       text not null default 'activo'
               check (status in ('activo', 'suspendido', 'cancelado')),
  activated_on date not null default current_date,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index subscribers_org_status_idx on public.subscribers (org_id, status);

create trigger subscribers_touch before update on public.subscribers
  for each row execute function app.touch_updated_at();

comment on table public.subscribers is
  'Un abonado dentro de un plan de servicio, con su estado.';

select app.apply_standard_rls('service_plans', 'suscriptores:read', 'suscriptores:write');
select app.apply_standard_rls('subscribers', 'suscriptores:read', 'suscriptores:write');

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
      'donantes', 'suscriptores'
    )
  );
$$;

revoke all on function app.valid_module_keys(text[]) from public, anon;
grant execute on function app.valid_module_keys(text[]) to authenticated;

-- Catálogo de permisos. Derivado de REGISTRY; permissions.test.ts lo fija.
insert into public.permissions (key, module, action, label) values
  ('suscriptores:read',  'suscriptores', 'read',  'Ver suscriptores'),
  ('suscriptores:write', 'suscriptores', 'write', 'Gestionar suscriptores')
on conflict (key) do update set label = excluded.label;

-- ─── Quien administra gana los permisos nuevos ─────────────────────────────

insert into public.role_permissions (org_id, role, permission)
select rp.org_id, rp.role, p.key
from public.role_permissions rp
cross join (values ('suscriptores:read'), ('suscriptores:write')) as p(key)
where rp.permission = 'configuracion:manage'
on conflict do nothing;

-- ─── El sector de redes ─────────────────────────────────────────────────────

insert into public.sector_modules (sector_key, module_key, mode)
  select 'telecomunicaciones', k, 'add' from unnest(array['suscriptores']) as k
on conflict (sector_key, module_key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   delete from public.sector_modules where module_key = 'suscriptores';
--   delete from public.role_permissions where permission like 'suscriptores:%';
--   delete from public.permissions where module = 'suscriptores';
--   drop table if exists public.subscribers;
--   drop table if exists public.service_plans;
--   -- y volver a crear app.valid_module_keys() sin 'suscriptores'
-- ═══════════════════════════════════════════════════════════════════════════
