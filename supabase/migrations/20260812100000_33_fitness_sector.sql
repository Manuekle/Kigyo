-- ═══════════════════════════════════════════════════════════════════════════
-- 33 — Fitness y bienestar (decision M9)
--
-- The plan asked for the sector and it did not exist; gyms, studios and spas
-- fell into «Otro». Started as a sector with a preset of existing modules
-- (people, clients, inventory, calendar, contracts for memberships) and no
-- vertical module of its own — a `membresias` module is a bet that the demand
-- is there, and the M9 decision is to wait for it instead of shipping a
-- half-empty screen.
--
-- Sectors are data since migration 29, so this is an INSERT, not a migration
-- of the schema. The matching preset lives in COMPANY_TYPES in
-- src/lib/modules.ts, and modules.test.ts pins the two lists together.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.sectors (key, label, sort) values
  ('fitness-bienestar', 'Fitness y bienestar', 215);

insert into public.sectors (key, label, parent_key, sort) values
  ('fitness-gimnasio',    'Gimnasio',           'fitness-bienestar', 10),
  ('fitness-estudio',     'Estudio y clases',   'fitness-bienestar', 20),
  ('fitness-spa',         'Spa y bienestar',    'fitness-bienestar', 30),
  ('fitness-centro',      'Centro de bienestar','fitness-bienestar', 40);

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   delete from public.sectors where key like 'fitness-%';
-- ═══════════════════════════════════════════════════════════════════════════
