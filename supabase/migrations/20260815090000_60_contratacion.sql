-- ═══════════════════════════════════════════════════════════════════════════
-- 60 — Contratación: procesos, pliegos y oferentes
--
-- El corazón de un contratista del Estado no es el contrato (eso es
-- `contratos`): es ganarlo. Un proceso es la selección en curso; el pliego
-- es lo que pide (cada requisito, con su obligatoriedad); el oferente es
-- quién compite y cómo viene en cada paso.
--
-- `numero` es texto libre (LP-001-2026…): la nomenclatura la define la
-- entidad contratante, no el sistema. `objeto` es la descripción legal de
-- qué se contrata.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.contratacion_procesos (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  numero       text not null check (length(btrim(numero)) between 2 and 40),
  objeto       text not null check (length(btrim(objeto)) between 2 and 300),
  modalidad    text not null default 'licitacion'
               check (modalidad in ('licitacion', 'seleccion_abreviada', 'minima_cuantia', 'contratacion_directa')),
  estado       text not null default 'borrador'
               check (estado in ('borrador', 'publicado', 'en_evaluacion', 'adjudicado', 'cancelado')),
  valor        numeric(14,2) not null default 0 check (valor >= 0),
  publicado_on date,
  cierre_on    date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index contratacion_procesos_org_estado_idx on public.contratacion_procesos (org_id, estado);

create trigger contratacion_procesos_touch before update on public.contratacion_procesos
  for each row execute function app.touch_updated_at();

comment on table public.contratacion_procesos is
  'Procesos de selección con estado y valores. El módulo contratacion.';

create table public.contratacion_pliegos (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  proceso_id  uuid not null references public.contratacion_procesos (id) on delete cascade,
  name        text not null check (length(btrim(name)) between 2 and 160),
  description text not null check (length(btrim(description)) between 2 and 500),
  obligatorio boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index contratacion_pliegos_proceso_idx on public.contratacion_pliegos (proceso_id);
create index contratacion_pliegos_org_idx on public.contratacion_pliegos (org_id);

create trigger contratacion_pliegos_touch before update on public.contratacion_pliegos
  for each row execute function app.touch_updated_at();

comment on table public.contratacion_pliegos is
  'Requisitos del pliego: qué pide el proceso y si es obligatorio.';

create table public.contratacion_oferentes (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  proceso_id  uuid not null references public.contratacion_procesos (id) on delete cascade,
  name        text not null check (length(btrim(name)) between 2 and 160),
  contacto    text,
  estado      text not null default 'invitado'
              check (estado in ('invitado', 'presentado', 'habilitado', 'adjudicado', 'rechazado')),
  valor_oferta numeric(14,2) not null default 0 check (valor_oferta >= 0),
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index contratacion_oferentes_proceso_idx on public.contratacion_oferentes (proceso_id);
create index contratacion_oferentes_org_idx on public.contratacion_oferentes (org_id);

create trigger contratacion_oferentes_touch before update on public.contratacion_oferentes
  for each row execute function app.touch_updated_at();

comment on table public.contratacion_oferentes is
  'Oferentes: quién compite en cada proceso y su estado.';

select app.apply_standard_rls('contratacion_procesos', 'contratacion:read', 'contratacion:write');
select app.apply_standard_rls('contratacion_pliegos', 'contratacion:read', 'contratacion:write');
select app.apply_standard_rls('contratacion_oferentes', 'contratacion:read', 'contratacion:write');

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
      'obra', 'ph', 'contratacion'
    )
  );
$$;

revoke all on function app.valid_module_keys(text[]) from public, anon;
grant execute on function app.valid_module_keys(text[]) to authenticated;

-- Catálogo de permisos. Derivado de REGISTRY; permissions.test.ts lo fija.
insert into public.permissions (key, module, action, label) values
  ('contratacion:read',  'contratacion', 'read',  'Ver procesos de contratación'),
  ('contratacion:write', 'contratacion', 'write', 'Gestionar procesos de contratación')
on conflict (key) do update set label = excluded.label;

-- Dependencias blandas.
insert into public.module_dependencies (module_key, requires_key, kind) values
  ('contratacion', 'documentos', 'soft'),
  ('contratacion', 'firmas',    'soft')
on conflict (module_key, requires_key) do nothing;

-- ─── Quien administra gana los permisos nuevos ─────────────────────────────

insert into public.role_permissions (org_id, role, permission)
select rp.org_id, rp.role, p.key
from public.role_permissions rp
cross join (values ('contratacion:read'), ('contratacion:write')) as p(key)
where rp.permission = 'configuracion:manage'
on conflict do nothing;

-- ─── El sector que contrata con el Estado ───────────────────────────────────

insert into public.sector_modules (sector_key, module_key, mode)
  select 'gobierno', k, 'add' from unnest(array['contratacion']) as k
on conflict (sector_key, module_key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   delete from public.sector_modules where module_key = 'contratacion';
--   delete from public.module_dependencies where module_key = 'contratacion';
--   delete from public.role_permissions where permission like 'contratacion:%';
--   delete from public.permissions where module = 'contratacion';
--   drop table if exists public.contratacion_oferentes;
--   drop table if exists public.contratacion_pliegos;
--   drop table if exists public.contratacion_procesos;
--   -- y volver a crear app.valid_module_keys() sin 'contratacion'
-- ═══════════════════════════════════════════════════════════════════════════
