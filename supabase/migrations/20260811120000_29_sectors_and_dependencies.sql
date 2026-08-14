-- ═══════════════════════════════════════════════════════════════════════════
-- 29 — Sectors as data, subsectors, and dependencies between modules
--
-- Three things that were structurally missing rather than merely absent.
--
-- ─── 1. A sector was a CHECK constraint ────────────────────────────────────
--
-- `organizations.company_type` was validated by a literal list inside a check
-- constraint, so adding «Fitness y bienestar» meant writing a migration,
-- reviewing it, and deploying it — for a row of reference data. The list also
-- lived a second time in `handle_new_user`, and a third in `COMPANY_TYPES` in
-- TypeScript. Migration 28 already removed the copy in the trigger; this
-- removes the constraint, and a sector becomes an INSERT.
--
-- ─── 2. There were no subsectors ───────────────────────────────────────────
--
-- «Salud» proposes the same modules to a solo dentist and to a hospital, and
-- «Alimentos» the same to a bakery and to a bar. A sector is the right grain
-- for a first guess and the wrong grain for a good one, so a sector may now
-- have children, and a child amends its parent's proposal rather than
-- replacing it.
--
-- ─── 3. Modules could be switched on incoherently ──────────────────────────
--
-- `tienda` could be enabled without `catalogos`, which is a storefront with
-- nothing to sell; `ecommerce` without `tienda`; `nomina` without `empleados`.
-- Nothing refused it and nothing warned, so the first sign was an empty screen.
--
-- ─── What is NOT here ──────────────────────────────────────────────────────
--
-- The module catalogue itself. Modules stay in TypeScript
-- (src/lib/modules/registry.ts) because a module is code — a route, a query
-- file, a mutations file, a screen — and its entry belongs beside them where
-- the compiler can see it. Sectors are data a product person edits; modules
-- are not. The two moving in opposite directions is the point, not an
-- inconsistency.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Sectors, and their subsectors ──────────────────────────────────────────
-- One table, self-referencing. A subsector is a row with a parent; the
-- hierarchy is deliberately two levels deep and the constraint below says so —
-- a tree would invite «Salud → Clínica → Clínica dental → …» and the preset
-- arithmetic stops being explainable after one hop.

create table public.sectors (
  key        text primary key check (key ~ '^[a-z][a-z0-9-]{1,40}$'),
  label      text not null check (length(btrim(label)) between 2 and 60),
  parent_key text references public.sectors (key) on delete cascade,
  sort       int  not null default 100,
  is_active  boolean not null default true,
  check (parent_key is distinct from key)
);

create index sectors_parent_idx on public.sectors (parent_key, sort);

comment on table public.sectors is
  'Catálogo de sectores. parent_key null = sector; no null = subsector. Solo sugieren módulos: nunca restringen.';

alter table public.sectors enable row level security;
alter table public.sectors force  row level security;

create policy sectors_select on public.sectors
  for select to authenticated using (true);

revoke insert, update, delete on public.sectors from authenticated;

-- The twenty-two that already existed, in the order the picker shows them.
-- Seeded from the same list the CHECK constraint held, so this migration
-- changes where the vocabulary lives and not what is in it.
insert into public.sectors (key, label, sort) values
  ('construccion',       'Construcción e infraestructura', 10),
  ('energia',            'Energía y renovables',           20),
  ('manufactura',        'Manufactura y producción',       30),
  ('comercio',           'Comercio y retail',              40),
  ('ecommerce',          'Ecommerce y venta en línea',     50),
  ('servicios',          'Servicios profesionales',        60),
  ('tecnologia',         'Tecnología y software',          70),
  ('salud',              'Salud',                          80),
  ('educacion',          'Educación',                      90),
  ('logistica',          'Logística y transporte',        100),
  ('alimentos',          'Restaurantes y alimentos',      110),
  ('agro',               'Agro y agroindustria',          120),
  ('inmobiliario',       'Inmobiliario',                  130),
  ('hoteleria',          'Hotelería y turismo',           140),
  ('financiero',         'Financiero y seguros',          150),
  ('mineria',            'Minería y extractivas',         160),
  ('telecomunicaciones', 'Telecomunicaciones',            170),
  ('seguridad',          'Seguridad y vigilancia',        180),
  ('medios',             'Medios y publicidad',           190),
  ('ong',                'ONG y fundaciones',             200),
  ('gobierno',           'Sector público',                210),
  ('otro',               'Otro',                          999);

-- Subsectors, for the sectors where one preset genuinely cannot serve the
-- whole industry. Deliberately not exhaustive: a subsector that would propose
-- exactly its parent's modules is a dropdown entry that costs the customer a
-- decision and gives nothing back.
insert into public.sectors (key, label, parent_key, sort) values
  ('salud-consultorio',    'Consultorio',              'salud',        10),
  ('salud-ips',            'IPS / Clínica',            'salud',        20),
  ('salud-laboratorio',    'Laboratorio',              'salud',        30),
  ('salud-odontologia',    'Odontología',              'salud',        40),
  ('salud-estetica',       'Estética y bienestar',     'salud',        50),
  ('salud-veterinaria',    'Veterinaria',              'salud',        60),

  ('comercio-retail',      'Punto físico',             'comercio',     10),
  ('comercio-mayorista',   'Mayorista y distribución', 'comercio',     20),
  ('comercio-ferreteria',  'Ferretería',               'comercio',     30),
  ('comercio-farmacia',    'Farmacia',                 'comercio',     40),
  ('comercio-super',       'Supermercado',             'comercio',     50),

  ('alimentos-salon',      'Restaurante de salón',     'alimentos',    10),
  ('alimentos-rapida',     'Comida rápida',            'alimentos',    20),
  ('alimentos-bar',        'Bar',                      'alimentos',    30),
  ('alimentos-catering',   'Catering',                 'alimentos',    40),
  ('alimentos-panaderia',  'Panadería y producción',   'alimentos',    50),

  ('hoteleria-hotel',      'Hotel',                    'hoteleria',    10),
  ('hoteleria-hostal',     'Hostal',                   'hoteleria',    20),
  ('hoteleria-finca',      'Finca y glamping',         'hoteleria',    30),
  ('hoteleria-operador',   'Operador turístico',       'hoteleria',    40),

  ('educacion-colegio',    'Colegio',                  'educacion',    10),
  ('educacion-instituto',  'Instituto técnico',        'educacion',    20),
  ('educacion-academia',   'Academia e idiomas',       'educacion',    30),
  ('educacion-universidad','Universidad',              'educacion',    40),

  ('construccion-civil',   'Obra civil',               'construccion', 10),
  ('construccion-mep',     'Instalaciones y MEP',      'construccion', 20),
  ('construccion-remodel', 'Remodelación',             'construccion', 30),
  ('construccion-interv',  'Interventoría',            'construccion', 40),

  ('agro-permanente',      'Cultivo permanente',       'agro',         10),
  ('agro-transitorio',     'Cultivo transitorio',      'agro',         20),
  ('agro-ganaderia',       'Ganadería',                'agro',         30),
  ('agro-poscosecha',      'Poscosecha',               'agro',         40),

  ('servicios-consultoria','Consultoría',              'servicios',    10),
  ('servicios-contable',   'Contabilidad',             'servicios',    20),
  ('servicios-legal',      'Legal',                    'servicios',    30),
  ('servicios-agencia',    'Agencia',                  'servicios',    40),
  ('servicios-ti',         'TI y soporte',             'servicios',    50),

  ('logistica-carga',      'Transporte de carga',      'logistica',    10),
  ('logistica-ultima',     'Última milla',             'logistica',    20),
  ('logistica-bodegaje',   'Bodegaje',                 'logistica',    30),

  ('inmobiliario-arriendo','Arrendamiento',            'inmobiliario', 10),
  ('inmobiliario-ph',      'Propiedad horizontal',     'inmobiliario', 20),
  ('inmobiliario-corretaje','Corretaje',               'inmobiliario', 30),

  ('manufactura-metal',    'Metalmecánica',            'manufactura',  10),
  ('manufactura-plastico', 'Plásticos',                'manufactura',  20),
  ('manufactura-textil',   'Textil',                   'manufactura',  30),
  ('manufactura-alimentos','Alimentos procesados',     'manufactura',  40);

/**
 * Two levels, and no more.
 *
 * Enforced rather than merely intended: the preset arithmetic is "the parent's
 * modules, amended by the child", and it stays explainable for exactly one hop.
 * A grandchild would raise a question — does it amend its parent, or the
 * parent's parent, or both — with no answer a customer could predict.
 */
create or replace function app.guard_sector_depth()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_key is not null and exists (
    select 1 from public.sectors s
    where s.key = new.parent_key and s.parent_key is not null
  ) then
    raise exception 'Un subsector no puede colgar de otro subsector (%).', new.parent_key
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger sectors_guard_depth
  before insert or update on public.sectors
  for each row execute function app.guard_sector_depth();

-- ─── The constraint becomes a reference ─────────────────────────────────────
-- Every existing value is one of the twenty-two seeded above, so the foreign
-- key adopts the data as it stands. `on update cascade` because a key rename
-- must reach the companies naming it rather than abort halfway; `on delete
-- restrict` because deleting a sector out from under a company would silently
-- erase the answer to "what business is this".

alter table public.organizations
  drop constraint if exists organizations_company_type_check;

alter table public.organizations
  add constraint organizations_company_type_fkey
  foreign key (company_type) references public.sectors (key)
  on update cascade on delete restrict;

alter table public.organizations
  add column subsector text references public.sectors (key)
    on update cascade on delete set null;

comment on column public.organizations.subsector is
  'Subsector elegido, si el sector tiene. Solo afina la sugerencia de módulos.';

/**
 * A subsector must belong to the sector the company actually picked.
 *
 * Two nullable columns referencing the same table cannot express this between
 * themselves — the foreign keys are satisfied by any two rows. Without it a
 * clinic could be stored as `salud` + `alimentos-bar`, which no screen would
 * ever show and every preset calculation would have to defend against.
 */
create or replace function app.guard_subsector_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.subsector is null then
    return new;
  end if;

  if new.company_type is null then
    raise exception 'No se puede elegir un subsector sin sector.'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.sectors s
    where s.key = new.subsector and s.parent_key = new.company_type
  ) then
    raise exception 'El subsector % no pertenece al sector %.', new.subsector, new.company_type
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger organizations_guard_subsector
  before insert or update of company_type, subsector on public.organizations
  for each row execute function app.guard_subsector_parent();

-- ─── Dependencies between modules ───────────────────────────────────────────

create table public.module_dependencies (
  module_key   text not null,
  requires_key text not null,
  -- 'hard': the module cannot work without it, and enabling one enables both.
  -- 'soft': it works, but badly enough to be worth offering. The UI proposes,
  --         and the customer may decline — which is the whole difference.
  kind         text not null default 'soft' check (kind in ('hard', 'soft')),
  primary key (module_key, requires_key),
  check (module_key <> requires_key)
);

alter table public.module_dependencies enable row level security;
alter table public.module_dependencies force  row level security;

create policy module_dependencies_select on public.module_dependencies
  for select to authenticated using (true);

revoke insert, update, delete on public.module_dependencies from authenticated;

comment on table public.module_dependencies is
  'Qué módulo necesita a qué otro. hard = se activa junto; soft = se ofrece. Espejo de MODULE_DEPENDENCIES en src/lib/modules/registry.ts.';

insert into public.module_dependencies (module_key, requires_key, kind) values
  -- Selling to the public. A storefront with no catalogue has nothing to
  -- show, and an online store with no storefront has nothing to sell.
  ('tienda',        'catalogos',    'hard'),
  ('tienda',        'inventario',   'soft'),
  ('ecommerce',     'tienda',       'hard'),
  -- Commercial. `invoices.client_id` is nullable and `client_name` carries a
  -- walk-in customer, so billing works without a client directory: soft.
  ('facturacion',   'clientes',     'soft'),
  ('cotizaciones',  'clientes',     'soft'),
  ('cotizaciones',  'catalogos',    'soft'),
  ('contratos',     'clientes',     'soft'),
  -- People. Every one of these is a fact recorded *about an employee*.
  ('nomina',        'empleados',    'hard'),
  ('asistencia',    'empleados',    'hard'),
  ('desempeno',     'empleados',    'hard'),
  ('capacitacion',  'empleados',    'soft'),
  ('reclutamiento', 'empleados',    'soft'),
  -- Operations.
  ('produccion',    'inventario',   'hard'),
  ('produccion',    'catalogos',    'soft'),
  ('mantenimiento', 'inventario',   'soft'),
  ('flota',         'mantenimiento','soft'),
  -- Sector modules that lean on a general one.
  ('restaurante',   'catalogos',    'soft'),
  ('restaurante',   'inventario',   'soft'),
  ('hoteleria',     'clientes',     'soft'),
  ('inmobiliario',  'contratos',    'soft'),
  ('pacientes',     'calendario',   'soft'),
  ('estudiantes',   'calendario',   'soft');

/**
 * Dependencies must not form a cycle.
 *
 * Two modules that each require the other cannot both be resolved: enabling
 * either would enable both forever, and disabling either would be refused by
 * the other. Cheap to prevent at insert, impossible to reason about once
 * shipped.
 */
create or replace function app.guard_dependency_acyclic()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    with recursive reachable as (
      select new.requires_key as key
      union
      select d.requires_key
      from public.module_dependencies d
      join reachable r on d.module_key = r.key
    )
    select 1 from reachable where key = new.module_key
  ) then
    raise exception 'La dependencia % → % crearía un ciclo.', new.module_key, new.requires_key
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger module_dependencies_guard_acyclic
  after insert or update on public.module_dependencies
  for each row execute function app.guard_dependency_acyclic();

-- ─── Provisioning validates the sector by looking it up ─────────────────────
--
-- `app.provision_company` (migration 28) dropped an unrecognised sector by
-- attempting the INSERT and retrying on `check_violation`. That was the right
-- shape while the vocabulary lived in a check constraint and re-listing it
-- would have been a third copy. It is the wrong shape now: the constraint is a
-- foreign key, which raises `foreign_key_violation`, so the retry stopped
-- firing and an unrecognised sector aborted the whole signup.
--
-- With a real table there is nothing to copy — the list can simply be
-- consulted. Redefined whole because a function has no ALTER for its body.

create or replace function app.provision_company(
  p_account_id uuid,
  p_name       text,
  p_sector     text,
  p_user_id    uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug     text;
  v_slug_try text;
  v_sector   text := nullif(btrim(p_sector), '');
  v_org_id   uuid;
  n          int := 0;
begin
  /**
   * An unrecognised sector is dropped, never raised on.
   *
   * The sector proposes a module preset and restricts nothing, so starting with
   * none and picking one in Configuración is a mild inconvenience — whereas
   * refusing would abort the provisioning and leave the customer with no
   * company at all. Signup metadata is client-supplied, so this is a value that
   * genuinely arrives wrong.
   *
   * A subsector is never accepted here: it is chosen after the sector, on a
   * screen that knows which parent it must belong to.
   */
  if v_sector is not null and not exists (
    select 1 from public.sectors s
    where s.key = v_sector and s.parent_key is null and s.is_active
  ) then
    v_sector := null;
  end if;

  v_slug := app.slugify(p_name);
  v_slug_try := v_slug;
  while exists (select 1 from public.organizations o where o.slug = v_slug_try) loop
    n := n + 1;
    v_slug_try := v_slug || '-' || n::text;
  end loop;

  insert into public.organizations (name, slug, company_type, account_id)
  values (btrim(p_name), v_slug_try, v_sector, p_account_id)
  returning id into v_org_id;

  -- Before the membership: it references (org_id, role).
  perform app.seed_default_roles(v_org_id);

  insert into public.memberships (org_id, user_id, role)
  values (v_org_id, p_user_id, 'Administrador');

  perform app.seed_default_permissions(v_org_id);

  return v_org_id;
end;
$$;

revoke all on function app.provision_company(uuid, text, text, uuid) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop trigger  if exists module_dependencies_guard_acyclic on public.module_dependencies;
--   drop function if exists app.guard_dependency_acyclic();
--   drop table    if exists public.module_dependencies;
--   drop trigger  if exists organizations_guard_subsector on public.organizations;
--   drop function if exists app.guard_subsector_parent();
--   alter table public.organizations drop column subsector;
--   alter table public.organizations drop constraint organizations_company_type_fkey;
--   -- and restore the CHECK from migration 14 if the sectors table is dropped
--   drop trigger  if exists sectors_guard_depth on public.sectors;
--   drop function if exists app.guard_sector_depth();
--   drop table    if exists public.sectors;
-- ═══════════════════════════════════════════════════════════════════════════
