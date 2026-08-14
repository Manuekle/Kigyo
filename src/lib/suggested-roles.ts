/**
 * Roles sugeridos por sector y subsector.
 *
 * Espejo de `public.sector_roles` (migración 46). El catálogo vive en la
 * base de datos y esta copia existe por las mismas razones que
 * `COMPANY_TYPES`: las pantallas de primera ejecución necesitan vista previa
 * sin sesión, y una matriz de roles es una decisión de producto que merece
 * revisión en diff. Un test pin las dos copias en ambas direcciones.
 *
 * La búsqueda en el seed es por subsector con caída al sector:
 *
 *     coalesce(organizations.subsector, organizations.company_type)
 *
 * Un subsector ausente de este mapa es legítimo: no recibe sugerencias.
 */

export interface SuggestedRole {
  /** La identidad estable, igual que `roles.key`: lo que `memberships.role` guarda. */
  key: string
  /** La palabra que la persona ve. */
  label: string
  /** Menor = más arriba en la lista de roles. */
  rank: number
  /** Vocabulario de `public.permissions`; solo read/write por módulo. */
  permissions: string[]
}

export const SUGGESTED_ROLES: Record<string, SuggestedRole[]> = {
  /* ─── Salud ─────────────────────────────────────────────────────────── */
  'salud-consultorio': [
    { key: 'medico', label: 'Médico/a', rank: 30, permissions: ['pacientes:read', 'pacientes:write', 'calendario:read', 'firmas:read', 'documentos:read', 'canales:read'] },
    { key: 'enfermero', label: 'Enfermero/a', rank: 40, permissions: ['pacientes:read', 'pacientes:write', 'calendario:read'] },
    { key: 'recepcionista', label: 'Recepcionista', rank: 50, permissions: ['pacientes:read', 'clientes:read', 'clientes:write', 'calendario:read', 'calendario:write', 'facturacion:read', 'caja:read', 'caja:write', 'tickets:read', 'canales:read', 'documentos:read'] },
  ],
  'salud-ips': [
    { key: 'medico', label: 'Médico/a', rank: 30, permissions: ['pacientes:read', 'pacientes:write', 'calendario:read', 'firmas:read', 'documentos:read', 'canales:read'] },
    { key: 'enfermero', label: 'Enfermero/a', rank: 40, permissions: ['pacientes:read', 'pacientes:write', 'calendario:read'] },
    { key: 'facturador', label: 'Facturador/a', rank: 45, permissions: ['facturacion:read', 'facturacion:write', 'clientes:read', 'caja:read', 'caja:write', 'tickets:read'] },
    { key: 'recepcionista', label: 'Recepcionista', rank: 50, permissions: ['pacientes:read', 'clientes:read', 'clientes:write', 'calendario:read', 'calendario:write', 'facturacion:read', 'caja:read', 'caja:write', 'tickets:read'] },
  ],
  'salud-laboratorio': [
    { key: 'analista', label: 'Analista de laboratorio', rank: 30, permissions: ['pacientes:read', 'pacientes:write', 'catalogos:read', 'trazabilidad:read', 'calendario:read'] },
    { key: 'recepcionista', label: 'Recepcionista', rank: 50, permissions: ['pacientes:read', 'clientes:read', 'clientes:write', 'catalogos:read', 'facturacion:read', 'caja:read', 'caja:write', 'calendario:read', 'calendario:write'] },
  ],
  'salud-odontologia': [
    { key: 'odontologo', label: 'Odontólogo/a', rank: 30, permissions: ['pacientes:read', 'pacientes:write', 'cotizaciones:read', 'cotizaciones:write', 'catalogos:read', 'calendario:read', 'firmas:read'] },
    { key: 'auxiliar', label: 'Auxiliar dental', rank: 40, permissions: ['pacientes:read', 'pacientes:write', 'calendario:read', 'catalogos:read'] },
    { key: 'recepcionista', label: 'Recepcionista', rank: 50, permissions: ['pacientes:read', 'clientes:read', 'clientes:write', 'calendario:read', 'calendario:write', 'cotizaciones:read', 'facturacion:read', 'caja:read', 'caja:write', 'tickets:read'] },
  ],
  'salud-estetica': [
    { key: 'especialista', label: 'Especialista', rank: 30, permissions: ['pacientes:read', 'pacientes:write', 'cotizaciones:read', 'cotizaciones:write', 'catalogos:read', 'calendario:read', 'firmas:read'] },
    { key: 'recepcionista', label: 'Recepcionista', rank: 50, permissions: ['pacientes:read', 'clientes:read', 'clientes:write', 'calendario:read', 'calendario:write', 'cotizaciones:read', 'facturacion:read', 'caja:read', 'caja:write'] },
  ],
  'salud-veterinaria': [
    { key: 'veterinario', label: 'Veterinario/a', rank: 30, permissions: ['pacientes:read', 'pacientes:write', 'calendario:read', 'catalogos:read', 'firmas:read', 'documentos:read'] },
    { key: 'auxiliar', label: 'Auxiliar veterinario', rank: 40, permissions: ['pacientes:read', 'pacientes:write', 'calendario:read', 'catalogos:read', 'tienda:read', 'pos:read'] },
    { key: 'cajero', label: 'Recepción y caja', rank: 50, permissions: ['pacientes:read', 'clientes:read', 'clientes:write', 'calendario:read', 'calendario:write', 'facturacion:read', 'tienda:read', 'pos:read', 'pos:write', 'caja:read', 'caja:write', 'tickets:read'] },
  ],

  /* ─── Comercio ──────────────────────────────────────────────────────── */
  'comercio-retail': [
    { key: 'vendedor', label: 'Vendedor/a', rank: 30, permissions: ['clientes:read', 'clientes:write', 'tienda:read', 'pos:read', 'pos:write', 'caja:read', 'catalogos:read', 'inventario:read'] },
    { key: 'cajero', label: 'Cajero/a', rank: 40, permissions: ['clientes:read', 'tienda:read', 'pos:read', 'pos:write', 'caja:read', 'caja:write', 'facturacion:read'] },
    { key: 'supervisor', label: 'Supervisor/a de inventario', rank: 50, permissions: ['inventario:read', 'inventario:write', 'compras:read', 'compras:write', 'catalogos:read', 'catalogos:write'] },
  ],
  'comercio-mayorista': [
    { key: 'ejecutivo', label: 'Ejecutivo/a de ventas', rank: 30, permissions: ['clientes:read', 'clientes:write', 'cotizaciones:read', 'cotizaciones:write', 'facturacion:read', 'contratos:read'] },
    { key: 'despachador', label: 'Despachador/a', rank: 40, permissions: ['inventario:read', 'flota:read', 'compras:read', 'facturacion:read'] },
  ],
  'comercio-ferreteria': [
    { key: 'vendedor', label: 'Vendedor/a de mostrador', rank: 30, permissions: ['clientes:read', 'clientes:write', 'pos:read', 'pos:write', 'caja:read', 'catalogos:read', 'inventario:read'] },
    { key: 'bodega', label: 'Jefe/a de bodega', rank: 40, permissions: ['inventario:read', 'inventario:write', 'compras:read', 'compras:write', 'catalogos:read', 'catalogos:write'] },
    { key: 'cajero', label: 'Cajero/a', rank: 50, permissions: ['clientes:read', 'pos:read', 'pos:write', 'caja:read', 'caja:write', 'facturacion:read'] },
  ],
  'comercio-farmacia': [
    { key: 'regente', label: 'Regente de farmacia', rank: 30, permissions: ['clientes:read', 'pos:read', 'pos:write', 'caja:read', 'inventario:read', 'trazabilidad:read', 'catalogos:read'] },
    { key: 'cajero', label: 'Cajero/a', rank: 40, permissions: ['clientes:read', 'pos:read', 'pos:write', 'caja:read', 'caja:write', 'facturacion:read'] },
  ],
  'comercio-super': [
    { key: 'cajero', label: 'Cajero/a', rank: 30, permissions: ['pos:read', 'pos:write', 'caja:read', 'caja:write', 'clientes:read', 'facturacion:read'] },
    { key: 'reponedor', label: 'Reponedor/a', rank: 40, permissions: ['inventario:read', 'inventario:write', 'catalogos:read'] },
    { key: 'supervisor', label: 'Supervisor/a', rank: 50, permissions: ['inventario:read', 'inventario:write', 'compras:read', 'compras:write', 'catalogos:read', 'catalogos:write', 'pos:read'] },
  ],

  /* ─── Restaurantes y alimentos ──────────────────────────────────────── */
  'alimentos-salon': [
    { key: 'mesero', label: 'Mesero/a', rank: 30, permissions: ['restaurante:read', 'restaurante:write', 'clientes:read', 'caja:read'] },
    { key: 'cocina', label: 'Cocina', rank: 40, permissions: ['restaurante:read', 'inventario:read', 'compras:read'] },
    { key: 'cajero', label: 'Cajero/a', rank: 50, permissions: ['restaurante:read', 'clientes:read', 'caja:read', 'caja:write', 'facturacion:read'] },
  ],
  'alimentos-rapida': [
    { key: 'mostrador', label: 'Mostrador y caja', rank: 30, permissions: ['restaurante:read', 'pos:read', 'pos:write', 'caja:read', 'caja:write', 'clientes:read', 'tienda:read', 'ecommerce:read'] },
    { key: 'cocina', label: 'Cocina', rank: 40, permissions: ['restaurante:read', 'inventario:read'] },
    { key: 'repartidor', label: 'Repartidor/a', rank: 50, permissions: ['restaurante:read', 'tienda:read', 'ecommerce:read'] },
  ],
  'alimentos-bar': [
    { key: 'bartender', label: 'Bartender', rank: 30, permissions: ['restaurante:read', 'restaurante:write', 'caja:read', 'inventario:read', 'clientes:read'] },
    { key: 'mesero', label: 'Mesero/a', rank: 40, permissions: ['restaurante:read', 'restaurante:write', 'caja:read', 'clientes:read'] },
    { key: 'cajero', label: 'Cajero/a', rank: 50, permissions: ['restaurante:read', 'caja:read', 'caja:write', 'facturacion:read'] },
  ],
  'alimentos-catering': [
    { key: 'chef', label: 'Chef', rank: 30, permissions: ['restaurante:read', 'restaurante:write', 'inventario:read', 'compras:read', 'cotizaciones:read', 'proyectos:read'] },
    { key: 'coordinador', label: 'Coordinador/a de eventos', rank: 40, permissions: ['clientes:read', 'clientes:write', 'cotizaciones:read', 'cotizaciones:write', 'contratos:read', 'contratos:write', 'proyectos:read', 'proyectos:write', 'calendario:read', 'calendario:write'] },
    { key: 'cocina', label: 'Cocina', rank: 50, permissions: ['restaurante:read', 'inventario:read'] },
  ],
  'alimentos-panaderia': [
    { key: 'panadero', label: 'Panadero/a', rank: 30, permissions: ['produccion:read', 'produccion:write', 'inventario:read', 'compras:read'] },
    { key: 'vendedor', label: 'Vendedor/a', rank: 40, permissions: ['pos:read', 'pos:write', 'caja:read', 'clientes:read', 'clientes:write', 'catalogos:read'] },
  ],

  /* ─── Hotelería ─────────────────────────────────────────────────────── */
  'hoteleria-hotel': [
    { key: 'recepcion', label: 'Recepción', rank: 30, permissions: ['hoteleria:read', 'hoteleria:write', 'clientes:read', 'clientes:write', 'calendario:read', 'calendario:write', 'facturacion:read', 'caja:read', 'caja:write'] },
    { key: 'ama', label: 'Ama de llaves', rank: 40, permissions: ['hoteleria:read', 'mantenimiento:read', 'inventario:read'] },
    { key: 'mantenimiento', label: 'Mantenimiento', rank: 50, permissions: ['mantenimiento:read', 'mantenimiento:write', 'inventario:read'] },
  ],
  'hoteleria-hostal': [
    { key: 'recepcion', label: 'Recepción', rank: 30, permissions: ['hoteleria:read', 'hoteleria:write', 'clientes:read', 'clientes:write', 'facturacion:read', 'caja:read', 'caja:write'] },
    { key: 'ama', label: 'Ama de llaves', rank: 40, permissions: ['hoteleria:read'] },
  ],
  'hoteleria-finca': [
    { key: 'recepcion', label: 'Recepción', rank: 30, permissions: ['hoteleria:read', 'hoteleria:write', 'clientes:read', 'clientes:write', 'facturacion:read', 'caja:read', 'caja:write', 'calendario:read', 'calendario:write'] },
    { key: 'guia', label: 'Guía de campo', rank: 40, permissions: ['agro:read', 'hoteleria:read'] },
  ],
  'hoteleria-operador': [
    { key: 'agente', label: 'Agente de viajes', rank: 30, permissions: ['clientes:read', 'clientes:write', 'cotizaciones:read', 'cotizaciones:write', 'contratos:read', 'contratos:write', 'calendario:read', 'calendario:write', 'facturacion:read'] },
    { key: 'operador', label: 'Operador/a de itinerario', rank: 40, permissions: ['proyectos:read', 'proyectos:write', 'calendario:read', 'calendario:write'] },
  ],

  /* ─── Fitness y bienestar ───────────────────────────────────────────── */
  'fitness-gimnasio': [
    { key: 'instructor', label: 'Instructor/a', rank: 30, permissions: ['socios:read', 'calendario:read', 'calendario:write', 'canales:read'] },
    { key: 'recepcionista', label: 'Recepcionista', rank: 40, permissions: ['socios:read', 'socios:write', 'clientes:read', 'clientes:write', 'calendario:read', 'calendario:write', 'caja:read', 'caja:write', 'facturacion:read'] },
    { key: 'sala', label: 'Encargado/a de sala', rank: 50, permissions: ['socios:read', 'socios:write', 'inventario:read', 'mantenimiento:read'] },
  ],
  'fitness-estudio': [
    { key: 'instructor', label: 'Instructor/a', rank: 30, permissions: ['socios:read', 'calendario:read', 'calendario:write'] },
    { key: 'recepcionista', label: 'Recepcionista', rank: 40, permissions: ['socios:read', 'socios:write', 'clientes:read', 'clientes:write', 'calendario:read', 'calendario:write', 'caja:read', 'caja:write', 'facturacion:read'] },
  ],
  'fitness-spa': [
    { key: 'terapeuta', label: 'Terapeuta', rank: 30, permissions: ['socios:read', 'calendario:read', 'catalogos:read', 'cotizaciones:read'] },
    { key: 'recepcionista', label: 'Recepcionista', rank: 40, permissions: ['socios:read', 'socios:write', 'clientes:read', 'clientes:write', 'calendario:read', 'calendario:write', 'caja:read', 'caja:write', 'pos:read', 'pos:write', 'facturacion:read'] },
  ],
  'fitness-centro': [
    { key: 'terapeuta', label: 'Terapeuta', rank: 30, permissions: ['socios:read', 'pacientes:read', 'pacientes:write', 'calendario:read'] },
    { key: 'recepcionista', label: 'Recepcionista', rank: 40, permissions: ['socios:read', 'socios:write', 'pacientes:read', 'clientes:read', 'clientes:write', 'calendario:read', 'calendario:write', 'caja:read', 'caja:write', 'facturacion:read'] },
  ],

  /* ─── Agro ──────────────────────────────────────────────────────────── */
  'agro-permanente': [
    { key: 'administrador', label: 'Administrador/a de finca', rank: 30, permissions: ['agro:read', 'agro:write', 'inventario:read', 'inventario:write', 'compras:read', 'compras:write', 'mantenimiento:read', 'flota:read'] },
    { key: 'tecnico', label: 'Técnico/a de campo', rank: 40, permissions: ['agro:read', 'agro:write', 'trazabilidad:read'] },
    { key: 'capataz', label: 'Capataz', rank: 50, permissions: ['agro:read', 'agro:write', 'asistencia:read', 'asistencia:write'] },
  ],
  'agro-transitorio': [
    { key: 'administrador', label: 'Administrador/a de finca', rank: 30, permissions: ['agro:read', 'agro:write', 'inventario:read', 'inventario:write', 'compras:read', 'compras:write', 'produccion:read', 'produccion:write', 'mantenimiento:read', 'flota:read'] },
    { key: 'tecnico', label: 'Técnico/a de campo', rank: 40, permissions: ['agro:read', 'agro:write', 'produccion:read'] },
    { key: 'capataz', label: 'Capataz', rank: 50, permissions: ['agro:read', 'agro:write', 'asistencia:read', 'asistencia:write'] },
  ],
  'agro-ganaderia': [
    { key: 'administrador', label: 'Administrador/a de finca', rank: 30, permissions: ['agro:read', 'agro:write', 'produccion:read', 'produccion:write', 'inventario:read', 'inventario:write', 'compras:read', 'compras:write', 'mantenimiento:read'] },
    { key: 'veterinario', label: 'Veterinario/a de campo', rank: 40, permissions: ['agro:read', 'agro:write', 'trazabilidad:read', 'produccion:read'] },
    { key: 'capataz', label: 'Capataz', rank: 50, permissions: ['agro:read', 'agro:write', 'asistencia:read', 'asistencia:write'] },
  ],
  'agro-poscosecha': [
    { key: 'administrador', label: 'Administrador/a', rank: 30, permissions: ['agro:read', 'agro:write', 'produccion:read', 'produccion:write', 'inventario:read', 'inventario:write', 'compras:read', 'compras:write', 'catalogos:read', 'catalogos:write'] },
    { key: 'calidad', label: 'Supervisor/a de calidad', rank: 40, permissions: ['trazabilidad:read', 'produccion:read', 'agro:read'] },
    { key: 'operario', label: 'Operario/a', rank: 50, permissions: ['produccion:read', 'produccion:write', 'agro:read'] },
  ],

  /* ─── Construcción ──────────────────────────────────────────────────── */
  'construccion-civil': [
    { key: 'residente', label: 'Residente de obra', rank: 30, permissions: ['proyectos:read', 'proyectos:write', 'riesgos:read', 'hseq:read', 'calendario:read'] },
    { key: 'almacenista', label: 'Almacenista', rank: 40, permissions: ['inventario:read', 'inventario:write', 'compras:read', 'proyectos:read'] },
    { key: 'administrativo', label: 'Administrativo/a de obra', rank: 50, permissions: ['clientes:read', 'facturacion:read', 'contratos:read', 'documentos:read', 'flota:read'] },
  ],
  'construccion-mep': [
    { key: 'ingeniero', label: 'Ingeniero/a', rank: 30, permissions: ['proyectos:read', 'proyectos:write', 'catalogos:read', 'catalogos:write', 'cotizaciones:read', 'cotizaciones:write', 'compras:read'] },
    { key: 'instalador', label: 'Instalador/a', rank: 40, permissions: ['proyectos:read', 'catalogos:read', 'inventario:read'] },
    { key: 'almacenista', label: 'Almacenista', rank: 50, permissions: ['inventario:read', 'inventario:write', 'compras:read', 'proyectos:read'] },
  ],
  'construccion-remodel': [
    { key: 'disenador', label: 'Diseñador/a', rank: 30, permissions: ['proyectos:read', 'proyectos:write', 'cotizaciones:read', 'cotizaciones:write', 'catalogos:read', 'clientes:read', 'clientes:write'] },
    { key: 'oficial', label: 'Oficial de obra', rank: 40, permissions: ['proyectos:read', 'inventario:read'] },
    { key: 'administrativo', label: 'Administrativo/a', rank: 50, permissions: ['clientes:read', 'facturacion:read', 'cotizaciones:read', 'documentos:read'] },
  ],
  'construccion-interv': [
    { key: 'supervisor', label: 'Supervisor/a', rank: 30, permissions: ['proyectos:read', 'proyectos:write', 'trazabilidad:read', 'riesgos:read', 'calendario:read'] },
    { key: 'inspector', label: 'Inspector/a', rank: 40, permissions: ['trazabilidad:read', 'proyectos:read', 'documentos:read', 'firmas:read'] },
    { key: 'coordinador', label: 'Coordinador/a', rank: 50, permissions: ['proyectos:read', 'proyectos:write', 'clientes:read', 'calendario:read', 'calendario:write'] },
  ],

  /* ─── Manufactura ───────────────────────────────────────────────────── */
  'manufactura-metal': [
    { key: 'jefe-produccion', label: 'Jefe/a de producción', rank: 30, permissions: ['produccion:read', 'produccion:write', 'inventario:read', 'compras:read', 'proyectos:read'] },
    { key: 'operario', label: 'Operario/a', rank:40, permissions: ['produccion:read', 'inventario:read', 'asistencia:read'] },
    { key: 'calidad', label: 'Control de calidad', rank: 50, permissions: ['produccion:read', 'inventario:read'] },
  ],
  'manufactura-plastico': [
    { key: 'jefe-produccion', label: 'Jefe/a de producción', rank: 30, permissions: ['produccion:read', 'produccion:write', 'inventario:read', 'compras:read'] },
    { key: 'operario', label: 'Operario/a', rank: 40, permissions: ['produccion:read', 'inventario:read'] },
    { key: 'calidad', label: 'Control de calidad', rank: 50, permissions: ['trazabilidad:read', 'produccion:read'] },
  ],
  'manufactura-textil': [
    { key: 'disenador', label: 'Diseñador/a', rank: 30, permissions: ['catalogos:read', 'catalogos:write', 'produccion:read', 'tienda:read'] },
    { key: 'patronista', label: 'Patronista', rank: 40, permissions: ['produccion:read', 'produccion:write', 'catalogos:read'] },
    { key: 'despachador', label: 'Despachador/a', rank: 50, permissions: ['tienda:read', 'inventario:read', 'facturacion:read'] },
  ],
  'manufactura-alimentos': [
    { key: 'jefe-produccion', label: 'Jefe/a de producción', rank: 30, permissions: ['produccion:read', 'produccion:write', 'inventario:read', 'compras:read'] },
    { key: 'operario', label: 'Operario/a', rank: 40, permissions: ['produccion:read', 'inventario:read'] },
    { key: 'calidad', label: 'Control de calidad', rank: 50, permissions: ['trazabilidad:read', 'produccion:read'] },
  ],

  /* ─── Servicios profesionales ───────────────────────────────────────── */
  'servicios-consultoria': [
    { key: 'consultor', label: 'Consultor/a', rank: 30, permissions: ['proyectos:read', 'proyectos:write', 'consultoria:read', 'consultoria:write', 'clientes:read', 'cotizaciones:read', 'calendario:read'] },
    { key: 'analista', label: 'Analista', rank: 40, permissions: ['proyectos:read', 'consultoria:read', 'documentos:read'] },
    { key: 'gerente-cuenta', label: 'Gerente/a de cuenta', rank: 50, permissions: ['clientes:read', 'clientes:write', 'facturacion:read', 'contratos:read', 'desempeno:read'] },
  ],
  'servicios-contable': [
    { key: 'contador', label: 'Contador/a', rank: 30, permissions: ['clientes:read', 'clientes:write', 'facturacion:read', 'facturacion:write', 'trazabilidad:read', 'documentos:read'] },
    { key: 'auxiliar', label: 'Auxiliar contable', rank: 40, permissions: ['clientes:read', 'facturacion:read', 'trazabilidad:read'] },
    { key: 'socio', label: 'Socio/a', rank: 50, permissions: ['clientes:read', 'clientes:write', 'cotizaciones:read', 'cotizaciones:write', 'firmas:read', 'calendario:read'] },
  ],
  'servicios-legal': [
    { key: 'abogado', label: 'Abogado/a', rank: 30, permissions: ['clientes:read', 'clientes:write', 'contratos:read', 'contratos:write', 'firmas:read', 'firmas:write', 'trazabilidad:read', 'calendario:read'] },
    { key: 'paralegal', label: 'Paralegal', rank: 40, permissions: ['clientes:read', 'documentos:read', 'documentos:write', 'trazabilidad:read', 'calendario:read'] },
  ],
  'servicios-agencia': [
    { key: 'creativo', label: 'Creativo/a', rank: 30, permissions: ['proyectos:read', 'proyectos:write', 'clientes:read', 'documentos:read', 'calendario:read'] },
    { key: 'ejecutivo-cuenta', label: 'Ejecutivo/a de cuenta', rank: 40, permissions: ['clientes:read', 'clientes:write', 'cotizaciones:read', 'cotizaciones:write', 'proyectos:read', 'calendario:read'] },
    { key: 'reclutador', label: 'Reclutador/a', rank: 50, permissions: ['reclutamiento:read', 'reclutamiento:write', 'desempeno:read', 'clientes:read'] },
  ],
  'servicios-ti': [
    { key: 'ingeniero', label: 'Ingeniero/a', rank: 30, permissions: ['proyectos:read', 'proyectos:write', 'clientes:read', 'inventario:read', 'tickets:read', 'tickets:write'] },
    { key: 'soporte', label: 'Soporte', rank: 40, permissions: ['tickets:read', 'tickets:write', 'clientes:read', 'inventario:read'] },
    { key: 'gerente', label: 'Gerente/a', rank: 50, permissions: ['clientes:read', 'clientes:write', 'facturacion:read', 'desempeno:read', 'cotizaciones:read'] },
  ],

  /* ─── Logística ─────────────────────────────────────────────────────── */
  'logistica-carga': [
    { key: 'conductor', label: 'Conductor/a', rank: 30, permissions: ['flota:read', 'calendario:read', 'documentos:read'] },
    { key: 'despachador', label: 'Despachador/a', rank: 40, permissions: ['flota:read', 'flota:write', 'inventario:read', 'calendario:read', 'calendario:write'] },
    { key: 'comercial', label: 'Comercial', rank: 50, permissions: ['clientes:read', 'clientes:write', 'contratos:read', 'facturacion:read', 'cotizaciones:read'] },
  ],
  'logistica-ultima': [
    { key: 'repartidor', label: 'Repartidor/a', rank: 30, permissions: ['flota:read', 'tienda:read', 'ecommerce:read', 'calendario:read'] },
    { key: 'despachador', label: 'Despachador/a', rank: 40, permissions: ['flota:read', 'flota:write', 'inventario:read', 'ecommerce:read', 'calendario:read', 'calendario:write'] },
    { key: 'soporte', label: 'Soporte al cliente', rank: 50, permissions: ['clientes:read', 'clientes:write', 'tickets:read', 'tickets:write', 'ecommerce:read'] },
  ],
  'logistica-bodegaje': [
    { key: 'jefe-bodega', label: 'Jefe/a de bodega', rank: 30, permissions: ['inventario:read', 'inventario:write', 'compras:read', 'calendario:read'] },
    { key: 'operario', label: 'Operario/a', rank: 40, permissions: ['inventario:read', 'asistencia:read'] },
    { key: 'comercial', label: 'Comercial', rank: 50, permissions: ['clientes:read', 'clientes:write', 'contratos:read', 'facturacion:read'] },
  ],

  /* ─── Inmobiliario ──────────────────────────────────────────────────── */
  'inmobiliario-arriendo': [
    { key: 'asesor', label: 'Asesor/a', rank: 30, permissions: ['inmobiliario:read', 'inmobiliario:write', 'clientes:read', 'clientes:write', 'contratos:read', 'contratos:write', 'calendario:read'] },
    { key: 'administrador', label: 'Administrador/a', rank: 40, permissions: ['inmobiliario:read', 'inmobiliario:write', 'facturacion:read', 'mantenimiento:read', 'tickets:read'] },
    { key: 'conserje', label: 'Conserje', rank: 50, permissions: ['mantenimiento:read', 'mantenimiento:write', 'tickets:read', 'tickets:write', 'calendario:read'] },
  ],
  'inmobiliario-ph': [
    { key: 'administrador', label: 'Administrador/a', rank: 30, permissions: ['inmobiliario:read', 'inmobiliario:write', 'facturacion:read', 'contratos:read', 'tickets:read', 'tickets:write', 'calendario:read'] },
    { key: 'consejo', label: 'Consejo de administración', rank: 40, permissions: ['documentos:read', 'firmas:read', 'calendario:read'] },
    { key: 'conserje', label: 'Conserje', rank: 50, permissions: ['mantenimiento:read', 'mantenimiento:write', 'riesgos:read', 'hseq:read', 'tickets:read', 'tickets:write'] },
  ],
  'inmobiliario-corretaje': [
    { key: 'agente', label: 'Agente inmobiliario/a', rank: 30, permissions: ['inmobiliario:read', 'inmobiliario:write', 'clientes:read', 'clientes:write', 'calendario:read', 'calendario:write'] },
    { key: 'coordinador', label: 'Coordinador/a', rank: 40, permissions: ['inmobiliario:read', 'clientes:read', 'clientes:write', 'desempeno:read', 'documentos:read'] },
    { key: 'cierre', label: 'Gestor/a de cierre', rank: 50, permissions: ['clientes:read', 'contratos:read', 'contratos:write', 'facturacion:read', 'firmas:read', 'firmas:write'] },
  ],

  /* ─── Educación ─────────────────────────────────────────────────────── */
  'educacion-colegio': [
    { key: 'docente', label: 'Docente', rank: 30, permissions: ['estudiantes:read', 'estudiantes:write', 'capacitacion:read', 'calendario:read', 'canales:read'] },
    { key: 'coordinador', label: 'Coordinador/a', rank: 40, permissions: ['estudiantes:read', 'estudiantes:write', 'desempeno:read', 'calendario:read', 'calendario:write'] },
    { key: 'secretaria', label: 'Secretaría', rank: 50, permissions: ['estudiantes:read', 'estudiantes:write', 'clientes:read', 'facturacion:read', 'documentos:read', 'calendario:read', 'calendario:write'] },
  ],
  'educacion-instituto': [
    { key: 'docente', label: 'Docente', rank: 30, permissions: ['estudiantes:read', 'estudiantes:write', 'capacitacion:read', 'calendario:read'] },
    { key: 'coordinador', label: 'Coordinador/a', rank: 40, permissions: ['estudiantes:read', 'estudiantes:write', 'proyectos:read', 'calendario:read', 'calendario:write'] },
    { key: 'admisiones', label: 'Admisiones', rank: 50, permissions: ['estudiantes:read', 'estudiantes:write', 'clientes:read', 'clientes:write', 'facturacion:read'] },
  ],
  'educacion-academia': [
    { key: 'instructor', label: 'Instructor/a', rank: 30, permissions: ['estudiantes:read', 'estudiantes:write', 'capacitacion:read', 'capacitacion:write', 'calendario:read'] },
    { key: 'recepcion', label: 'Recepción', rank: 40, permissions: ['estudiantes:read', 'clientes:read', 'clientes:write', 'facturacion:read', 'calendario:read', 'calendario:write'] },
  ],
  'educacion-universidad': [
    { key: 'docente', label: 'Docente', rank: 30, permissions: ['estudiantes:read', 'estudiantes:write', 'calendario:read', 'canales:read'] },
    { key: 'coordinador', label: 'Coordinador/a', rank: 40, permissions: ['estudiantes:read', 'estudiantes:write', 'desempeno:read', 'calendario:read', 'calendario:write', 'proyectos:read'] },
    { key: 'admisiones', label: 'Admisiones', rank: 50, permissions: ['estudiantes:read', 'estudiantes:write', 'clientes:read', 'clientes:write', 'facturacion:read', 'reclutamiento:read', 'trazabilidad:read'] },
  ],

  /* ─── Sectores sin subsectores ──────────────────────────────────────── */
  'energia': [
    { key: 'ingeniero', label: 'Ingeniero/a de proyecto', rank: 30, permissions: ['proyectos:read', 'proyectos:write', 'catalogos:read', 'cotizaciones:read'] },
    { key: 'tecnico', label: 'Técnico/a de campo', rank: 40, permissions: ['proyectos:read', 'mantenimiento:read', 'inventario:read'] },
    { key: 'hse', label: 'Supervisor/a HSE', rank: 50, permissions: ['riesgos:read', 'riesgos:write', 'hseq:read', 'hseq:write'] },
  ],
  'ecommerce': [
    { key: 'gestor', label: 'Gestor/a de tienda', rank: 30, permissions: ['tienda:read', 'tienda:write', 'ecommerce:read', 'ecommerce:write', 'catalogos:read', 'catalogos:write', 'inventario:read'] },
    { key: 'atencion', label: 'Atención al cliente', rank: 40, permissions: ['clientes:read', 'clientes:write', 'tickets:read', 'tickets:write', 'ecommerce:read'] },
    { key: 'despacho', label: 'Despacho', rank: 50, permissions: ['inventario:read', 'ecommerce:read', 'facturacion:read'] },
  ],
  'tecnologia': [
    { key: 'ingeniero', label: 'Ingeniero/a', rank: 30, permissions: ['proyectos:read', 'proyectos:write', 'clientes:read', 'tickets:read', 'tickets:write'] },
    { key: 'soporte', label: 'Soporte', rank: 40, permissions: ['tickets:read', 'tickets:write', 'proyectos:read'] },
    { key: 'gerente', label: 'Gerente/a', rank: 50, permissions: ['clientes:read', 'clientes:write', 'facturacion:read', 'desempeno:read', 'contratos:read'] },
  ],
  'financiero': [
    { key: 'asesor', label: 'Asesor/a', rank: 30, permissions: ['clientes:read', 'clientes:write', 'cotizaciones:read', 'cotizaciones:write', 'contratos:read'] },
    { key: 'riesgos', label: 'Analista de riesgos', rank: 40, permissions: ['riesgos:read', 'riesgos:write', 'trazabilidad:read'] },
    { key: 'cobranza', label: 'Cobranza', rank: 50, permissions: ['facturacion:read', 'facturacion:write', 'clientes:read'] },
  ],
  'mineria': [
    { key: 'ingeniero', label: 'Ingeniero/a de mina', rank: 30, permissions: ['proyectos:read', 'proyectos:write', 'riesgos:read', 'hseq:read'] },
    { key: 'hse', label: 'Supervisor/a HSE', rank: 40, permissions: ['riesgos:read', 'riesgos:write', 'hseq:read', 'hseq:write', 'trazabilidad:read'] },
    { key: 'almacenista', label: 'Almacenista', rank: 50, permissions: ['inventario:read', 'inventario:write', 'compras:read', 'flota:read'] },
  ],
  'telecomunicaciones': [
    { key: 'instalador', label: 'Técnico/a instalador/a', rank: 30, permissions: ['proyectos:read', 'tickets:read', 'tickets:write', 'inventario:read'] },
    { key: 'noc', label: 'Soporte de red', rank: 40, permissions: ['tickets:read', 'tickets:write', 'clientes:read', 'mantenimiento:read'] },
    { key: 'comercial', label: 'Comercial', rank: 50, permissions: ['clientes:read', 'clientes:write', 'facturacion:read', 'contratos:read'] },
  ],
  'seguridad': [
    { key: 'supervisor', label: 'Supervisor/a de puesto', rank: 30, permissions: ['asistencia:read', 'asistencia:write', 'riesgos:read', 'hseq:read', 'trazabilidad:read'] },
    { key: 'guarda', label: 'Guarda', rank: 40, permissions: ['asistencia:read', 'calendario:read'] },
    { key: 'comercial', label: 'Comercial', rank: 50, permissions: ['clientes:read', 'clientes:write', 'contratos:read', 'contratos:write', 'facturacion:read'] },
  ],
  'medios': [
    { key: 'creativo', label: 'Creativo/a', rank: 30, permissions: ['proyectos:read', 'proyectos:write', 'clientes:read', 'documentos:read'] },
    { key: 'productor', label: 'Productor/a', rank: 40, permissions: ['proyectos:read', 'proyectos:write', 'inventario:read', 'calendario:read', 'calendario:write'] },
    { key: 'comercial', label: 'Comercial', rank: 50, permissions: ['clientes:read', 'clientes:write', 'cotizaciones:read', 'cotizaciones:write', 'facturacion:read'] },
  ],
  'ong': [
    { key: 'coordinador', label: 'Coordinador/a de proyectos', rank: 30, permissions: ['proyectos:read', 'proyectos:write', 'capacitacion:read', 'trazabilidad:read'] },
    { key: 'voluntariado', label: 'Voluntariado', rank: 40, permissions: ['asistencia:read', 'calendario:read', 'canales:read'] },
    { key: 'finanzas', label: 'Finanzas', rank: 50, permissions: ['clientes:read', 'firmas:read', 'trazabilidad:read'] },
  ],
  'gobierno': [
    { key: 'contratista', label: 'Contratista', rank: 30, permissions: ['contratos:read', 'contratos:write', 'proyectos:read', 'proyectos:write', 'trazabilidad:read'] },
    { key: 'juridico', label: 'Jurídico/a', rank: 40, permissions: ['contratos:read', 'firmas:read', 'firmas:write', 'documentos:read', 'documentos:write'] },
    { key: 'supervision', label: 'Supervisión', rank: 50, permissions: ['proyectos:read', 'hseq:read', 'riesgos:read', 'trazabilidad:read'] },
  ],
}
