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
}
