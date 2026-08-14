-- ═══════════════════════════════════════════════════════════════════════════
-- 22 — Farm inputs and machinery (insumos y maquinaria) for agro
--
-- The agro module tracks what is planted (lots, cycles) and what came out
-- (harvests), but a farm also runs on what goes in — seed, fertilizer,
-- agrochemicals — and on the machines that do the work. `farm_inputs` is the
-- stock ledger of consumables (what, how much, at what unit cost, from whom),
-- and `farm_machinery` the fleet register a mechanic can keep current without
-- leaving the module.
--
-- Standard RLS under the module's existing permission pair, own `org_id` on
-- both — top-level entities of the agro module, not children of a lot, since
-- inputs are bought before a cycle exists and machinery outlives every cycle.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.farm_inputs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  name          text not null,
  kind          text not null default 'Otro'
                  check (kind in ('Semilla', 'Fertilizante', 'Agroquímico',
                                  'Biocontrol', 'Otro')),
  stock_qty     numeric(12,2) not null default 0 check (stock_qty >= 0),
  unit          text not null default 'kg',
  supplier      text not null default '',
  unit_cost_cents bigint not null default 0 check (unit_cost_cents >= 0),
  created_at    timestamptz not null default now()
);

create index farm_inputs_kind_idx on public.farm_inputs (org_id, kind);

select app.apply_standard_rls('farm_inputs', 'agro:read', 'agro:write');

create table public.farm_machinery (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null,
  kind        text not null default 'Otro'
                check (kind in ('Tractor', 'Implemento', 'Cosechadora', 'Riego', 'Otro')),
  serial_no   text not null default '',
  status      text not null default 'Operativa'
                check (status in ('Operativa', 'En mantenimiento', 'Fuera de servicio')),
  hours_used  numeric(10,1) not null default 0 check (hours_used >= 0),
  notes       text not null default '',
  created_at  timestamptz not null default now()
);

create index farm_machinery_status_idx on public.farm_machinery (org_id, status);

select app.apply_standard_rls('farm_machinery', 'agro:read', 'agro:write');