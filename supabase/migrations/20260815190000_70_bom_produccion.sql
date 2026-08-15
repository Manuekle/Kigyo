-- ═══════════════════════════════════════════════════════════════════════════
-- 70 — BOM: lista de materiales del producto fabricado
--
-- La orden de producción dice cuánto se va a fabricar y por qué etapas pasa,
-- pero no de qué está hecho el producto. La lista de materiales (BOM) es la
-- receta: un producto terminado y sus componentes del catálogo, con cantidad
-- por unidad producida.
--
-- Una BOM por producto (`unique (org_id, product_id)`), con sus componentes
-- como hijos. El costo de la BOM es la suma de los precios de catálogo por
-- cantidad — derivado, no guardado: subir el precio de un componente mañana
-- no debe dejar un costo viejo escrito en la receta. Ese costo se sugiere al
-- crear una orden de producción para el producto, igual que la temporada
-- sugiere la tarifa en hotelería.
--
-- Profundidad de `produccion` (patrón 45): permisos
-- `produccion:read` / `produccion:write`, sin módulo nuevo.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.production_boms (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  version    text not null default '1' check (length(btrim(version)) between 1 and 20),
  notes      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, product_id)
);

create index production_boms_org_idx on public.production_boms (org_id);

create trigger production_boms_touch before update on public.production_boms
  for each row execute function app.touch_updated_at();

select app.apply_standard_rls('production_boms', 'produccion:read', 'produccion:write');

comment on table public.production_boms is
  'Lista de materiales de un producto fabricado. Una receta por producto.';

create table public.production_bom_items (
  id           uuid primary key default gen_random_uuid(),
  bom_id       uuid not null references public.production_boms (id) on delete cascade,
  component_id uuid not null references public.products (id) on delete cascade,
  quantity     numeric(12,2) not null check (quantity > 0),
  unit         text not null default 'UN' check (length(btrim(unit)) between 1 and 10),
  position     smallint not null default 0,
  notes        text not null default '',
  created_at   timestamptz not null default now()
);

create index production_bom_items_bom_idx
  on public.production_bom_items (bom_id, position);

select app.apply_child_rls('production_bom_items', 'production_boms', 'bom_id',
                           'produccion:read', 'produccion:write');

comment on table public.production_bom_items is
  'Componentes de una BOM, con cantidad por unidad producida.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop table if exists public.production_bom_items cascade;
--   drop table if exists public.production_boms cascade;
-- ═══════════════════════════════════════════════════════════════════════════
