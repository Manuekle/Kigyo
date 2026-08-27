-- ═══════════════════════════════════════════════════════════════════════════
-- 110 — Ocho subsectores proponían menos de lo que sus propios roles abren.
--
-- Dos catálogos describen el mismo negocio y nadie los había comparado:
-- `public.sector_modules` dice qué módulos propone un subsector, y
-- `public.sector_roles` (migraciones 46, 61 y 72) dice qué abre cada uno de sus
-- roles. Un guardia nuevo en `src/lib/sectors.test.ts` los cruza y encontró
-- ocho pares donde el rol nombra un módulo que el preset deja apagado.
--
-- Hasta ahora daba igual porque los roles sugeridos solo se sembraban desde un
-- botón escondido en Configuración. Desde esta jornada el wizard los siembra al
-- guardar el sector, así que el desajuste se vuelve visible el primer día: se
-- invita a alguien como «Mostrador y caja», abre el menú, y la pantalla que su
-- rol dice abrir no está — y la culpa la carga el rol, que sí tenía el permiso.
--
-- Se corrige por el lado del preset y no por el del rol, en los ocho, porque en
-- los ocho el rol describe un trabajo real y el preset es el que se olvidó:
--
--   alimentos-rapida        clientes                     un domicilio va a una persona con dirección
--   alimentos-panaderia     clientes                     vende a habituales y por encargo
--   ecommerce-dropshipping  notificaciones               le avisa al comprador que despachó
--   ecommerce-suscripcion   notificaciones               una renovación sin aviso es un contracargo
--   financiero-fintech      proyectos                    su rol «Ingeniero/a» construye producto
--   mineria-agregados       clientes, cotizaciones, facturacion   es el único con rol «Comercial»
--   telecomunicaciones-instalador  riesgos, hseq         su «Supervisor/a» sube a torres
--   gobierno-contratista    inventario                   ejecuta obra, y la obra lleva materiales
--
-- Solo `add`. Ninguno quita nada, ninguno toca permisos, y un preset sigue
-- siendo un punto de partida: cada módulo queda conmutable como antes. Las
-- empresas que ya existen no cambian — `sector_modules` solo se lee al proponer.
--
-- Espejo exacto de `SUBSECTOR_PRESETS` en `src/lib/modules.ts`, fijado en las
-- dos direcciones por «every subsector delta is the same on both sides».
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.sector_modules (sector_key, module_key, mode)
  select 'alimentos-rapida', k, 'add' from unnest(array['clientes']) as k
on conflict do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'alimentos-panaderia', k, 'add' from unnest(array['clientes']) as k
on conflict do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'ecommerce-dropshipping', k, 'add' from unnest(array['notificaciones']) as k
on conflict do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'ecommerce-suscripcion', k, 'add' from unnest(array['notificaciones']) as k
on conflict do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'financiero-fintech', k, 'add' from unnest(array['proyectos']) as k
on conflict do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'mineria-agregados', k, 'add' from unnest(array['clientes', 'cotizaciones', 'facturacion']) as k
on conflict do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'telecomunicaciones-instalador', k, 'add' from unnest(array['riesgos', 'hseq']) as k
on conflict do nothing;

insert into public.sector_modules (sector_key, module_key, mode)
  select 'gobierno-contratista', k, 'add' from unnest(array['inventario']) as k
on conflict do nothing;

-- Rollback:
--   delete from public.sector_modules where mode = 'add' and (sector_key, module_key) in (
--     ('alimentos-rapida','clientes'), ('alimentos-panaderia','clientes'),
--     ('ecommerce-dropshipping','notificaciones'), ('ecommerce-suscripcion','notificaciones'),
--     ('financiero-fintech','proyectos'),
--     ('mineria-agregados','clientes'), ('mineria-agregados','cotizaciones'),
--     ('mineria-agregados','facturacion'),
--     ('telecomunicaciones-instalador','riesgos'), ('telecomunicaciones-instalador','hseq'),
--     ('gobierno-contratista','inventario'));
