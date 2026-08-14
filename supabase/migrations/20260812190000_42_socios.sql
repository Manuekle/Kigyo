-- ═══════════════════════════════════════════════════════════════════════════
-- 42 — Socios: el vertical de Fitness y bienestar
--
-- La migración 33 creó el sector y decidió, explícitamente, no darle módulo
-- propio: «un módulo `membresias` es una apuesta a que la demanda está ahí, y
-- la decisión M9 es esperar en vez de enviar una pantalla medio vacía».
--
-- La espera dejó a un gimnasio con once módulos genéricos y sin un solo lugar
-- donde anotar un socio, una membresía, una clase o a alguien entrando por la
-- puerta. Eso no es medio negocio: es el negocio entero. De los 23 sectores era
-- el único cuyo preset no describía lo que la empresa hace todos los días.
--
-- ─── Por qué `socios` y no `membresias` ────────────────────────────────────
--
-- La membresía es el contrato; el socio es la persona. Un centro terapéutico
-- atiende gente que nunca compra una membresía, y un gimnasio vende bonos de
-- diez entradas que tampoco lo son. Nombrar el módulo por el contrato dejaría
-- fuera la mitad de los subsectores desde el primer día.
--
-- ─── Seis tablas, y por qué no menos ───────────────────────────────────────
--
--   fitness_members        quién es      — la persona, exista o no contrato
--   fitness_plans          qué se vende  — el catálogo de planes del centro
--   fitness_subscriptions  qué compró    — plan + vigencia + estado de pago
--   fitness_classes        qué se dicta  — la clase con cupo y profesor
--   fitness_bookings       quién reservó — la reserva de un socio en una clase
--   fitness_checkins       quién entró   — el registro de acceso
--
-- `fitness_subscriptions` está aparte de `fitness_members` porque un socio
-- renueva: guardar la vigencia en la ficha de la persona borra su historia cada
-- mes y deja al centro sin poder responder «¿cuánto lleva con nosotros?», que
-- es la pregunta con la que se decide una retención.
--
-- `fitness_checkins` está aparte de `fitness_bookings` porque reservar y venir
-- no son lo mismo, y la diferencia entre ambos números *es* el problema que un
-- estudio de clases intenta resolver.
--
-- Prefijo `fitness_` como `patient_`, `farm_`, `hotel_` y `restaurant_`. Y
-- deliberadamente NO `members`: `public.memberships` ya existe y significa otra
-- cosa —- la pertenencia de un usuario a una empresa—, y dos tablas con ese
-- nombre en la misma base es exactamente la deriva que AGENTS.md prohíbe.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── El socio ───────────────────────────────────────────────────────────────

create table public.fitness_members (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  code        text,
  full_name   text not null check (length(btrim(full_name)) between 1 and 160),
  document_id text not null default '',
  email       text check (email is null or email = lower(email)),
  phone       text not null default '',
  birth_date  date,
  -- «Retirado» es la baja comercial: se fue del centro. `deleted_at` es el
  -- borrado del operador: la fila se creó por error. Son cosas distintas y el
  -- centro necesita las dos —- un socio retirado sigue en la historia de
  -- asistencia y de pagos, y borrarlo la dejaría huérfana.
  status      text not null default 'Activo'
                check (status in ('Activo', 'Inactivo', 'Suspendido', 'Retirado')),
  joined_on   date not null default current_date,
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (org_id, code)
);

create index fitness_members_org_idx
  on public.fitness_members (org_id, status, full_name) where deleted_at is null;

create trigger fitness_members_code before insert on public.fitness_members
  for each row execute function app.set_code('fitness_member', 'SOC', '5');

select app.apply_standard_rls('fitness_members', 'socios:read', 'socios:write');

comment on table public.fitness_members is
  'Socios del centro. La persona, exista o no una membresía vigente.';

-- ─── Lo que el centro vende ─────────────────────────────────────────────────

create table public.fitness_plans (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  name           text not null,
  description    text not null default '',
  price_cents    bigint not null default 0 check (price_cents >= 0),
  -- Los tres modelos que cubren los cuatro subsectores: mensualidad de
  -- gimnasio, bono de diez clases de un estudio, sesión suelta de un spa.
  billing        text not null default 'Mensual'
                   check (billing in ('Mensual', 'Trimestral', 'Semestral', 'Anual', 'Bono', 'Sesión')),
  -- Solo para los bonos: cuántas entradas trae. Null = ilimitado dentro de la
  -- vigencia, que es lo que significa una mensualidad de gimnasio.
  credits        int check (credits is null or credits > 0),
  duration_days  int not null default 30 check (duration_days > 0),
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create index fitness_plans_org_idx
  on public.fitness_plans (org_id, active, name) where deleted_at is null;

select app.apply_standard_rls('fitness_plans', 'socios:read', 'socios:write');

comment on table public.fitness_plans is
  'Catálogo de planes: mensualidad, bono de clases o sesión suelta.';

-- ─── Lo que un socio compró ─────────────────────────────────────────────────

create table public.fitness_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references public.fitness_members (id) on delete cascade,
  plan_id         uuid references public.fitness_plans (id) on delete set null,
  -- El nombre y el precio se copian al vender. Un plan cuyo precio sube el mes
  -- que viene no debe reescribir lo que este socio pagó en marzo, y un plan
  -- retirado del catálogo no debe dejar sin nombre las membresías que vendió.
  plan_name       text not null,
  price_cents     bigint not null default 0 check (price_cents >= 0),
  starts_on       date not null default current_date,
  ends_on         date not null,
  credits_left    int check (credits_left is null or credits_left >= 0),
  status          text not null default 'Vigente'
                    check (status in ('Vigente', 'Vencida', 'Cancelada', 'Congelada')),
  paid            boolean not null default false,
  -- Enlace opcional a la factura, para el centro que factura por Kigyo. Nulo
  -- para el que cobra por fuera, que es la mayoría el primer mes.
  invoice_id      uuid references public.invoices (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint fitness_subscriptions_range check (ends_on >= starts_on)
);

create index fitness_subscriptions_member_idx
  on public.fitness_subscriptions (member_id, ends_on desc);
-- La consulta de la pantalla: quién vence esta semana, quién debe.
create index fitness_subscriptions_due_idx
  on public.fitness_subscriptions (status, ends_on) where status = 'Vigente';

select app.apply_child_rls('fitness_subscriptions', 'fitness_members', 'member_id',
                           'socios:read', 'socios:write');

comment on table public.fitness_subscriptions is
  'Membresías vendidas. Una fila por compra: renovar crea otra, no reescribe la anterior.';

-- ─── Lo que se dicta ────────────────────────────────────────────────────────

create table public.fitness_classes (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  name          text not null,
  instructor_id uuid references public.employees (id) on delete set null,
  starts_at     timestamptz not null,
  duration_min  int not null default 60 check (duration_min > 0),
  capacity      int not null default 20 check (capacity > 0),
  room          text not null default '',
  status        text not null default 'Programada'
                  check (status in ('Programada', 'En curso', 'Dictada', 'Cancelada')),
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index fitness_classes_org_when_idx
  on public.fitness_classes (org_id, starts_at desc) where deleted_at is null;

select app.apply_standard_rls('fitness_classes', 'socios:read', 'socios:write');

comment on table public.fitness_classes is
  'Clases programadas, con cupo y profesor.';

-- ─── Quién reservó ──────────────────────────────────────────────────────────

create table public.fitness_bookings (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.fitness_classes (id) on delete cascade,
  member_id  uuid not null references public.fitness_members (id) on delete cascade,
  status     text not null default 'Reservada'
               check (status in ('Reservada', 'En espera', 'Asistió', 'No asistió', 'Cancelada')),
  created_at timestamptz not null default now(),
  -- Reservar dos veces la misma clase es un doble clic, no una intención.
  unique (class_id, member_id)
);

create index fitness_bookings_member_idx on public.fitness_bookings (member_id, created_at desc);

select app.apply_child_rls('fitness_bookings', 'fitness_classes', 'class_id',
                           'socios:read', 'socios:write');

comment on table public.fitness_bookings is
  'Reservas de socios en clases. «En espera» es la lista cuando el cupo se llenó.';

-- ─── Quién entró ────────────────────────────────────────────────────────────

create table public.fitness_checkins (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.fitness_members (id) on delete cascade,
  -- La clase a la que vino, cuando vino a una. Nulo en un gimnasio de sala.
  class_id    uuid references public.fitness_classes (id) on delete set null,
  entered_at  timestamptz not null default now(),
  method      text not null default 'Manual'
                check (method in ('Manual', 'Documento', 'Código', 'Huella')),
  created_at  timestamptz not null default now()
);

create index fitness_checkins_member_idx on public.fitness_checkins (member_id, entered_at desc);

select app.apply_child_rls('fitness_checkins', 'fitness_members', 'member_id',
                           'socios:read', 'socios:write');

comment on table public.fitness_checkins is
  'Entradas al centro. Aparte de las reservas: reservar y venir no son lo mismo, '
  'y la diferencia entre los dos números es lo que un estudio quiere medir.';

-- ─── updated_at ─────────────────────────────────────────────────────────────

create trigger fitness_members_touch
  before update on public.fitness_members
  for each row execute function app.touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- El vocabulario: `socios` pasa a ser un módulo real
--
-- Generado con `npm run db:module-sql -- --module socios`, que lo deriva de
-- src/lib/modules/registry.ts. registry.test.ts fija ambos lados.
-- ═══════════════════════════════════════════════════════════════════════════

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
      'facturacion', 'compras', 'catalogos', 'tienda',
      'ecommerce', 'canales', 'tickets', 'firmas',
      'documentos', 'contratos', 'calendario', 'consultoria',
      'ia', 'pacientes', 'estudiantes', 'restaurante',
      'agro', 'inmobiliario', 'hoteleria', 'socios'
    )
  );
$$;

revoke all on function app.valid_module_keys(text[]) from public, anon;
grant execute on function app.valid_module_keys(text[]) to authenticated;

insert into public.permissions (key, module, action, label) values
  ('socios:read',  'socios', 'read',  'Ver socios'),
  ('socios:write', 'socios', 'write', 'Gestionar socios')
on conflict (key) do update set label = excluded.label;

/**
 * Las empresas que ya existen reciben el permiso.
 *
 * Sin esto, un gimnasio que encienda el módulo mañana no lo ve nadie —- ni
 * quien lo encendió—, porque `role_permissions` solo se siembra al crear la
 * empresa y ese barco ya zarpó para todas las actuales.
 *
 * Se concede a quien ya administra, no al rol llamado «Administrador». Desde la
 * migración 24 los roles son por empresa y renombrables: una clínica puede
 * llamarlo «Dirección» y un gimnasio «Dueño». Buscar el nombre encontraría a
 * unos y dejaría a otros sin acceso a un módulo que su propio plan incluye.
 * `configuracion:manage` es la definición operativa de «administra esto».
 */
insert into public.role_permissions (org_id, role, permission)
select rp.org_id, rp.role, p.key
from public.role_permissions rp
cross join (values ('socios:read'), ('socios:write')) as p(key)
where rp.permission = 'configuracion:manage'
on conflict do nothing;

/**
 * Y las empresas que se creen desde ahora.
 *
 * `app.seed_default_permissions` da a quien administra *todos* los permisos con
 * un `select key from public.permissions`, así que ese lado ya funciona solo.
 * Lo que hay que tocar es la lista literal de «Líder de equipo»: cada vertical
 * está ahí con su `:read` —- `restaurante` incluso con `:write`—, y omitir
 * `socios` dejaría al encargado de un gimnasio sin poder abrir la única
 * pantalla que usa.
 *
 * Se redefine entera porque una función no tiene ALTER para su cuerpo. El único
 * cambio son las dos claves nuevas en el bloque de «Líder de equipo».
 */
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
      'inmobiliario:read', 'hoteleria:read',
      'socios:read', 'socios:write'
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

-- Y al «Líder de equipo» que ya existe, la misma concesión que arriba.
insert into public.role_permissions (org_id, role, permission)
select rp.org_id, rp.role, p.key
from public.role_permissions rp
cross join (values ('socios:read'), ('socios:write')) as p(key)
where rp.permission = 'restaurante:write'
on conflict do nothing;

-- ─── Dependencias ───────────────────────────────────────────────────────────
-- Espejo de MODULE_DEPENDENCIES en src/lib/modules/registry.ts.

insert into public.module_dependencies (module_key, requires_key, kind) values
  ('socios', 'calendario',  'soft'),
  ('socios', 'facturacion', 'soft')
on conflict do nothing;

-- ─── El preset del sector ───────────────────────────────────────────────────
-- `fitness-bienestar` ya proponía once módulos (migración 34). Gana los dos que
-- lo hacen utilizable: el vertical y la facturación con la que se cobra una
-- membresía. Los cuatro subsectores no cambian: sus deltas están bien y ahora
-- se aplican sobre un padre que sí describe el negocio.

-- Escrito con la misma forma `select ... from unnest(array[...])` que usa la
-- migración 34, no con un `values`: sectors.test.ts lee el seed con ese patrón
-- para fijarlo contra COMPANY_TYPES, y una fila en otra forma es una fila que
-- el test no ve —- que es exactamente la deriva que el test existe para atrapar.
insert into public.sector_modules (sector_key, module_key, mode)
  select 'fitness-bienestar', k, 'add' from unnest(array['socios', 'facturacion']) as k
on conflict do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   delete from public.sector_modules where module_key = 'socios';
--   delete from public.module_dependencies where module = 'socios';
--   delete from public.role_permissions where permission like 'socios:%';
--   delete from public.permissions where module = 'socios';
--   drop table if exists public.fitness_checkins, public.fitness_bookings,
--                        public.fitness_subscriptions, public.fitness_classes,
--                        public.fitness_plans, public.fitness_members cascade;
--   -- y volver a crear app.valid_module_keys() sin 'socios'
-- ═══════════════════════════════════════════════════════════════════════════
