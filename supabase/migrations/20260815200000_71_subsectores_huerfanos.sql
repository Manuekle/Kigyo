-- ═══════════════════════════════════════════════════════════════════════════
-- 71 — Subsectores para los sectores que no tenían
--
-- Diez sectores proponían el mismo preset a toda su industria: «Energía» a un
-- instalador de paneles y a un parque eólico, «Financiero» a una cooperativa y
-- a una cobranza, «Gobierno» a la entidad que licita y al contratista que
-- ejecuta. El catálogo los soportaba como datos desde la migración 29; faltaba
-- la decisión de producto, que es lo que llega aquí.
--
-- Treinta y tres subsectores, con dos reglas heredadas de las migraciones
-- 29/34:
--
--   1. El delta es pequeño y explicable: qué tiene este negocio que el resto
--      de su industria no, y qué no tiene. Ninguno reescribe a su padre.
--   2. Ningún delta es vacío. Un subsector que propone exactamente lo de su
--      padre es una pregunta que cuesta una decisión y no devuelve nada — el
--      test `actually differs from its parent` lo exige, y con razón.
--
-- `otro` se queda sin hijos a propósito: es el caso «sin opinión».
--
-- Los presets de sector no cambian: esto es solo vocabulario (public.sectors)
-- y deltas (public.sector_modules). El espejo TypeScript vive en
-- SUBSECTOR_PRESETS (src/lib/modules.ts), y sectors.test.ts pin ambas copias.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.sectors (key, label, parent_key, sort) values
  ('energia-solar',           'Solar fotovoltaica',          'energia',           10),
  ('energia-eolica',          'Eólica',                      'energia',           20),
  ('energia-eficiencia',      'Eficiencia energética',       'energia',           30),
  ('energia-om',              'Operación y mantenimiento',   'energia',           40),

  ('ecommerce-marketplace',   'Marketplace',                 'ecommerce',         10),
  ('ecommerce-tienda',        'Tienda propia',               'ecommerce',         20),
  ('ecommerce-dropshipping',  'Dropshipping',                'ecommerce',         30),
  ('ecommerce-suscripcion',   'Suscripción y cajas',         'ecommerce',         40),

  ('tecnologia-saas',         'Producto SaaS',               'tecnologia',        10),
  ('tecnologia-medida',       'Software a la medida',        'tecnologia',        20),
  ('tecnologia-integrador',   'Integrador de sistemas',      'tecnologia',        30),

  ('financiero-cooperativa',  'Cooperativa de ahorro',       'financiero',        10),
  ('financiero-seguros',      'Corredora de seguros',        'financiero',        20),
  ('financiero-fintech',      'Fintech',                     'financiero',        30),
  ('financiero-cobranza',     'Cobranza',                    'financiero',        40),

  ('mineria-abierto',         'Minería a cielo abierto',     'mineria',           10),
  ('mineria-subterranea',     'Minería subterránea',         'mineria',           20),
  ('mineria-agregados',       'Agregados y materiales',      'mineria',           30),

  ('telecomunicaciones-isp',         'ISP',                  'telecomunicaciones', 10),
  ('telecomunicaciones-instalador',  'Instalación de redes', 'telecomunicaciones', 20),
  ('telecomunicaciones-integrador',  'Integrador de redes',  'telecomunicaciones', 30),

  ('seguridad-vigilancia',    'Vigilancia física',           'seguridad',         10),
  ('seguridad-monitoreo',     'Monitoreo y alarmas',         'seguridad',         20),
  ('seguridad-escoltas',      'Escoltas',                    'seguridad',         30),

  ('medios-agencia',          'Agencia creativa',            'medios',            10),
  ('medios-productora',       'Productora',                  'medios',            20),
  ('medios-medio',            'Medio de comunicación',       'medios',            30),

  ('ong-fundacion',           'Fundación',                   'ong',               10),
  ('ong-cooperacion',         'Cooperación internacional',   'ong',               20),
  ('ong-voluntariado',        'Voluntariado',                'ong',               30),

  ('gobierno-entidad',        'Entidad pública',             'gobierno',          10),
  ('gobierno-contratista',    'Contratista del Estado',      'gobierno',          20),
  ('gobierno-servicios',      'Servicios públicos',          'gobierno',          30);

-- ─── Lo que cada subsector cambia ───────────────────────────────────────────
--
-- Formato obligatorio `select '<key>', k, '<mode>' from unnest(array[...]) as k`:
-- sectors.test.ts lee el seed con ese regex y ningún otro.

insert into public.sector_modules (sector_key, module_key, mode)
  -- Energía. El instalador cotiza, no vende catálogo; el parque eólico tampoco.
  -- O&M opera plantas ajenas con contratos de disponibilidad: no construye,
  -- cobra servicios.
  select 'energia-solar', k, 'remove' from unnest(array['catalogos']) as k
  union all
  select 'energia-eolica', k, 'remove' from unnest(array['catalogos']) as k
  union all
  select 'energia-eficiencia', k, 'add' from unnest(array['trazabilidad']) as k
  union all
  select 'energia-om', k, 'add' from unnest(array['cartera']) as k
  union all
  select 'energia-om', k, 'remove' from unnest(array['proyectos', 'obra']) as k
  union all
  -- Ecommerce. Un vendedor de marketplace no opera tienda propia (y ecommerce
  -- depende de tienda, así que se van juntos); dropshipping nunca ve el
  -- producto; la caja de suscripción vive de la recurrencia.
  select 'ecommerce-marketplace', k, 'add' from unnest(array['notificaciones']) as k
  union all
  select 'ecommerce-marketplace', k, 'remove' from unnest(array['tienda', 'ecommerce']) as k
  union all
  select 'ecommerce-tienda', k, 'add' from unnest(array['notificaciones']) as k
  union all
  select 'ecommerce-dropshipping', k, 'remove' from unnest(array['inventario']) as k
  union all
  select 'ecommerce-suscripcion', k, 'add' from unnest(array['suscripciones']) as k
  union all
  -- Tecnología. SaaS no factura horas; la fábrica de software no vende
  -- recurrencia; el integrador además revende hardware.
  select 'tecnologia-saas', k, 'remove' from unnest(array['tiempos']) as k
  union all
  select 'tecnologia-medida', k, 'remove' from unnest(array['suscripciones']) as k
  union all
  select 'tecnologia-integrador', k, 'add' from unnest(array['inventario']) as k
  union all
  select 'tecnologia-integrador', k, 'remove' from unnest(array['suscripciones']) as k
  union all
  -- Financiero. La cooperativa tiene ventanilla; la corredora y la cobranza no
  -- colocan crédito; la fintech no consulta.
  select 'financiero-cooperativa', k, 'add' from unnest(array['caja']) as k
  union all
  select 'financiero-seguros', k, 'remove' from unnest(array['creditos']) as k
  union all
  select 'financiero-fintech', k, 'remove' from unnest(array['consultoria']) as k
  union all
  select 'financiero-cobranza', k, 'remove' from unnest(array['creditos']) as k
  union all
  -- Minería. Producir mineral es su producción; el frente de agregados tritura
  -- y vende, no ejecuta proyectos ni obra. Subterránea entrena sin parar.
  select 'mineria-abierto', k, 'add' from unnest(array['produccion']) as k
  union all
  select 'mineria-subterranea', k, 'add' from unnest(array['produccion', 'capacitacion']) as k
  union all
  select 'mineria-agregados', k, 'add' from unnest(array['produccion']) as k
  union all
  select 'mineria-agregados', k, 'remove' from unnest(array['proyectos', 'obra']) as k
  union all
  -- Telecomunicaciones. El ISP cobra abonos en ventanilla; el instalador y el
  -- integrador trabajan redes ajenas, sin abonados propios.
  select 'telecomunicaciones-isp', k, 'add' from unnest(array['caja']) as k
  union all
  select 'telecomunicaciones-instalador', k, 'remove' from unnest(array['suscriptores']) as k
  union all
  select 'telecomunicaciones-integrador', k, 'remove' from unnest(array['suscriptores']) as k
  union all
  -- Seguridad. La vigilancia vive de factura mensual por contrato; el
  -- monitoreo vende equipos y no tiene guardas en puesto; los escoltas se
  -- mueven y no fijan puesto ni bodega.
  select 'seguridad-vigilancia', k, 'add' from unnest(array['cartera']) as k
  union all
  select 'seguridad-monitoreo', k, 'add' from unnest(array['catalogos']) as k
  union all
  select 'seguridad-monitoreo', k, 'remove' from unnest(array['puestos']) as k
  union all
  select 'seguridad-escoltas', k, 'add' from unnest(array['flota']) as k
  union all
  select 'seguridad-escoltas', k, 'remove' from unnest(array['puestos', 'inventario']) as k
  union all
  -- Medios. La agencia pura no tiene bodega de equipos; la productora mantiene
  -- los suyos; el medio vende pauta y suscripciones, no campañas por proyecto.
  select 'medios-agencia', k, 'remove' from unnest(array['inventario']) as k
  union all
  select 'medios-productora', k, 'add' from unnest(array['mantenimiento']) as k
  union all
  select 'medios-medio', k, 'add' from unnest(array['suscripciones']) as k
  union all
  select 'medios-medio', k, 'remove' from unnest(array['proyectos', 'tiempos']) as k
  union all
  -- ONG. La fundación vive de programas recurrentes de donantes; la
  -- cooperación ejecuta convenios con desembolsos; el voluntariado no paga
  -- nómina a quien dona su tiempo.
  select 'ong-fundacion', k, 'add' from unnest(array['suscripciones']) as k
  union all
  select 'ong-cooperacion', k, 'add' from unnest(array['cartera']) as k
  union all
  select 'ong-voluntariado', k, 'remove' from unnest(array['nomina']) as k
  union all
  -- Gobierno. La entidad licita y evalúa; el contratista ejecuta (no licita);
  -- la empresa de servicios públicos opera redes con abonados.
  select 'gobierno-entidad', k, 'add' from unnest(array['desempeno']) as k
  union all
  select 'gobierno-contratista', k, 'remove' from unnest(array['contratacion']) as k
  union all
  select 'gobierno-servicios', k, 'add' from unnest(array['suscriptores', 'flota', 'mantenimiento']) as k
  union all
  select 'gobierno-servicios', k, 'remove' from unnest(array['contratacion']) as k
;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   -- Ninguno de estos diez padres tenía hijos antes de esta migración, así
--   -- que borrar por padre es exacto (el cascade se lleva los deltas).
--   delete from public.sectors where parent_key in
--     ('energia', 'ecommerce', 'tecnologia', 'financiero', 'mineria',
--      'telecomunicaciones', 'seguridad', 'medios', 'ong', 'gobierno');
-- ═══════════════════════════════════════════════════════════════════════════
