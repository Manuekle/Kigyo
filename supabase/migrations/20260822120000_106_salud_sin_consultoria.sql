-- ═══════════════════════════════════════════════════════════════════════════
-- 106 — `consultoria` fuera del preset de salud (reparación)
--
-- El módulo Consultoría no describe el trabajo de ninguna rama de salud: una
-- clínica no factura horas de consultoría. Estaba en la propuesta desde la
-- migración 34 por arrastre, y cinco subsectores lo venían quitando uno a uno
-- — la prueba de que nunca debió estar en la base.
--
-- La migración 34 se reescribió para las instalaciones nuevas; esta reparación
-- lleva el mismo cambio a las bases que ya la habían aplicado. Va como DELETE
-- plano a propósito: el test de paridad (lib/sectors.test.ts) lee los
-- `select … unnest(array[…])` del historial como la semilla vigente, y una
-- inserción aquí la contradiría.
--
-- Alcance: solo la *propuesta* del sector. Las empresas existentes conservan
-- su `enabled_modules` tal cual lo eligieron; quitarles un toggle encendido
-- sería pisar la decisión del cliente. Quien quiera el módulo lo apaga en
-- Configuración → Módulos, o lo deja: sigue siendo un módulo real del plan.
-- ═══════════════════════════════════════════════════════════════════════════

delete from public.sector_modules
where sector_key = 'salud'
  and module_key = 'consultoria'
  and mode = 'add';

delete from public.sector_modules
where sector_key = 'salud-laboratorio'
  and module_key = 'consultoria'
  and mode = 'remove';

delete from public.sector_modules
where sector_key = 'salud-veterinaria'
  and module_key = 'consultoria'
  and mode = 'remove';

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   insert into public.sector_modules (sector_key, module_key, mode) values
--     ('salud', 'consultoria', 'add'),
--     ('salud-laboratorio', 'consultoria', 'remove'),
--     ('salud-veterinaria', 'consultoria', 'remove');
-- ═══════════════════════════════════════════════════════════════════════════
