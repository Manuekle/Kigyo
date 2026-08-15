-- ═══════════════════════════════════════════════════════════════════════════
-- 78 — Tickets de cliente (plan CRM/ERP/POS 1.3, paso 1)
--
-- Los tickets eran help desk interno: áreas de la propia empresa. Un ticket
-- puede ahora referenciar un cliente y decir su origen — Interno o Cliente —
-- y así aparece en la ficha del cliente. Es el paso barato; el portal
-- público con token mágico queda como decisión separada.
--
-- `client_id` es nullable: la inmensa mayoría de los tickets sigue siendo
-- interna, y no se le inventa un cliente a ninguno.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.tickets
  add column client_id uuid references public.clients (id) on delete set null;

alter table public.tickets
  add column origin text not null default 'Interno'
    check (origin in ('Interno', 'Cliente'));

create index tickets_client_idx on public.tickets (client_id) where deleted_at is null;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop index if exists public.tickets_client_idx;
--   alter table public.tickets drop column if exists origin;
--   alter table public.tickets drop column if exists client_id;
-- ═══════════════════════════════════════════════════════════════════════════
