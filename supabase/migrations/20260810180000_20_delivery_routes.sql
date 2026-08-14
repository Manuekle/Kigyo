-- ═══════════════════════════════════════════════════════════════════════════
-- 20 — Delivery routes (rutas) for the logística sector
--
-- The flota module answers «what do we move with» (vehicles, services, fuel)
-- but not «what are we moving». `delivery_routes` is the plan each day: an
-- origin, a destination, the vehicle and driver that will cover it, and a
-- status that a dispatcher advances as the route happens.
--
-- A route is not a child row of a vehicle: it can be planned before a vehicle
-- is assigned and re-assigned when one breaks down. So it is a top-level
-- entity of the flota module, with its own `org_id` and standard RLS under
-- the module's existing permission pair — no new permissions, no new module.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.delivery_routes (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  origin         text not null default '',
  destination    text not null,
  vehicle_id     uuid references public.vehicles (id) on delete set null,
  driver_id      uuid references public.employees (id) on delete set null,
  distance_km    numeric(9,2) check (distance_km is null or distance_km >= 0),
  scheduled_on   date not null default current_date,
  status         text not null default 'Planificada'
                   check (status in ('Planificada', 'En curso', 'Completada', 'Cancelada')),
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index delivery_routes_scheduled_idx
  on public.delivery_routes (org_id, scheduled_on desc, status);

create trigger delivery_routes_touch before update on public.delivery_routes
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('delivery_routes', 'flota:read', 'flota:write');