-- ═══════════════════════════════════════════════════════════════════════════
-- 34 — Los presets viven en la base de datos, y un subsector por fin propone
--      algo
--
-- Migration 29 moved the sector *vocabulary* into `public.sectors` so that
-- adding an industry stopped being a deploy. It left half the promise unkept,
-- and the half it left is the one the customer sees.
--
-- ─── 1. A sector inserted as data proposed nothing ─────────────────────────
--
-- The module presets stayed in `COMPANY_TYPES` (src/lib/modules.ts). So a
-- product person could insert «Moda» into `public.sectors` without a deploy,
-- the picker would offer it — and `presetFor('moda')` would fall through to
-- its legacy branch and return *the entire catalogue*: thirty-five modules
-- switched on, which is the worst possible answer and exactly the bug
-- MANUAL_START was introduced to kill for the manual path.
--
-- The presets move here. TypeScript keeps its copy, because the signup page
-- previews a sector before there is a session to query with, and because a
-- preset is a product decision worth reviewing in a diff — but the pickers
-- read this table, and a test pins the two together in both directions.
--
-- ─── 2. Subsectors were a question with no consequence ─────────────────────
--
-- Fifty-one of them have existed since migration 29. The wizard asked, stored
-- the answer in `organizations.subsector`, and proposed the parent's modules
-- regardless: a dentist and a hospital got the same eighteen, a bakery and a
-- bar the same fourteen. Asking a question and ignoring the answer is worse
-- than not asking.
--
-- A subsector row is a *delta*, not a second preset:
--
--     preset(sector, sub) = (preset(sector) ∪ sub.add) − sub.remove
--
-- Add first, then remove, so `remove` is always the last word. One hop only —
-- migration 29 already refuses a third level for this exact reason: the
-- arithmetic stops being explainable once a grandchild has to decide whether
-- it amends its parent or its grandparent.
--
-- ─── What this does NOT change ─────────────────────────────────────────────
--
-- Nothing about access. A preset is a *proposal*: it seeds the toggles on the
-- setup wizard and on Configuración → Módulos, and the customer overrides it
-- freely. `requirePermission` does not consult a sector, no RLS policy does,
-- and none of the 66 operational tables learn anything new. A sector has never
-- been a cage and this does not make it one.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.sector_modules (
  sector_key text not null references public.sectors (key) on delete cascade,
  module_key text not null,
  -- 'add'    — the module belongs in this sector's proposal.
  -- 'remove' — this subsector's industry does not use what its parent proposes.
  --            Meaningless on a top-level sector, whose rows *are* the
  --            proposal: there is nothing above it to subtract from. The
  --            trigger below refuses it rather than storing a row that does
  --            nothing.
  mode       text not null default 'add' check (mode in ('add', 'remove')),
  primary key (sector_key, module_key),
  -- The same list `organizations.enabled_modules` is checked against, so a
  -- preset cannot propose a module the column would then refuse to store.
  constraint sector_modules_module_valid check (app.valid_module_keys(array[module_key]))
);

comment on table public.sector_modules is
  'Módulos que propone un sector. En un subsector las filas son un delta sobre el padre (add/remove). Solo sugieren: nunca restringen. Espejo de COMPANY_TYPES y SUBSECTOR_PRESETS en src/lib/modules.ts.';

alter table public.sector_modules enable row level security;
alter table public.sector_modules force  row level security;

-- Readable by anyone signed in, like `sectors` and `module_dependencies`: the
-- pickers need it and none of it is anybody's data.
create policy sector_modules_select on public.sector_modules
  for select to authenticated using (true);

revoke insert, update, delete on public.sector_modules from authenticated;

/**
 * `remove` belongs to subsectors only.
 *
 * A top-level sector's rows are its whole proposal — there is no parent to
 * subtract from, so a 'remove' row there would silently do nothing, which is
 * the kind of stored non-effect somebody eventually debugs for an afternoon.
 */
create or replace function app.guard_sector_module_mode()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.mode = 'remove' and not exists (
    select 1 from public.sectors s
    where s.key = new.sector_key and s.parent_key is not null
  ) then
    raise exception 'Solo un subsector puede quitar módulos (%).', new.sector_key
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger sector_modules_guard_mode
  before insert or update on public.sector_modules
  for each row execute function app.guard_sector_module_mode();

-- ─── Los presets de cada sector ─────────────────────────────────────────────
--
-- Generated from COMPANY_TYPES rather than typed by hand, and pinned by
-- src/lib/modules/registry.test.ts in both directions: a module here and not
-- there, or there and not here, fails the suite.
--
-- Presets lean *under*, not over. A proposal that leaves thirty of thirty-five
-- modules on has not made a decision — it has restated "everything" with extra
-- steps, and the administrator still has to switch two dozen things off.

insert into public.sector_modules (sector_key, module_key, mode)
  select 'construccion', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'riesgos', 'proyectos', 'hseq', 'inventario', 'mantenimiento', 'clientes', 'cotizaciones', 'facturacion', 'compras', 'contratos', 'firmas', 'tickets', 'canales', 'documentos', 'calendario', 'ia']) as k
  union all
  select 'energia', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'riesgos', 'proyectos', 'hseq', 'inventario', 'mantenimiento', 'clientes', 'cotizaciones', 'facturacion', 'compras', 'catalogos', 'contratos', 'firmas', 'tickets', 'canales', 'documentos', 'calendario', 'ia']) as k
  union all
  select 'manufactura', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'riesgos', 'hseq', 'inventario', 'produccion', 'mantenimiento', 'clientes', 'cotizaciones', 'facturacion', 'catalogos', 'compras', 'firmas', 'tickets', 'canales', 'documentos', 'calendario', 'ia']) as k
  union all
  select 'comercio', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'inventario', 'catalogos', 'tienda', 'clientes', 'cotizaciones', 'facturacion', 'compras', 'tickets', 'canales', 'documentos', 'calendario', 'ia']) as k
  union all
  select 'ecommerce', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'inventario', 'catalogos', 'tienda', 'ecommerce', 'clientes', 'cotizaciones', 'facturacion', 'compras', 'tickets', 'canales', 'documentos', 'calendario', 'ia']) as k
  union all
  select 'servicios', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'proyectos', 'clientes', 'cotizaciones', 'facturacion', 'contratos', 'firmas', 'tickets', 'consultoria', 'canales', 'documentos', 'calendario', 'ia']) as k
  union all
  select 'tecnologia', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'proyectos', 'clientes', 'cotizaciones', 'facturacion', 'contratos', 'reclutamiento', 'desempeno', 'tickets', 'canales', 'documentos', 'calendario', 'ia']) as k
  union all
  select 'salud', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'pacientes', 'riesgos', 'hseq', 'inventario', 'facturacion', 'clientes', 'firmas', 'tickets', 'consultoria', 'trazabilidad', 'canales', 'documentos', 'calendario', 'ia']) as k
  union all
  select 'educacion', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'estudiantes', 'capacitacion', 'facturacion', 'clientes', 'inventario', 'firmas', 'contratos', 'tickets', 'canales', 'documentos', 'calendario', 'ia']) as k
  union all
  select 'logistica', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'riesgos', 'hseq', 'inventario', 'flota', 'mantenimiento', 'clientes', 'cotizaciones', 'facturacion', 'compras', 'catalogos', 'tickets', 'canales', 'documentos', 'calendario', 'ia']) as k
  union all
  select 'alimentos', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'restaurante', 'inventario', 'catalogos', 'compras', 'hseq', 'facturacion', 'tickets', 'canales', 'documentos', 'calendario', 'ia']) as k
  union all
  select 'agro', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'agro', 'inventario', 'mantenimiento', 'flota', 'hseq', 'riesgos', 'clientes', 'cotizaciones', 'facturacion', 'compras', 'tickets', 'canales', 'documentos', 'calendario', 'ia']) as k
  union all
  select 'inmobiliario', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'inmobiliario', 'contratos', 'clientes', 'cotizaciones', 'facturacion', 'mantenimiento', 'firmas', 'tickets', 'canales', 'documentos', 'calendario', 'ia']) as k
  union all
  select 'hoteleria', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'hoteleria', 'restaurante', 'inventario', 'mantenimiento', 'facturacion', 'clientes', 'tickets', 'canales', 'documentos', 'calendario', 'ia']) as k
  union all
  select 'financiero', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'clientes', 'cotizaciones', 'facturacion', 'contratos', 'riesgos', 'firmas', 'trazabilidad', 'desempeno', 'tickets', 'consultoria', 'canales', 'documentos', 'calendario', 'ia']) as k
  union all
  select 'mineria', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'riesgos', 'hseq', 'proyectos', 'inventario', 'mantenimiento', 'flota', 'compras', 'contratos', 'firmas', 'trazabilidad', 'tickets', 'canales', 'documentos', 'calendario', 'ia']) as k
  union all
  select 'telecomunicaciones', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'proyectos', 'inventario', 'mantenimiento', 'flota', 'clientes', 'cotizaciones', 'facturacion', 'contratos', 'tickets', 'canales', 'documentos', 'calendario', 'ia']) as k
  union all
  select 'seguridad', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'riesgos', 'hseq', 'inventario', 'contratos', 'clientes', 'cotizaciones', 'facturacion', 'firmas', 'capacitacion', 'tickets', 'trazabilidad', 'canales', 'documentos', 'calendario', 'ia']) as k
  union all
  select 'medios', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'proyectos', 'clientes', 'cotizaciones', 'facturacion', 'contratos', 'inventario', 'firmas', 'tickets', 'canales', 'documentos', 'calendario', 'ia']) as k
  union all
  select 'ong', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'proyectos', 'clientes', 'contratos', 'capacitacion', 'firmas', 'trazabilidad', 'tickets', 'canales', 'documentos', 'calendario', 'ia']) as k
  union all
  select 'gobierno', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'proyectos', 'contratos', 'compras', 'firmas', 'hseq', 'riesgos', 'trazabilidad', 'tickets', 'canales', 'documentos', 'calendario', 'ia']) as k
  union all
  select 'otro', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'clientes', 'firmas', 'tickets', 'canales', 'documentos', 'calendario', 'ia']) as k
  union all
  select 'fitness-bienestar', k, 'add' from unnest(array['empleados', 'asistencia', 'nomina', 'clientes', 'inventario', 'firmas', 'tickets', 'canales', 'documentos', 'calendario', 'ia']) as k
;

-- ─── Lo que cada subsector cambia ───────────────────────────────────────────
--
-- Deliberately small. A delta that rewrites its parent means the sector above
-- it was drawn wrong, and the fix is a new sector, not a subsector that
-- disagrees with everything.
--
-- A few are worth reading as product decisions: `hoteleria-operador` removes
-- `hoteleria` itself — a tour operator sells trips and owns no rooms, so the
-- vertical module would be an empty screen — and `alimentos-rapida` adds the
-- public storefront, because delivery is not a side channel for fast food, it
-- is the business.

insert into public.sector_modules (sector_key, module_key, mode)
  select 'salud-consultorio', k, 'remove' from unnest(array['hseq', 'riesgos', 'inventario', 'trazabilidad']) as k
  union all
  select 'salud-ips', k, 'add' from unnest(array['mantenimiento', 'desempeno']) as k
  union all
  select 'salud-laboratorio', k, 'add' from unnest(array['catalogos']) as k
  union all
  select 'salud-laboratorio', k, 'remove' from unnest(array['consultoria']) as k
  union all
  select 'salud-odontologia', k, 'add' from unnest(array['catalogos', 'cotizaciones']) as k
  union all
  select 'salud-odontologia', k, 'remove' from unnest(array['hseq', 'trazabilidad']) as k
  union all
  select 'salud-estetica', k, 'add' from unnest(array['catalogos', 'cotizaciones']) as k
  union all
  select 'salud-estetica', k, 'remove' from unnest(array['hseq', 'riesgos', 'trazabilidad']) as k
  union all
  select 'salud-veterinaria', k, 'add' from unnest(array['catalogos', 'tienda']) as k
  union all
  select 'salud-veterinaria', k, 'remove' from unnest(array['consultoria', 'trazabilidad']) as k
  union all
  select 'comercio-retail', k, 'remove' from unnest(array['cotizaciones']) as k
  union all
  select 'comercio-mayorista', k, 'add' from unnest(array['contratos', 'flota']) as k
  union all
  select 'comercio-mayorista', k, 'remove' from unnest(array['tienda']) as k
  union all
  select 'comercio-ferreteria', k, 'remove' from unnest(array['tienda']) as k
  union all
  select 'comercio-farmacia', k, 'add' from unnest(array['trazabilidad']) as k
  union all
  select 'comercio-farmacia', k, 'remove' from unnest(array['cotizaciones']) as k
  union all
  select 'comercio-super', k, 'add' from unnest(array['flota', 'mantenimiento']) as k
  union all
  select 'comercio-super', k, 'remove' from unnest(array['cotizaciones']) as k
  union all
  select 'alimentos-salon', k, 'add' from unnest(array['clientes']) as k
  union all
  select 'alimentos-rapida', k, 'add' from unnest(array['tienda', 'ecommerce']) as k
  union all
  select 'alimentos-bar', k, 'add' from unnest(array['clientes']) as k
  union all
  select 'alimentos-bar', k, 'remove' from unnest(array['hseq']) as k
  union all
  select 'alimentos-catering', k, 'add' from unnest(array['clientes', 'cotizaciones', 'contratos', 'proyectos']) as k
  union all
  select 'alimentos-panaderia', k, 'add' from unnest(array['produccion']) as k
  union all
  select 'hoteleria-hotel', k, 'add' from unnest(array['hseq']) as k
  union all
  select 'hoteleria-hostal', k, 'remove' from unnest(array['restaurante', 'mantenimiento']) as k
  union all
  select 'hoteleria-finca', k, 'add' from unnest(array['agro']) as k
  union all
  select 'hoteleria-operador', k, 'add' from unnest(array['proyectos', 'cotizaciones', 'contratos']) as k
  union all
  select 'hoteleria-operador', k, 'remove' from unnest(array['hoteleria', 'restaurante', 'inventario', 'mantenimiento']) as k
  union all
  select 'educacion-colegio', k, 'add' from unnest(array['desempeno', 'reclutamiento']) as k
  union all
  select 'educacion-instituto', k, 'add' from unnest(array['proyectos']) as k
  union all
  select 'educacion-academia', k, 'remove' from unnest(array['inventario', 'contratos']) as k
  union all
  select 'educacion-universidad', k, 'add' from unnest(array['proyectos', 'desempeno', 'reclutamiento', 'trazabilidad']) as k
  union all
  select 'construccion-civil', k, 'add' from unnest(array['flota']) as k
  union all
  select 'construccion-mep', k, 'add' from unnest(array['catalogos']) as k
  union all
  select 'construccion-remodel', k, 'add' from unnest(array['catalogos']) as k
  union all
  select 'construccion-remodel', k, 'remove' from unnest(array['hseq']) as k
  union all
  select 'construccion-interv', k, 'add' from unnest(array['trazabilidad']) as k
  union all
  select 'construccion-interv', k, 'remove' from unnest(array['inventario', 'mantenimiento', 'compras']) as k
  union all
  select 'agro-permanente', k, 'add' from unnest(array['trazabilidad']) as k
  union all
  select 'agro-transitorio', k, 'add' from unnest(array['produccion']) as k
  union all
  select 'agro-ganaderia', k, 'add' from unnest(array['produccion', 'trazabilidad']) as k
  union all
  select 'agro-poscosecha', k, 'add' from unnest(array['produccion', 'catalogos', 'trazabilidad']) as k
  union all
  select 'servicios-consultoria', k, 'add' from unnest(array['desempeno']) as k
  union all
  select 'servicios-contable', k, 'add' from unnest(array['trazabilidad']) as k
  union all
  select 'servicios-contable', k, 'remove' from unnest(array['proyectos']) as k
  union all
  select 'servicios-legal', k, 'add' from unnest(array['trazabilidad']) as k
  union all
  select 'servicios-agencia', k, 'add' from unnest(array['desempeno', 'reclutamiento']) as k
  union all
  select 'servicios-ti', k, 'add' from unnest(array['inventario', 'desempeno']) as k
  union all
  select 'logistica-carga', k, 'add' from unnest(array['contratos']) as k
  union all
  select 'logistica-carga', k, 'remove' from unnest(array['catalogos']) as k
  union all
  select 'logistica-ultima', k, 'add' from unnest(array['tienda', 'ecommerce']) as k
  union all
  select 'logistica-bodegaje', k, 'add' from unnest(array['contratos']) as k
  union all
  select 'logistica-bodegaje', k, 'remove' from unnest(array['flota']) as k
  union all
  select 'inmobiliario-arriendo', k, 'remove' from unnest(array['cotizaciones']) as k
  union all
  select 'inmobiliario-ph', k, 'add' from unnest(array['hseq', 'riesgos']) as k
  union all
  select 'inmobiliario-ph', k, 'remove' from unnest(array['cotizaciones']) as k
  union all
  select 'inmobiliario-corretaje', k, 'add' from unnest(array['desempeno']) as k
  union all
  select 'inmobiliario-corretaje', k, 'remove' from unnest(array['mantenimiento']) as k
  union all
  select 'manufactura-metal', k, 'add' from unnest(array['proyectos']) as k
  union all
  select 'manufactura-plastico', k, 'add' from unnest(array['trazabilidad']) as k
  union all
  select 'manufactura-textil', k, 'add' from unnest(array['tienda']) as k
  union all
  select 'manufactura-alimentos', k, 'add' from unnest(array['trazabilidad']) as k
  union all
  select 'fitness-gimnasio', k, 'add' from unnest(array['contratos', 'mantenimiento']) as k
  union all
  select 'fitness-estudio', k, 'add' from unnest(array['contratos', 'capacitacion']) as k
  union all
  select 'fitness-estudio', k, 'remove' from unnest(array['inventario']) as k
  union all
  select 'fitness-spa', k, 'add' from unnest(array['contratos', 'catalogos', 'cotizaciones']) as k
  union all
  select 'fitness-centro', k, 'add' from unnest(array['contratos', 'pacientes']) as k
;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop trigger  if exists sector_modules_guard_mode on public.sector_modules;
--   drop function if exists app.guard_sector_module_mode();
--   drop table    if exists public.sector_modules;
--
-- Purely additive: no existing table, policy or function is modified, and no
-- business row is touched. Reverting leaves the product exactly where
-- migration 33 left it — presets read from TypeScript, subsectors inert.
-- ═══════════════════════════════════════════════════════════════════════════
