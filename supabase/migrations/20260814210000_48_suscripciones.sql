-- ═══════════════════════════════════════════════════════════════════════════
-- 48 — Suscripciones: cobro recurrente por plan y por cliente
--
-- Lo que un gimnasio cobra cada mes, un colegio cada periodo y un SaaS cada
-- año. Un plan es la tarifa (nombre, precio, ciclo); una suscripción es un
-- cliente dentro de un plan con su propia fecha de renovación y precio
-- cuando negocia uno distinto.
--
-- No factura por sí mismo: es la lista de quién debe qué, y de dónde sale el
-- siguiente cargo. La factura se emite desde facturacion.
--
-- `client_id` es opcional y `on delete set null`: borrar un cliente no borra
-- la historia de lo que pagó. `plan_id` idem: el plan puede desaparecer y las
-- suscripciones sobreviven con el precio que ya tenían congelado.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.subscription_plans (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null check (length(btrim(name)) between 2 and 80),
  price_cents int  not null check (price_cents >= 0),
  -- 'diario' | 'semanal' | 'mensual' | 'trimestral' | 'semestral' | 'anual'
  cycle       text not null default 'mensual'
              check (cycle in ('diario', 'semanal', 'mensual', 'trimestral', 'semestral', 'anual')),
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger subscription_plans_touch before update on public.subscription_plans
  for each row execute function app.touch_updated_at();

comment on table public.subscription_plans is
  'Tarifas de cobro recurrente: nombre, precio y ciclo. El módulo suscripciones.';

create table public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  plan_id         uuid references public.subscription_plans (id) on delete set null,
  client_id       uuid references public.clients (id) on delete set null,
  status          text not null default 'activa'
                  check (status in ('activa', 'suspendida', 'cancelada', 'vencida')),
  started_on      date not null default current_date,
  next_charge_on  date,
  price_cents     int check (price_cents is null or price_cents >= 0),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index subscriptions_org_status_idx on public.subscriptions (org_id, status);
create index subscriptions_next_charge_idx on public.subscriptions (org_id, next_charge_on);

create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function app.touch_updated_at();

comment on table public.subscriptions is
  'Un cliente dentro de un plan, con su renovación y su precio.';

select app.apply_standard_rls('subscription_plans', 'suscripciones:read', 'suscripciones:write');
select app.apply_standard_rls('subscriptions', 'suscripciones:read', 'suscripciones:write');

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
      'hoteleria', 'socios', 'tiempos', 'suscripciones'
    )
  );
$$;

revoke all on function app.valid_module_keys(text[]) from public, anon;
grant execute on function app.valid_module_keys(text[]) to authenticated;

-- Catálogo de permisos. Derivado de REGISTRY; permissions.test.ts lo fija.
insert into public.permissions (key, module, action, label) values
  ('suscripciones:read',  'suscripciones', 'read',  'Ver suscripciones'),
  ('suscripciones:write', 'suscripciones', 'write', 'Gestionar suscripciones')
on conflict (key) do update set label = excluded.label;

-- Dependencias blandas: los planes se venden a clientes.
insert into public.module_dependencies (module_key, requires_key, kind) values
  ('suscripciones', 'clientes', 'soft')
on conflict (module_key, requires_key) do nothing;

-- ─── Quien administra gana los permisos nuevos ─────────────────────────────

insert into public.role_permissions (org_id, role, permission)
select rp.org_id, rp.role, p.key
from public.role_permissions rp
cross join (values ('suscripciones:read'), ('suscripciones:write')) as p(key)
where rp.permission = 'configuracion:manage'
on conflict do nothing;

-- ─── Los sectores que cobran por recurrencia ────────────────────────────────

insert into public.sector_modules (sector_key, module_key, mode)
  select 'fitness-bienestar', k, 'add' from unnest(array['suscripciones']) as k
  union all
  select 'educacion', k, 'add' from unnest(array['suscripciones']) as k
  union all
  select 'tecnologia', k, 'add' from unnest(array['suscripciones']) as k
  union all
  select 'inmobiliario', k, 'add' from unnest(array['suscripciones']) as k
on conflict (sector_key, module_key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   delete from public.sector_modules where module_key = 'suscripciones';
--   delete from public.module_dependencies where module_key = 'suscripciones';
--   delete from public.role_permissions where permission like 'suscripciones:%';
--   delete from public.permissions where module = 'suscripciones';
--   drop table if exists public.subscriptions;
--   drop table if exists public.subscription_plans;
--   -- y volver a crear app.valid_module_keys() sin 'suscripciones'
-- ═══════════════════════════════════════════════════════════════════════════
