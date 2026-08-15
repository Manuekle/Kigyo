-- ═══════════════════════════════════════════════════════════════════════════
-- 72 — Roles sugeridos para los 33 subsectores nuevos
--
-- La migración 71 sembró los subsectores y sus deltas. Sin esta, un
-- instalador solar recibe el preset afinado pero los mismos roles genéricos
-- que cualquier otra empresa: la mitad del valor del subsector es la matriz
-- de roles que ya no hay que inventar.
--
-- Los diez sectores ya tenían matriz a nivel de sector (migración 46), que
-- sigue cubriendo a la empresa que no elige subsector. Aquí llegan matrices
-- por subsector, igual que las 40 que ya existían.
--
-- Reglas heredadas de la 46: solo vocabulario existente de `public.permissions`
-- (el guard valida al insertar), nunca `configuracion:manage`, y las claves
-- son estables porque `memberships.role` las guarda.
--
-- suggested-roles.test.ts lee esta migración junto a la 46 y la 61 para
-- pin el catálogo contra la copia TS (src/lib/suggested-roles.ts).
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.sector_roles (sector_key, role_key, label, rank, permissions) values

  -- Energía ───────────────────────────────────────────────────────────────
  ('energia-solar', 'ingeniero', 'Ingeniero/a de proyecto', 30, array['proyectos:read','proyectos:write','cotizaciones:read','cotizaciones:write','mantenimiento:read','calendario:read']),
  ('energia-solar', 'instalador', 'Técnico/a instalador/a', 40, array['proyectos:read','inventario:read','mantenimiento:read','calendario:read']),
  ('energia-solar', 'comercial', 'Comercial', 50, array['clientes:read','clientes:write','cotizaciones:read','cotizaciones:write','contratos:read','facturacion:read']),

  ('energia-eolica', 'ingeniero', 'Ingeniero/a de proyecto', 30, array['proyectos:read','proyectos:write','riesgos:read','hseq:read','calendario:read']),
  ('energia-eolica', 'hse', 'Supervisor/a HSE', 40, array['riesgos:read','riesgos:write','hseq:read','hseq:write','documentos:read']),
  ('energia-eolica', 'comercial', 'Comercial', 50, array['clientes:read','clientes:write','contratos:read','contratos:write','facturacion:read','cotizaciones:read']),

  ('energia-eficiencia', 'auditor', 'Auditor/a energético/a', 30, array['proyectos:read','proyectos:write','trazabilidad:read','cotizaciones:read','cotizaciones:write']),
  ('energia-eficiencia', 'tecnico', 'Técnico/a de campo', 40, array['proyectos:read','inventario:read','mantenimiento:read']),
  ('energia-eficiencia', 'comercial', 'Comercial', 50, array['clientes:read','clientes:write','cotizaciones:read','cotizaciones:write','contratos:read','facturacion:read']),

  ('energia-om', 'supervisor', 'Supervisor/a de planta', 30, array['mantenimiento:read','mantenimiento:write','inventario:read','inventario:write','calendario:read','calendario:write']),
  ('energia-om', 'tecnico', 'Técnico/a O&M', 40, array['mantenimiento:read','mantenimiento:write','inventario:read','asistencia:read']),
  ('energia-om', 'comercial', 'Comercial', 50, array['clientes:read','clientes:write','contratos:read','contratos:write','facturacion:read','cartera:read']),

  -- Ecommerce ─────────────────────────────────────────────────────────────
  ('ecommerce-marketplace', 'gestor', 'Gestor/a de marketplace', 30, array['catalogos:read','catalogos:write','inventario:read','inventario:write','notificaciones:read','notificaciones:write','clientes:read']),
  ('ecommerce-marketplace', 'atencion', 'Atención al cliente', 40, array['clientes:read','clientes:write','tickets:read','tickets:write','notificaciones:read']),
  ('ecommerce-marketplace', 'despacho', 'Despacho', 50, array['inventario:read','facturacion:read','notificaciones:read']),

  ('ecommerce-tienda', 'gestor', 'Gestor/a de tienda', 30, array['tienda:read','tienda:write','ecommerce:read','ecommerce:write','catalogos:read','catalogos:write','inventario:read','notificaciones:read','notificaciones:write']),
  ('ecommerce-tienda', 'atencion', 'Atención al cliente', 40, array['clientes:read','clientes:write','tickets:read','tickets:write','ecommerce:read','notificaciones:read']),
  ('ecommerce-tienda', 'despacho', 'Despacho', 50, array['inventario:read','ecommerce:read','facturacion:read']),

  ('ecommerce-dropshipping', 'gestor', 'Gestor/a de catálogo', 30, array['catalogos:read','catalogos:write','tienda:read','tienda:write','ecommerce:read','ecommerce:write','notificaciones:read','notificaciones:write']),
  ('ecommerce-dropshipping', 'atencion', 'Atención al cliente', 40, array['clientes:read','clientes:write','tickets:read','tickets:write','ecommerce:read']),
  ('ecommerce-dropshipping', 'logistica', 'Coordinador/a logístico/a', 50, array['compras:read','compras:write','facturacion:read','ecommerce:read']),

  ('ecommerce-suscripcion', 'gestor', 'Gestor/a de suscripciones', 30, array['suscripciones:read','suscripciones:write','clientes:read','clientes:write','ecommerce:read','ecommerce:write','notificaciones:read','notificaciones:write']),
  ('ecommerce-suscripcion', 'curacion', 'Curador/a', 40, array['catalogos:read','catalogos:write','inventario:read','compras:read']),
  ('ecommerce-suscripcion', 'atencion', 'Atención al cliente', 50, array['clientes:read','clientes:write','tickets:read','tickets:write','suscripciones:read']),

  -- Tecnología ────────────────────────────────────────────────────────────
  ('tecnologia-saas', 'producto', 'Equipo de producto', 30, array['proyectos:read','proyectos:write','tickets:read','tickets:write','suscripciones:read']),
  ('tecnologia-saas', 'soporte', 'Soporte', 40, array['tickets:read','tickets:write','clientes:read','suscripciones:read']),
  ('tecnologia-saas', 'gerente', 'Gerente/a', 50, array['clientes:read','clientes:write','facturacion:read','contratos:read','desempeno:read']),

  ('tecnologia-medida', 'ingeniero', 'Ingeniero/a', 30, array['proyectos:read','proyectos:write','tiempos:read','tiempos:write','clientes:read']),
  ('tecnologia-medida', 'gerente', 'Gerente/a de proyecto', 40, array['proyectos:read','proyectos:write','tiempos:read','clientes:read','clientes:write','cotizaciones:read','cotizaciones:write']),
  ('tecnologia-medida', 'disenador', 'Diseñador/a', 50, array['proyectos:read','tiempos:read','tiempos:write','documentos:read']),

  ('tecnologia-integrador', 'ingeniero', 'Ingeniero/a', 30, array['proyectos:read','proyectos:write','inventario:read','inventario:write','tickets:read','tickets:write']),
  ('tecnologia-integrador', 'instalador', 'Técnico/a instalador/a', 40, array['proyectos:read','inventario:read','asistencia:read']),
  ('tecnologia-integrador', 'comercial', 'Comercial', 50, array['clientes:read','clientes:write','cotizaciones:read','cotizaciones:write','contratos:read','facturacion:read']),

  -- Financiero ────────────────────────────────────────────────────────────
  ('financiero-cooperativa', 'asesor', 'Asesor/a de ahorro', 30, array['clientes:read','clientes:write','creditos:read','creditos:write','cartera:read']),
  ('financiero-cooperativa', 'cajero', 'Cajero/a', 40, array['caja:read','caja:write','clientes:read','facturacion:read']),
  ('financiero-cooperativa', 'riesgos', 'Analista de riesgos', 50, array['riesgos:read','riesgos:write','trazabilidad:read','creditos:read']),

  ('financiero-seguros', 'asesor', 'Asesor/a de seguros', 30, array['clientes:read','clientes:write','cotizaciones:read','cotizaciones:write','contratos:read','contratos:write']),
  ('financiero-seguros', 'siniestros', 'Analista de siniestros', 40, array['tickets:read','tickets:write','trazabilidad:read','documentos:read']),
  ('financiero-seguros', 'comercial', 'Comercial', 50, array['clientes:read','clientes:write','cotizaciones:read','cotizaciones:write','facturacion:read']),

  ('financiero-fintech', 'ingeniero', 'Ingeniero/a', 30, array['proyectos:read','proyectos:write','tickets:read','tickets:write','cartera:read']),
  ('financiero-fintech', 'soporte', 'Soporte', 40, array['tickets:read','tickets:write','clientes:read','cartera:read']),
  ('financiero-fintech', 'operaciones', 'Operaciones', 50, array['clientes:read','clientes:write','facturacion:read','facturacion:write','cartera:read','trazabilidad:read']),

  ('financiero-cobranza', 'gestor', 'Gestor/a de cobranza', 30, array['cartera:read','cartera:write','clientes:read','clientes:write','facturacion:read']),
  ('financiero-cobranza', 'agente', 'Agente de cobranza', 40, array['cartera:read','clientes:read','tickets:read','tickets:write','canales:read']),
  ('financiero-cobranza', 'analista', 'Analista de mora', 50, array['cartera:read','facturacion:read','trazabilidad:read']),

  -- Minería ───────────────────────────────────────────────────────────────
  ('mineria-abierto', 'jefe-mina', 'Jefe/a de mina', 30, array['produccion:read','produccion:write','inventario:read','inventario:write','flota:read']),
  ('mineria-abierto', 'hse', 'Supervisor/a HSE', 40, array['riesgos:read','riesgos:write','hseq:read','hseq:write','trazabilidad:read']),
  ('mineria-abierto', 'operario', 'Operario/a', 50, array['produccion:read','asistencia:read']),

  ('mineria-subterranea', 'jefe-mina', 'Jefe/a de mina', 30, array['produccion:read','produccion:write','inventario:read','inventario:write','riesgos:read']),
  ('mineria-subterranea', 'seguridad', 'Supervisor/a de seguridad', 40, array['riesgos:read','riesgos:write','hseq:read','hseq:write','capacitacion:read','capacitacion:write','trazabilidad:read']),
  ('mineria-subterranea', 'operario', 'Operario/a', 50, array['produccion:read','asistencia:read']),

  ('mineria-agregados', 'jefe-planta', 'Jefe/a de planta', 30, array['produccion:read','produccion:write','inventario:read','inventario:write','mantenimiento:read','mantenimiento:write']),
  ('mineria-agregados', 'operario', 'Operario/a', 40, array['produccion:read','asistencia:read']),
  ('mineria-agregados', 'comercial', 'Comercial', 50, array['clientes:read','clientes:write','facturacion:read','facturacion:write','cotizaciones:read','flota:read']),

  -- Telecomunicaciones ────────────────────────────────────────────────────
  ('telecomunicaciones-isp', 'noc', 'Soporte de red', 30, array['tickets:read','tickets:write','suscriptores:read','suscriptores:write','clientes:read']),
  ('telecomunicaciones-isp', 'instalador', 'Técnico/a instalador/a', 40, array['proyectos:read','inventario:read','suscriptores:read']),
  ('telecomunicaciones-isp', 'cajero', 'Cajero/a de pagos', 50, array['caja:read','caja:write','suscriptores:read','clientes:read','facturacion:read']),

  ('telecomunicaciones-instalador', 'tecnico', 'Técnico/a instalador/a', 30, array['proyectos:read','proyectos:write','inventario:read','inventario:write','mantenimiento:read']),
  ('telecomunicaciones-instalador', 'supervisor', 'Supervisor/a de campo', 40, array['proyectos:read','proyectos:write','asistencia:read','asistencia:write','riesgos:read','hseq:read']),
  ('telecomunicaciones-instalador', 'comercial', 'Comercial', 50, array['clientes:read','clientes:write','cotizaciones:read','cotizaciones:write','contratos:read','contratos:write','facturacion:read']),

  ('telecomunicaciones-integrador', 'ingeniero', 'Ingeniero/a de redes', 30, array['proyectos:read','proyectos:write','tickets:read','tickets:write','mantenimiento:read','mantenimiento:write']),
  ('telecomunicaciones-integrador', 'tecnico', 'Técnico/a', 40, array['proyectos:read','inventario:read','tickets:read','tickets:write']),
  ('telecomunicaciones-integrador', 'comercial', 'Comercial', 50, array['clientes:read','clientes:write','cotizaciones:read','cotizaciones:write','contratos:read','contratos:write','facturacion:read']),

  -- Seguridad ─────────────────────────────────────────────────────────────
  ('seguridad-vigilancia', 'supervisor', 'Supervisor/a de puesto', 30, array['puestos:read','puestos:write','asistencia:read','asistencia:write','riesgos:read','hseq:read']),
  ('seguridad-vigilancia', 'guarda', 'Guarda', 40, array['puestos:read','asistencia:read','calendario:read']),
  ('seguridad-vigilancia', 'comercial', 'Comercial', 50, array['clientes:read','clientes:write','contratos:read','contratos:write','facturacion:read','cartera:read']),

  ('seguridad-monitoreo', 'operador', 'Operador/a de monitoreo', 30, array['tickets:read','tickets:write','canales:read','canales:write','catalogos:read','clientes:read']),
  ('seguridad-monitoreo', 'instalador', 'Técnico/a de alarmas', 40, array['catalogos:read','catalogos:write','inventario:read','inventario:write','asistencia:read']),
  ('seguridad-monitoreo', 'comercial', 'Comercial', 50, array['clientes:read','clientes:write','cotizaciones:read','cotizaciones:write','contratos:read','contratos:write','facturacion:read']),

  ('seguridad-escoltas', 'escolta', 'Escolta', 30, array['asistencia:read','asistencia:write','flota:read','calendario:read','riesgos:read']),
  ('seguridad-escoltas', 'coordinador', 'Coordinador/a de escoltas', 40, array['asistencia:read','asistencia:write','flota:read','flota:write','clientes:read','calendario:read','calendario:write']),
  ('seguridad-escoltas', 'comercial', 'Comercial', 50, array['clientes:read','clientes:write','contratos:read','contratos:write','facturacion:read','cotizaciones:read']),

  -- Medios ────────────────────────────────────────────────────────────────
  ('medios-agencia', 'creativo', 'Creativo/a', 30, array['proyectos:read','proyectos:write','documentos:read','documentos:write','clientes:read']),
  ('medios-agencia', 'cuentas', 'Ejecutivo/a de cuenta', 40, array['clientes:read','clientes:write','cotizaciones:read','cotizaciones:write','proyectos:read','calendario:read','calendario:write']),
  ('medios-agencia', 'produccion', 'Producción', 50, array['proyectos:read','proyectos:write','calendario:read','calendario:write','tiempos:read','tiempos:write']),

  ('medios-productora', 'productor', 'Productor/a', 30, array['proyectos:read','proyectos:write','tiempos:read','tiempos:write','calendario:read','calendario:write']),
  ('medios-productora', 'tecnico', 'Técnico/a de equipo', 40, array['inventario:read','inventario:write','mantenimiento:read','mantenimiento:write','proyectos:read']),
  ('medios-productora', 'post', 'Postproducción', 50, array['proyectos:read','proyectos:write','tiempos:read','tiempos:write','documentos:read']),

  ('medios-medio', 'editor', 'Editor/a', 30, array['documentos:read','documentos:write','suscripciones:read','suscripciones:write','calendario:read','calendario:write']),
  ('medios-medio', 'periodista', 'Periodista', 40, array['documentos:read','documentos:write','canales:read','canales:write']),
  ('medios-medio', 'pauta', 'Comercial de pauta', 50, array['clientes:read','clientes:write','facturacion:read','facturacion:write','cotizaciones:read','cotizaciones:write','contratos:read']),

  -- ONG ───────────────────────────────────────────────────────────────────
  ('ong-fundacion', 'coordinador', 'Coordinador/a de proyectos', 30, array['proyectos:read','proyectos:write','donantes:read','donantes:write','capacitacion:read','capacitacion:write']),
  ('ong-fundacion', 'donantes', 'Relacionamiento de donantes', 40, array['donantes:read','donantes:write','clientes:read','clientes:write','suscripciones:read','suscripciones:write','canales:read','canales:write']),
  ('ong-fundacion', 'finanzas', 'Finanzas', 50, array['trazabilidad:read','firmas:read','documentos:read']),

  ('ong-cooperacion', 'coordinador', 'Coordinador/a de convenios', 30, array['proyectos:read','proyectos:write','contratos:read','contratos:write','cartera:read','cartera:write']),
  ('ong-cooperacion', 'monitoreo', 'Monitoreo y evaluación', 40, array['trazabilidad:read','proyectos:read','documentos:read','documentos:write']),
  ('ong-cooperacion', 'finanzas', 'Finanzas', 50, array['cartera:read','firmas:read','trazabilidad:read']),

  ('ong-voluntariado', 'coordinador', 'Coordinador/a de voluntarios', 30, array['asistencia:read','asistencia:write','capacitacion:read','capacitacion:write','calendario:read','calendario:write','canales:read','canales:write']),
  ('ong-voluntariado', 'voluntario', 'Voluntario/a', 40, array['asistencia:read','calendario:read','canales:read']),
  ('ong-voluntariado', 'logistica', 'Logística', 50, array['proyectos:read','proyectos:write','tickets:read','tickets:write']),

  -- Gobierno ──────────────────────────────────────────────────────────────
  ('gobierno-entidad', 'ordenador', 'Ordenador/a del gasto', 30, array['contratacion:read','contratacion:write','contratos:read','contratos:write','documentos:read']),
  ('gobierno-entidad', 'juridico', 'Jurídico/a', 40, array['contratos:read','contratos:write','firmas:read','firmas:write','documentos:read','documentos:write','trazabilidad:read']),
  ('gobierno-entidad', 'supervision', 'Supervisión', 50, array['proyectos:read','proyectos:write','desempeno:read','trazabilidad:read']),

  ('gobierno-contratista', 'ingeniero', 'Ingeniero/a', 30, array['proyectos:read','proyectos:write','compras:read','compras:write','inventario:read','inventario:write']),
  ('gobierno-contratista', 'hse', 'Supervisor/a HSE', 40, array['riesgos:read','riesgos:write','hseq:read','hseq:write','trazabilidad:read']),
  ('gobierno-contratista', 'administrativo', 'Administrativo/a', 50, array['contratos:read','contratos:write','documentos:read','documentos:write','firmas:read','canales:read','canales:write']),

  ('gobierno-servicios', 'tecnico', 'Técnico/a de redes', 30, array['mantenimiento:read','mantenimiento:write','suscriptores:read','suscriptores:write','flota:read','flota:write']),
  ('gobierno-servicios', 'atencion', 'Atención al usuario', 40, array['suscriptores:read','suscriptores:write','tickets:read','tickets:write','canales:read','canales:write','calendario:read','calendario:write']),
  ('gobierno-servicios', 'operaciones', 'Operaciones', 50, array['suscriptores:read','suscriptores:write','mantenimiento:read','mantenimiento:write','flota:read','trazabilidad:read'])
;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   delete from public.sector_roles where sector_key like 'energia-%'
--      or sector_key like 'ecommerce-%' or sector_key like 'tecnologia-%'
--      or sector_key like 'financiero-%' or sector_key like 'mineria-%'
--      or sector_key like 'telecomunicaciones-%' or sector_key like 'seguridad-%'
--      or sector_key like 'medios-%' or sector_key like 'ong-%'
--      or sector_key like 'gobierno-%';
-- ═══════════════════════════════════════════════════════════════════════════
