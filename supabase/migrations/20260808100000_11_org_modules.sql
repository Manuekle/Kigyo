-- ═══════════════════════════════════════════════════════════════════════════
-- 11 — Company type and enabled modules
--
-- Kigyo ships twenty-one modules. No customer uses all of them: a consultancy
-- has no warehouse, a retailer runs no HSEQ programme. Until now the only way
-- to hide a module was to revoke its permission from every role, which
-- conflates two different questions:
--
--   · does this company use this module at all?  → org-wide, this migration
--   · may this person open it?                   → per role, role_permissions
--
-- Keeping them apart is what lets an administrator switch off `tienda` for the
-- whole company without also having to decide, per role, that nobody may see
-- a store the company does not run.
--
-- `industry` (free text, collected at signup) stays as-is. It is prose for
-- reports and sales; `company_type` is the enumerated one the product reads.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.organizations
  add column company_type text
    check (company_type is null or company_type in (
      'construccion', 'energia', 'manufactura', 'comercio', 'servicios',
      'tecnologia', 'salud', 'logistica', 'otro'
    )),
  -- Empty means "never configured", NOT "everything off". Every organization
  -- that predates this column has an empty array, and none of them should wake
  -- up to a blank sidebar — src/lib/modules.ts resolves empty to the company
  -- type's preset, and to the full catalogue when there is no type either.
  -- A default of '{}' rather than the full list keeps that distinction
  -- representable instead of baking today's module list into old rows.
  add column enabled_modules text[] not null default '{}';

-- Membership of this array is checked against the same vocabulary the
-- permission keys use, so `enabled_modules` can never drift into naming a
-- module that no permission — and therefore no route — belongs to.
-- `dashboard` and `configuracion` are rejected on purpose: they are the shell,
-- always on, and storing them would imply they could be switched off.
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
      'proyectos', 'hseq', 'inventario', 'trazabilidad',
      'cotizaciones', 'compras', 'catalogos', 'tienda',
      'canales', 'tickets', 'firmas', 'documentos', 'calendario',
      'consultoria', 'ia'
    )
  );
$$;

alter table public.organizations
  add constraint organizations_enabled_modules_known
  check (app.valid_module_keys(enabled_modules));

-- Reading the column is already covered by `organizations_select`, and writing
-- it by `organizations_update`, which is admin-only (`app.is_org_admin`). No
-- new policy is needed — and none should be added, because a non-admin being
-- able to switch modules on for the whole company is exactly what the existing
-- policy is there to prevent.

comment on column public.organizations.company_type is
  'Enumerated company type. Proposes the module preset in Configuración → Módulos.';
comment on column public.organizations.enabled_modules is
  'Modules this organization uses. Empty = never configured; the app falls back to the company type preset.';
