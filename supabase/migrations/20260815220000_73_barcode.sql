-- ═══════════════════════════════════════════════════════════════════════════
-- 73 — Código de barras en el catálogo (plan CRM/ERP/POS 3.1)
--
-- Un producto vendible en mostrador necesita poder escanearse. El código
-- vive en `products` porque es un atributo del producto, no del POS: el
-- catálogo lo captura una vez y el mostrador solo lo busca.
--
-- Sin validación dura de formato: los códigos internos son alfanuméricos
-- (y a menudo más largos que un EAN), y castigarlos no suma. Vacío es
-- legítimo — no todo producto se imprime.
--
-- El índice parcial de unicidad es el que sirve al escáner: un código
-- apunta a exactamente un producto dentro de la empresa, o a ninguno.
-- Postgres trata los NULL como distintos entre sí, pero con `not null
-- default ''` el contrato es más simple: la cadena vacía es «sin código»
-- y queda fuera del índice parcial.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.products
  add column barcode text not null default '';

create unique index products_barcode_org_unique
  on public.products (org_id, barcode)
  where barcode <> '';

create index products_barcode_idx
  on public.products (org_id, barcode);

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop index if exists public.products_barcode_idx;
--   drop index if exists public.products_barcode_org_unique;
--   alter table public.products drop column if exists barcode;
-- ═══════════════════════════════════════════════════════════════════════════
