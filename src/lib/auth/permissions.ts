/**
 * The single permission model.
 *
 * Two incompatible models used to coexist: verb-scoped keys (`ver_empleados`)
 * in lib/data/nav.ts, which nothing read, and module-scoped booleans in the
 * configuración page, which lived in localStorage and were therefore editable
 * by the user they were meant to restrict.
 *
 * There is now one vocabulary — `<module>:<action>` — and it is enforced in
 * three places: RLS policies in the database, `assertPermission` on the
 * server, and `can()` in the UI. The list below must stay in sync with the
 * `public.permissions` table (supabase/migrations/…_01_core.sql); the test in
 * src/lib/auth/permissions.test.ts pins that.
 */

export const PERMISSIONS = [
  'dashboard:read',
  'empleados:read',
  'empleados:write',
  'asistencia:read',
  'asistencia:write',
  'nomina:read',
  'nomina:write',
  'riesgos:read',
  'riesgos:write',
  'proyectos:read',
  'proyectos:write',
  'cotizaciones:read',
  'cotizaciones:write',
  'compras:read',
  'compras:write',
  'tienda:read',
  'tienda:write',
  'catalogos:read',
  'catalogos:write',
  'firmas:read',
  'firmas:write',
  'inventario:read',
  'inventario:write',
  'documentos:read',
  'documentos:write',
  'consultoria:read',
  'consultoria:write',
  'hseq:read',
  'hseq:write',
  'tickets:read',
  'tickets:write',
  'canales:read',
  'canales:write',
  'calendario:read',
  'calendario:write',
  'trazabilidad:read',
  'ia:use',
  'configuracion:read',
  'configuracion:manage',
] as const

export type Permission = (typeof PERMISSIONS)[number]

export const ROLES = ['Administrador', 'Líder de equipo', 'Empleado'] as const
export type RoleKey = (typeof ROLES)[number]

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value)
}

/** Maps a dashboard route segment to the permission needed to open it. */
export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  dashboard: 'dashboard:read',
  empleados: 'empleados:read',
  asistencia: 'asistencia:read',
  nomina: 'nomina:read',
  riesgos: 'riesgos:read',
  proyectos: 'proyectos:read',
  cotizaciones: 'cotizaciones:read',
  compras: 'compras:read',
  'ordenes-compra': 'compras:read',
  tienda: 'tienda:read',
  catalogos: 'catalogos:read',
  firmas: 'firmas:read',
  inventario: 'inventario:read',
  documentos: 'documentos:read',
  consultoria: 'consultoria:read',
  hseq: 'hseq:read',
  tickets: 'tickets:read',
  canales: 'canales:read',
  calendario: 'calendario:read',
  trazabilidad: 'trazabilidad:read',
  ia: 'ia:use',
  configuracion: 'configuracion:read',
}

/** Human labels for the configuración permission matrix. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  'dashboard:read': 'Ver dashboard',
  'empleados:read': 'Ver empleados',
  'empleados:write': 'Gestionar empleados',
  'asistencia:read': 'Ver asistencia',
  'asistencia:write': 'Gestionar asistencia',
  'nomina:read': 'Ver nómina',
  'nomina:write': 'Gestionar nómina',
  'riesgos:read': 'Ver riesgos',
  'riesgos:write': 'Gestionar riesgos',
  'proyectos:read': 'Ver proyectos',
  'proyectos:write': 'Gestionar proyectos',
  'cotizaciones:read': 'Ver cotizaciones',
  'cotizaciones:write': 'Gestionar cotizaciones',
  'compras:read': 'Ver compras',
  'compras:write': 'Gestionar compras',
  'tienda:read': 'Ver tienda',
  'tienda:write': 'Gestionar tienda',
  'catalogos:read': 'Ver catálogos',
  'catalogos:write': 'Gestionar catálogos',
  'firmas:read': 'Ver firmas',
  'firmas:write': 'Gestionar firmas',
  'inventario:read': 'Ver inventario',
  'inventario:write': 'Gestionar inventario',
  'documentos:read': 'Ver documentos',
  'documentos:write': 'Gestionar documentos',
  'consultoria:read': 'Ver consultoría',
  'consultoria:write': 'Gestionar consultoría',
  'hseq:read': 'Ver HSEQ',
  'hseq:write': 'Gestionar HSEQ',
  'tickets:read': 'Ver tickets',
  'tickets:write': 'Gestionar tickets',
  'canales:read': 'Ver canales',
  'canales:write': 'Gestionar canales',
  'calendario:read': 'Ver calendario',
  'calendario:write': 'Gestionar calendario',
  'trazabilidad:read': 'Ver trazabilidad',
  'ia:use': 'Usar el asistente de IA',
  'configuracion:read': 'Ver configuración',
  'configuracion:manage': 'Administrar la organización',
}

/** Groups permissions by module, for rendering the permission matrix. */
export function permissionsByModule(): Array<{ module: string; permissions: Permission[] }> {
  const groups = new Map<string, Permission[]>()
  for (const permission of PERMISSIONS) {
    const [module] = permission.split(':') as [string]
    const bucket = groups.get(module)
    if (bucket) bucket.push(permission)
    else groups.set(module, [permission])
  }
  return [...groups.entries()].map(([module, permissions]) => ({ module, permissions }))
}

/**
 * Pure predicate shared by server and client so both answer identically.
 * The server treats the answer as authoritative; the client only uses it to
 * avoid rendering controls that would be rejected anyway.
 */
export function can(granted: ReadonlySet<Permission> | readonly Permission[], permission: Permission): boolean {
  return Array.isArray(granted) ? granted.includes(permission) : (granted as ReadonlySet<Permission>).has(permission)
}
