-- ═══════════════════════════════════════════════════════════════════════════
-- 69 — Agro: sanidad del cultivo y riego del lote
--
-- El agro tiene lotes, ciclos, cosechas, insumos y maquinaria, y le faltaban
-- las dos labores que más registran las fincas: qué se le aplicó al cultivo
-- y cuánta agua recibió el lote.
--
-- `crop_treatments` es el cuaderno de sanidad: aplicación por aplicación,
-- con producto, dosis y periodo de carencia — la cifra que decide cuándo se
-- puede cosechar sin que el producto llegue al consumidor. `irrigation_events`
-- es el registro de riego del lote: método, duración y volumen. Ambas son
-- profundidad de `agro` (patrón 45): permisos `agro:read` / `agro:write`,
-- sin módulo nuevo, y ambas heredan su frontera del padre que ya la tiene.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.crop_treatments (
  id                 uuid primary key default gen_random_uuid(),
  cycle_id           uuid not null references public.crop_cycles (id) on delete cascade,
  kind               text not null default 'Fertilización'
                     check (kind in ('Fertilización', 'Herbicida', 'Fungicida', 'Insecticida', 'Foliar', 'Otro')),
  product            text not null check (length(btrim(product)) between 1 and 160),
  active_ingredient  text not null default '',
  dose               text not null default '',
  applied_on         date not null default current_date,
  responsible_id     uuid references public.employees (id) on delete set null,
  -- Periodo de carencia en días: cuánto falta para que el cultivo sea apto
  -- para cosecha. Null = sin restricción.
  withholding_days   int check (withholding_days is null or withholding_days >= 0),
  notes              text not null default '',
  created_at         timestamptz not null default now()
);

create index crop_treatments_cycle_idx
  on public.crop_treatments (cycle_id, applied_on desc);

select app.apply_child_rls('crop_treatments', 'crop_cycles', 'cycle_id',
                           'agro:read', 'agro:write');

comment on table public.crop_treatments is
  'Aplicaciones fitosanitarias de un ciclo: producto, dosis y periodo de carencia.';

create table public.irrigation_events (
  id            uuid primary key default gen_random_uuid(),
  lot_id        uuid not null references public.farm_lots (id) on delete cascade,
  method        text not null default 'Goteo'
                check (method in ('Goteo', 'Aspersión', 'Gravedad', 'Pivote', 'Manual', 'Otro')),
  duration_min  int not null default 0 check (duration_min >= 0),
  water_m3      numeric(8,2) not null default 0 check (water_m3 >= 0),
  started_on    date not null default current_date,
  notes         text not null default '',
  created_at    timestamptz not null default now()
);

create index irrigation_events_lot_idx
  on public.irrigation_events (lot_id, started_on desc);

select app.apply_child_rls('irrigation_events', 'farm_lots', 'lot_id',
                           'agro:read', 'agro:write');

comment on table public.irrigation_events is
  'Registro de riego por lote: método, duración y volumen de agua.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop table if exists public.irrigation_events cascade;
--   drop table if exists public.crop_treatments cascade;
-- ═══════════════════════════════════════════════════════════════════════════
