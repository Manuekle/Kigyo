-- ═══════════════════════════════════════════════════════════════════════════
-- 74 — Preferencias del recibo POS en la organización (plan CRM/ERP/POS 3.2)
--
-- Un jsonb y no una tabla: son tres valores que se leen junto al nombre de
-- la empresa cada vez que se imprime un recibo, y una tabla de ajustes por
-- empresa para tres campos es el tipo de generalidad que después nadie
-- migra. La mutación valida la forma; la columna guarda el estado.
--
-- Ancho en milímetros (80 = térmica estándar, 58 = portátil), texto del pie
-- y si el recibo muestra el encabezado con el nombre de la empresa.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.organizations
  add column receipt_prefs jsonb not null default
    '{"width": 80, "footer": "Gracias por su compra", "showLogo": true}'::jsonb;

comment on column public.organizations.receipt_prefs is
  'Preferencias del recibo de mostrador: ancho (80|58 mm), texto del pie, encabezado con nombre.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   alter table public.organizations drop column if exists receipt_prefs;
-- ═══════════════════════════════════════════════════════════════════════════
