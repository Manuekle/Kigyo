-- ═══════════════════════════════════════════════════════════════════════════
-- 14 — Subscription plan, thirteen more sectors, sixteen more modules
--
-- Three things that belong together because they are one decision each way:
--
--   · `plan`             — what did this company buy?
--   · `company_type`     — what business is it in? (proposes the module preset)
--   · `enabled_modules`  — what does it actually use?
--
-- Until now only the last two existed, and the three tiers on /pricing were
-- prose: they named modules a Starter account could switch on anyway. The plan
-- is the outermost gate — a module it does not include cannot be enabled at
-- all, so it never reaches the "does this company use it" question.
--
-- The plan is deliberately NOT writable by the `authenticated` role. Letting a
-- customer update their own plan column is letting them buy Enterprise by
-- sending a PATCH. It is changed by the billing process (service_role) or by
-- scripts/set-plan.mjs, and the trigger below is what enforces that.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Plan ───────────────────────────────────────────────────────────────────

alter table public.organizations
  add column plan text not null default 'starter'
    check (plan in ('starter', 'growth', 'enterprise'));

-- Every organization that predates this column was sold before plans existed
-- and is, in practice, using whatever it switched on. Dropping it to Starter
-- would silently remove modules from accounts already relying on them, so they
-- are grandfathered to the top tier. The `default` above only applies to rows
-- created from here on.
update public.organizations set plan = 'enterprise';

/**
 * PostgREST connects as `authenticated` for any signed-in caller and as
 * `service_role` for the billing process. A column-scoped REVOKE cannot be
 * used here: migration 08 grants UPDATE at table level, and Postgres will not
 * subtract a single column from a table-wide grant — it warns and does
 * nothing. A trigger is also the only form that keeps working when a later
 * migration adds a column, which a per-column re-GRANT would silently miss.
 */
create or replace function app.guard_plan_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.plan is distinct from old.plan and current_user = 'authenticated' then
    raise exception 'El plan de la organización solo puede cambiarlo el proceso de facturación'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger organizations_guard_plan
  before update on public.organizations
  for each row execute function app.guard_plan_change();

revoke all on function app.guard_plan_change() from public, anon, authenticated;

comment on column public.organizations.plan is
  'Subscription tier. Gates which modules may be enabled at all (src/lib/plans.ts). Writable only by service_role.';

-- ─── Sectors ────────────────────────────────────────────────────────────────
-- Nine sectors covered construction, energy, manufacturing, retail, services,
-- technology, health, logistics and "otro". Everything else — a school, a
-- restaurant, a farm, a hotel — landed on "otro" and got the thinnest preset
-- in the product, which is the opposite of what a sector picker is for.

alter table public.organizations
  drop constraint if exists organizations_company_type_check;

alter table public.organizations
  add constraint organizations_company_type_check
  check (company_type is null or company_type in (
    'construccion', 'energia', 'manufactura', 'comercio', 'ecommerce',
    'servicios', 'tecnologia', 'salud', 'educacion', 'logistica',
    'alimentos', 'agro', 'inmobiliario', 'hoteleria', 'financiero',
    'mineria', 'telecomunicaciones', 'seguridad', 'medios', 'ong',
    'gobierno', 'otro'
  ));

-- ─── Permissions for the new modules ────────────────────────────────────────
-- Read/write per module, the same shape as every existing one. `on conflict do
-- nothing` so re-running against a database that already has them is a no-op.

insert into public.permissions (key, module, action, label) values
  ('reclutamiento:read',   'reclutamiento',  'read',   'Ver reclutamiento'),
  ('reclutamiento:write',  'reclutamiento',  'write',  'Gestionar reclutamiento'),
  ('capacitacion:read',    'capacitacion',   'read',   'Ver capacitación'),
  ('capacitacion:write',   'capacitacion',   'write',  'Gestionar capacitación'),
  ('desempeno:read',       'desempeno',      'read',   'Ver desempeño'),
  ('desempeno:write',      'desempeno',      'write',  'Gestionar desempeño'),
  ('mantenimiento:read',   'mantenimiento',  'read',   'Ver mantenimiento'),
  ('mantenimiento:write',  'mantenimiento',  'write',  'Gestionar mantenimiento'),
  ('flota:read',           'flota',          'read',   'Ver flota'),
  ('flota:write',          'flota',          'write',  'Gestionar flota'),
  ('produccion:read',      'produccion',     'read',   'Ver producción'),
  ('produccion:write',     'produccion',     'write',  'Gestionar producción'),
  ('clientes:read',        'clientes',       'read',   'Ver clientes'),
  ('clientes:write',       'clientes',       'write',  'Gestionar clientes'),
  ('facturacion:read',     'facturacion',    'read',   'Ver facturación'),
  ('facturacion:write',    'facturacion',    'write',  'Gestionar facturación'),
  ('contratos:read',       'contratos',      'read',   'Ver contratos'),
  ('contratos:write',      'contratos',      'write',  'Gestionar contratos'),
  ('ecommerce:read',       'ecommerce',      'read',   'Ver ecommerce'),
  ('ecommerce:write',      'ecommerce',      'write',  'Gestionar ecommerce'),
  ('pacientes:read',       'pacientes',      'read',   'Ver pacientes'),
  ('pacientes:write',      'pacientes',      'write',  'Gestionar pacientes'),
  ('estudiantes:read',     'estudiantes',    'read',   'Ver estudiantes'),
  ('estudiantes:write',    'estudiantes',    'write',  'Gestionar estudiantes'),
  ('restaurante:read',     'restaurante',    'read',   'Ver restaurante'),
  ('restaurante:write',    'restaurante',    'write',  'Gestionar restaurante'),
  ('agro:read',            'agro',           'read',   'Ver agro'),
  ('agro:write',           'agro',           'write',  'Gestionar agro'),
  ('inmobiliario:read',    'inmobiliario',   'read',   'Ver inmuebles'),
  ('inmobiliario:write',   'inmobiliario',   'write',  'Gestionar inmuebles'),
  ('hoteleria:read',       'hoteleria',      'read',   'Ver hotelería'),
  ('hoteleria:write',      'hoteleria',      'write',  'Gestionar hotelería')
on conflict (key) do nothing;

-- Existing organizations need the grants too. Without this, an administrator
-- of an account created yesterday holds every permission except the sixteen
-- added today, and the modules read as "your role does not include this" —
-- a refusal with no available fix, since the matrix only offers what the org
-- has rows for.
insert into public.role_permissions (org_id, role, permission)
select o.id, 'Administrador', p.key
from public.organizations o
cross join public.permissions p
where p.module in (
  'reclutamiento', 'capacitacion', 'desempeno', 'mantenimiento', 'flota',
  'produccion', 'clientes', 'facturacion', 'contratos', 'ecommerce',
  'pacientes', 'estudiantes', 'restaurante', 'agro', 'inmobiliario', 'hoteleria'
)
on conflict do nothing;

-- Team leads read everything operational and write the things they run day to
-- day. Employees get the two that are about them personally — the courses they
-- are enrolled in and the review cycle they are part of — and nothing else:
-- a directory of every candidate's salary expectation is not employee-visible.
insert into public.role_permissions (org_id, role, permission)
select o.id, 'Líder de equipo', p.key
from public.organizations o
cross join public.permissions p
where p.key in (
  'clientes:read', 'clientes:write', 'contratos:read', 'facturacion:read',
  'reclutamiento:read', 'reclutamiento:write', 'capacitacion:read',
  'desempeno:read', 'desempeno:write',
  'mantenimiento:read', 'mantenimiento:write', 'flota:read', 'produccion:read',
  'ecommerce:read', 'pacientes:read', 'estudiantes:read', 'restaurante:read',
  'restaurante:write', 'agro:read', 'inmobiliario:read', 'hoteleria:read'
)
on conflict do nothing;

insert into public.role_permissions (org_id, role, permission)
select o.id, 'Empleado', p.key
from public.organizations o
cross join public.permissions p
where p.key in ('capacitacion:read', 'desempeno:read')
on conflict do nothing;

-- ─── Default grants for organizations created from here on ──────────────────

create or replace function app.seed_default_permissions(p_org_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.role_permissions (org_id, role, permission)
  select p_org_id, 'Administrador', key from public.permissions
  union all
  select p_org_id, 'Líder de equipo', key from public.permissions
    where key in (
      'dashboard:read', 'empleados:read', 'asistencia:read', 'asistencia:write',
      'riesgos:read', 'proyectos:read', 'proyectos:write', 'cotizaciones:read',
      'compras:read', 'compras:write', 'tienda:read', 'catalogos:read',
      'firmas:read', 'inventario:read', 'documentos:read', 'consultoria:read',
      'hseq:read', 'hseq:write', 'tickets:read', 'tickets:write',
      'canales:read', 'canales:write', 'calendario:read', 'calendario:write',
      'trazabilidad:read', 'ia:use',
      'clientes:read', 'clientes:write', 'contratos:read', 'facturacion:read',
      'reclutamiento:read', 'reclutamiento:write', 'capacitacion:read',
      'desempeno:read', 'desempeno:write',
      'mantenimiento:read', 'mantenimiento:write', 'flota:read',
      'produccion:read', 'ecommerce:read', 'pacientes:read', 'estudiantes:read',
      'restaurante:read', 'restaurante:write', 'agro:read',
      'inmobiliario:read', 'hoteleria:read'
    )
  union all
  select p_org_id, 'Empleado', key from public.permissions
    where key in (
      'dashboard:read', 'empleados:read', 'asistencia:read', 'documentos:read',
      'tickets:read', 'calendario:read', 'canales:read', 'tienda:read',
      'ia:use', 'capacitacion:read', 'desempeno:read'
    )
  on conflict do nothing;
$$;

revoke all on function app.seed_default_permissions(uuid) from public, anon, authenticated;

-- ─── The module vocabulary `enabled_modules` is checked against ─────────────

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
      'reclutamiento', 'capacitacion', 'desempeno',
      'proyectos', 'hseq', 'inventario', 'trazabilidad',
      'mantenimiento', 'flota', 'produccion',
      'cotizaciones', 'compras', 'catalogos', 'tienda',
      'clientes', 'facturacion', 'ecommerce',
      'canales', 'tickets', 'firmas', 'documentos', 'calendario',
      'contratos', 'consultoria', 'ia',
      'pacientes', 'estudiantes', 'restaurante', 'agro',
      'inmobiliario', 'hoteleria'
    )
  );
$$;

-- ─── Signup remembers the sector the company picked ─────────────────────────
-- `enabled_modules` is deliberately left empty. Empty means "never
-- configured", and src/lib/modules.ts already resolves that to the sector's
-- preset — so writing the preset here would duplicate twenty-two lists into
-- SQL and freeze them at signup, where today they follow the catalogue.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name     text;
  v_company  text;
  v_sector   text;
  v_slug     text;
  v_slug_try text;
  v_org_id   uuid;
  v_invite   public.invitations%rowtype;
  n          int := 0;
begin
  v_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, email, full_name)
  values (new.id, lower(new.email), v_name)
  on conflict (id) do nothing;

  -- Invited user: join the existing organization, never create a new one.
  select * into v_invite
  from public.invitations
  where email = lower(new.email)
    and accepted_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  if found then
    insert into public.memberships (org_id, user_id, role)
    values (v_invite.org_id, new.id, v_invite.role)
    on conflict (org_id, user_id) do nothing;

    update public.invitations set accepted_at = now() where id = v_invite.id;
    return new;
  end if;

  v_company := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'company'), ''),
    v_name
  );

  -- User metadata is client-supplied, so an unrecognised sector is dropped
  -- rather than inserted: the check constraint would abort signup entirely,
  -- and failing to create an account is a much worse outcome than starting
  -- with no sector and picking one in Configuración.
  v_sector := nullif(btrim(new.raw_user_meta_data ->> 'company_type'), '');
  if v_sector is not null and v_sector not in (
    'construccion', 'energia', 'manufactura', 'comercio', 'ecommerce',
    'servicios', 'tecnologia', 'salud', 'educacion', 'logistica',
    'alimentos', 'agro', 'inmobiliario', 'hoteleria', 'financiero',
    'mineria', 'telecomunicaciones', 'seguridad', 'medios', 'ong',
    'gobierno', 'otro'
  ) then
    v_sector := null;
  end if;

  v_slug := app.slugify(v_company);
  v_slug_try := v_slug;
  while exists (select 1 from public.organizations o where o.slug = v_slug_try) loop
    n := n + 1;
    v_slug_try := v_slug || '-' || n::text;
  end loop;

  insert into public.organizations (name, slug, industry, company_type)
  values (
    v_company,
    v_slug_try,
    nullif(btrim(new.raw_user_meta_data ->> 'industry'), ''),
    v_sector
  )
  returning id into v_org_id;

  insert into public.memberships (org_id, user_id, role)
  values (v_org_id, new.id, 'Administrador');

  perform app.seed_default_permissions(v_org_id);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
