-- ═══════════════════════════════════════════════════════════════════════════
-- 61 — Roles sugeridos: los módulos nuevos llegan a las matrices
--
-- La migración 46 sembró las matrices antes de que existieran los módulos
-- 47-60. Este pase da a cada rol operativo los permisos de los módulos que
-- su sector ya trae prendidos en el preset, para que «Añadir roles
-- sugeridos» no entregue roles que no pueden abrir pantallas que sí están
-- habilitadas.
--
-- `reportes` e `ia` quedan fuera a propósito: son herramientas meta que,
-- igual que ia:use en la matriz original, el administrador concede a mano.
--
-- El pase NO vive en la 46 porque el guard `app.guard_sector_role()` valida
-- cada permiso contra `public.permissions`, y los módulos 47-60 aún no
-- existen cuando la 46 corre. En una base fresca estos UPDATEs van después
-- de esas migraciones; suggested-roles.test.ts lee las dos para pin el
-- catálogo completo contra la copia TS.
-- ═══════════════════════════════════════════════════════════════════════════

update public.sector_roles
  set permissions = array['pacientes:read','clientes:read','clientes:write','calendario:read','calendario:write','facturacion:read','caja:read','caja:write','tickets:read','canales:read','documentos:read','notificaciones:read','notificaciones:write']
  where sector_key = 'salud-consultorio' and role_key = 'recepcionista';

update public.sector_roles
  set permissions = array['facturacion:read','facturacion:write','clientes:read','caja:read','caja:write','tickets:read','cartera:read','cartera:write']
  where sector_key = 'salud-ips' and role_key = 'facturador';

update public.sector_roles
  set permissions = array['pacientes:read','clientes:read','clientes:write','calendario:read','calendario:write','facturacion:read','caja:read','caja:write','tickets:read','notificaciones:read','notificaciones:write']
  where sector_key = 'salud-ips' and role_key = 'recepcionista';

update public.sector_roles
  set permissions = array['pacientes:read','clientes:read','clientes:write','catalogos:read','facturacion:read','caja:read','caja:write','calendario:read','calendario:write','cartera:read','notificaciones:read','notificaciones:write']
  where sector_key = 'salud-laboratorio' and role_key = 'recepcionista';

update public.sector_roles
  set permissions = array['pacientes:read','clientes:read','clientes:write','calendario:read','calendario:write','cotizaciones:read','facturacion:read','caja:read','caja:write','tickets:read','cartera:read','notificaciones:read','notificaciones:write']
  where sector_key = 'salud-odontologia' and role_key = 'recepcionista';

update public.sector_roles
  set permissions = array['pacientes:read','clientes:read','clientes:write','calendario:read','calendario:write','cotizaciones:read','facturacion:read','caja:read','caja:write','cartera:read','notificaciones:read','notificaciones:write']
  where sector_key = 'salud-estetica' and role_key = 'recepcionista';

update public.sector_roles
  set permissions = array['pacientes:read','clientes:read','clientes:write','calendario:read','calendario:write','facturacion:read','tienda:read','pos:read','pos:write','caja:read','caja:write','tickets:read','cartera:read','notificaciones:read','notificaciones:write']
  where sector_key = 'salud-veterinaria' and role_key = 'cajero';

update public.sector_roles
  set permissions = array['restaurante:read','inventario:read','compras:read','calidad:read','calidad:write']
  where sector_key = 'alimentos-salon' and role_key = 'cocina';

update public.sector_roles
  set permissions = array['restaurante:read','inventario:read','calidad:read']
  where sector_key = 'alimentos-rapida' and role_key = 'cocina';

update public.sector_roles
  set permissions = array['restaurante:read','inventario:read','calidad:read','calidad:write']
  where sector_key = 'alimentos-catering' and role_key = 'cocina';

update public.sector_roles
  set permissions = array['produccion:read','produccion:write','inventario:read','compras:read','calidad:read']
  where sector_key = 'alimentos-panaderia' and role_key = 'panadero';

update public.sector_roles
  set permissions = array['hoteleria:read','hoteleria:write','clientes:read','clientes:write','calendario:read','calendario:write','facturacion:read','caja:read','caja:write','notificaciones:read','notificaciones:write']
  where sector_key = 'hoteleria-hotel' and role_key = 'recepcion';

update public.sector_roles
  set permissions = array['hoteleria:read','hoteleria:write','clientes:read','clientes:write','facturacion:read','caja:read','caja:write','notificaciones:read','notificaciones:write']
  where sector_key = 'hoteleria-hostal' and role_key = 'recepcion';

update public.sector_roles
  set permissions = array['hoteleria:read','hoteleria:write','clientes:read','clientes:write','facturacion:read','caja:read','caja:write','calendario:read','calendario:write','notificaciones:read','notificaciones:write']
  where sector_key = 'hoteleria-finca' and role_key = 'recepcion';

update public.sector_roles
  set permissions = array['clientes:read','clientes:write','cotizaciones:read','cotizaciones:write','contratos:read','contratos:write','calendario:read','calendario:write','facturacion:read','notificaciones:read','notificaciones:write']
  where sector_key = 'hoteleria-operador' and role_key = 'agente';

update public.sector_roles
  set permissions = array['socios:read','socios:write','clientes:read','clientes:write','calendario:read','calendario:write','caja:read','caja:write','facturacion:read','suscripciones:read','suscripciones:write','notificaciones:read','notificaciones:write']
  where sector_key = 'fitness-gimnasio' and role_key = 'recepcionista';

update public.sector_roles
  set permissions = array['socios:read','socios:write','clientes:read','clientes:write','calendario:read','calendario:write','caja:read','caja:write','facturacion:read','suscripciones:read','suscripciones:write','notificaciones:read','notificaciones:write']
  where sector_key = 'fitness-estudio' and role_key = 'recepcionista';

update public.sector_roles
  set permissions = array['socios:read','socios:write','clientes:read','clientes:write','calendario:read','calendario:write','caja:read','caja:write','pos:read','pos:write','facturacion:read','suscripciones:read','suscripciones:write','notificaciones:read','notificaciones:write']
  where sector_key = 'fitness-spa' and role_key = 'recepcionista';

update public.sector_roles
  set permissions = array['socios:read','socios:write','pacientes:read','clientes:read','clientes:write','calendario:read','calendario:write','caja:read','caja:write','facturacion:read','suscripciones:read','suscripciones:write','notificaciones:read','notificaciones:write']
  where sector_key = 'fitness-centro' and role_key = 'recepcionista';

update public.sector_roles
  set permissions = array['agro:read','agro:write','trazabilidad:read','calidad:read','calidad:write']
  where sector_key = 'agro-permanente' and role_key = 'tecnico';

update public.sector_roles
  set permissions = array['agro:read','agro:write','produccion:read','calidad:read','calidad:write']
  where sector_key = 'agro-transitorio' and role_key = 'tecnico';

update public.sector_roles
  set permissions = array['agro:read','agro:write','trazabilidad:read','produccion:read','calidad:read']
  where sector_key = 'agro-ganaderia' and role_key = 'veterinario';

update public.sector_roles
  set permissions = array['trazabilidad:read','produccion:read','agro:read','calidad:read','calidad:write']
  where sector_key = 'agro-poscosecha' and role_key = 'calidad';

update public.sector_roles
  set permissions = array['proyectos:read','proyectos:write','riesgos:read','hseq:read','calendario:read','obra:read','obra:write']
  where sector_key = 'construccion-civil' and role_key = 'residente';

update public.sector_roles
  set permissions = array['clientes:read','facturacion:read','contratos:read','documentos:read','flota:read','obra:read']
  where sector_key = 'construccion-civil' and role_key = 'administrativo';

update public.sector_roles
  set permissions = array['proyectos:read','proyectos:write','catalogos:read','catalogos:write','cotizaciones:read','cotizaciones:write','compras:read','obra:read','obra:write']
  where sector_key = 'construccion-mep' and role_key = 'ingeniero';

update public.sector_roles
  set permissions = array['proyectos:read','proyectos:write','cotizaciones:read','cotizaciones:write','catalogos:read','clientes:read','clientes:write','obra:read','obra:write']
  where sector_key = 'construccion-remodel' and role_key = 'disenador';

update public.sector_roles
  set permissions = array['proyectos:read','inventario:read','obra:read']
  where sector_key = 'construccion-remodel' and role_key = 'oficial';

update public.sector_roles
  set permissions = array['proyectos:read','proyectos:write','trazabilidad:read','riesgos:read','calendario:read','obra:read','obra:write']
  where sector_key = 'construccion-interv' and role_key = 'supervisor';

update public.sector_roles
  set permissions = array['trazabilidad:read','proyectos:read','documentos:read','firmas:read','obra:read']
  where sector_key = 'construccion-interv' and role_key = 'inspector';

update public.sector_roles
  set permissions = array['produccion:read','produccion:write','inventario:read','compras:read','proyectos:read','calidad:read']
  where sector_key = 'manufactura-metal' and role_key = 'jefe-produccion';

update public.sector_roles
  set permissions = array['produccion:read','inventario:read','calidad:read','calidad:write']
  where sector_key = 'manufactura-metal' and role_key = 'calidad';

update public.sector_roles
  set permissions = array['produccion:read','produccion:write','inventario:read','compras:read','calidad:read']
  where sector_key = 'manufactura-plastico' and role_key = 'jefe-produccion';

update public.sector_roles
  set permissions = array['trazabilidad:read','produccion:read','calidad:read','calidad:write']
  where sector_key = 'manufactura-plastico' and role_key = 'calidad';

update public.sector_roles
  set permissions = array['produccion:read','produccion:write','catalogos:read','calidad:read','calidad:write']
  where sector_key = 'manufactura-textil' and role_key = 'patronista';

update public.sector_roles
  set permissions = array['produccion:read','produccion:write','inventario:read','compras:read','calidad:read']
  where sector_key = 'manufactura-alimentos' and role_key = 'jefe-produccion';

update public.sector_roles
  set permissions = array['trazabilidad:read','produccion:read','calidad:read','calidad:write']
  where sector_key = 'manufactura-alimentos' and role_key = 'calidad';

update public.sector_roles
  set permissions = array['proyectos:read','proyectos:write','consultoria:read','consultoria:write','clientes:read','cotizaciones:read','calendario:read','tiempos:read','tiempos:write']
  where sector_key = 'servicios-consultoria' and role_key = 'consultor';

update public.sector_roles
  set permissions = array['proyectos:read','consultoria:read','documentos:read','tiempos:read']
  where sector_key = 'servicios-consultoria' and role_key = 'analista';

update public.sector_roles
  set permissions = array['clientes:read','clientes:write','facturacion:read','contratos:read','desempeno:read','cartera:read','cartera:write']
  where sector_key = 'servicios-consultoria' and role_key = 'gerente-cuenta';

update public.sector_roles
  set permissions = array['clientes:read','clientes:write','facturacion:read','facturacion:write','trazabilidad:read','documentos:read','cartera:read','cartera:write']
  where sector_key = 'servicios-contable' and role_key = 'contador';

update public.sector_roles
  set permissions = array['clientes:read','facturacion:read','trazabilidad:read','cartera:read']
  where sector_key = 'servicios-contable' and role_key = 'auxiliar';

update public.sector_roles
  set permissions = array['clientes:read','clientes:write','contratos:read','contratos:write','firmas:read','firmas:write','trazabilidad:read','calendario:read','tiempos:read','tiempos:write','cartera:read']
  where sector_key = 'servicios-legal' and role_key = 'abogado';

update public.sector_roles
  set permissions = array['clientes:read','documentos:read','documentos:write','trazabilidad:read','calendario:read','tiempos:read']
  where sector_key = 'servicios-legal' and role_key = 'paralegal';

update public.sector_roles
  set permissions = array['proyectos:read','proyectos:write','clientes:read','documentos:read','calendario:read','tiempos:read','tiempos:write']
  where sector_key = 'servicios-agencia' and role_key = 'creativo';

update public.sector_roles
  set permissions = array['clientes:read','clientes:write','cotizaciones:read','cotizaciones:write','proyectos:read','calendario:read','tiempos:read','cartera:read']
  where sector_key = 'servicios-agencia' and role_key = 'ejecutivo-cuenta';

update public.sector_roles
  set permissions = array['proyectos:read','proyectos:write','clientes:read','inventario:read','tickets:read','tickets:write','tiempos:read','tiempos:write']
  where sector_key = 'servicios-ti' and role_key = 'ingeniero';

update public.sector_roles
  set permissions = array['clientes:read','clientes:write','facturacion:read','desempeno:read','cotizaciones:read','tiempos:read','cartera:read','cartera:write']
  where sector_key = 'servicios-ti' and role_key = 'gerente';

update public.sector_roles
  set permissions = array['inmobiliario:read','inmobiliario:write','facturacion:read','mantenimiento:read','tickets:read','suscripciones:read','suscripciones:write','notificaciones:read','notificaciones:write']
  where sector_key = 'inmobiliario-arriendo' and role_key = 'administrador';

update public.sector_roles
  set permissions = array['inmobiliario:read','inmobiliario:write','facturacion:read','contratos:read','tickets:read','tickets:write','calendario:read','ph:read','ph:write','notificaciones:read','notificaciones:write']
  where sector_key = 'inmobiliario-ph' and role_key = 'administrador';

update public.sector_roles
  set permissions = array['documentos:read','firmas:read','calendario:read','ph:read']
  where sector_key = 'inmobiliario-ph' and role_key = 'consejo';

update public.sector_roles
  set permissions = array['estudiantes:read','estudiantes:write','clientes:read','facturacion:read','documentos:read','calendario:read','calendario:write','suscripciones:read','suscripciones:write','cartera:read','notificaciones:read','notificaciones:write']
  where sector_key = 'educacion-colegio' and role_key = 'secretaria';

update public.sector_roles
  set permissions = array['estudiantes:read','estudiantes:write','clientes:read','clientes:write','facturacion:read','suscripciones:read','suscripciones:write','cartera:read','notificaciones:read','notificaciones:write']
  where sector_key = 'educacion-instituto' and role_key = 'admisiones';

update public.sector_roles
  set permissions = array['estudiantes:read','clientes:read','clientes:write','facturacion:read','calendario:read','calendario:write','suscripciones:read','suscripciones:write','cartera:read','notificaciones:read','notificaciones:write']
  where sector_key = 'educacion-academia' and role_key = 'recepcion';

update public.sector_roles
  set permissions = array['estudiantes:read','estudiantes:write','clientes:read','clientes:write','facturacion:read','reclutamiento:read','trazabilidad:read','suscripciones:read','suscripciones:write','cartera:read','notificaciones:read','notificaciones:write']
  where sector_key = 'educacion-universidad' and role_key = 'admisiones';

update public.sector_roles
  set permissions = array['proyectos:read','proyectos:write','catalogos:read','cotizaciones:read','obra:read','obra:write']
  where sector_key = 'energia' and role_key = 'ingeniero';

update public.sector_roles
  set permissions = array['proyectos:read','mantenimiento:read','inventario:read','obra:read']
  where sector_key = 'energia' and role_key = 'tecnico';

update public.sector_roles
  set permissions = array['proyectos:read','proyectos:write','clientes:read','tickets:read','tickets:write','tiempos:read','tiempos:write']
  where sector_key = 'tecnologia' and role_key = 'ingeniero';

update public.sector_roles
  set permissions = array['clientes:read','clientes:write','facturacion:read','desempeno:read','contratos:read','tiempos:read','suscripciones:read','suscripciones:write']
  where sector_key = 'tecnologia' and role_key = 'gerente';

update public.sector_roles
  set permissions = array['clientes:read','clientes:write','cotizaciones:read','cotizaciones:write','contratos:read','creditos:read','creditos:write','cartera:read']
  where sector_key = 'financiero' and role_key = 'asesor';

update public.sector_roles
  set permissions = array['riesgos:read','riesgos:write','trazabilidad:read','creditos:read']
  where sector_key = 'financiero' and role_key = 'riesgos';

update public.sector_roles
  set permissions = array['facturacion:read','facturacion:write','clientes:read','creditos:read','cartera:read','cartera:write']
  where sector_key = 'financiero' and role_key = 'cobranza';

update public.sector_roles
  set permissions = array['proyectos:read','proyectos:write','riesgos:read','hseq:read','obra:read','obra:write']
  where sector_key = 'mineria' and role_key = 'ingeniero';

update public.sector_roles
  set permissions = array['proyectos:read','tickets:read','tickets:write','inventario:read','suscriptores:read']
  where sector_key = 'telecomunicaciones' and role_key = 'instalador';

update public.sector_roles
  set permissions = array['tickets:read','tickets:write','clientes:read','mantenimiento:read','suscriptores:read','suscriptores:write']
  where sector_key = 'telecomunicaciones' and role_key = 'noc';

update public.sector_roles
  set permissions = array['clientes:read','clientes:write','facturacion:read','contratos:read','suscriptores:read']
  where sector_key = 'telecomunicaciones' and role_key = 'comercial';

update public.sector_roles
  set permissions = array['asistencia:read','asistencia:write','riesgos:read','hseq:read','trazabilidad:read','puestos:read','puestos:write']
  where sector_key = 'seguridad' and role_key = 'supervisor';

update public.sector_roles
  set permissions = array['clientes:read','clientes:write','contratos:read','contratos:write','facturacion:read','puestos:read']
  where sector_key = 'seguridad' and role_key = 'comercial';

update public.sector_roles
  set permissions = array['proyectos:read','proyectos:write','clientes:read','documentos:read','tiempos:read','tiempos:write']
  where sector_key = 'medios' and role_key = 'creativo';

update public.sector_roles
  set permissions = array['proyectos:read','proyectos:write','inventario:read','calendario:read','calendario:write','tiempos:read','tiempos:write']
  where sector_key = 'medios' and role_key = 'productor';

update public.sector_roles
  set permissions = array['clientes:read','clientes:write','cotizaciones:read','cotizaciones:write','facturacion:read','tiempos:read']
  where sector_key = 'medios' and role_key = 'comercial';

update public.sector_roles
  set permissions = array['proyectos:read','proyectos:write','capacitacion:read','trazabilidad:read','donantes:read','donantes:write']
  where sector_key = 'ong' and role_key = 'coordinador';

update public.sector_roles
  set permissions = array['clientes:read','firmas:read','trazabilidad:read','donantes:read']
  where sector_key = 'ong' and role_key = 'finanzas';

update public.sector_roles
  set permissions = array['contratos:read','contratos:write','proyectos:read','proyectos:write','trazabilidad:read','contratacion:read','contratacion:write']
  where sector_key = 'gobierno' and role_key = 'contratista';

update public.sector_roles
  set permissions = array['contratos:read','firmas:read','firmas:write','documentos:read','documentos:write','contratacion:read']
  where sector_key = 'gobierno' and role_key = 'juridico';

update public.sector_roles
  set permissions = array['proyectos:read','hseq:read','riesgos:read','trazabilidad:read','contratacion:read']
  where sector_key = 'gobierno' and role_key = 'supervision';

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   (revertir los arrays a como estaban en la 46 original)
-- ═══════════════════════════════════════════════════════════════════════════
