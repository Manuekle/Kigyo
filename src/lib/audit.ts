/**
 * Audit-trail vocabulary shared by the server query and the client view.
 *
 * Kept out of `src/server/queries/audit.ts` deliberately: that module is
 * marked `server-only`, so importing a runtime value from it — a category
 * list, not just a type — would pull the whole server module into the client
 * bundle and fail the build.
 */

export const AUDIT_CATEGORIES = [
  'Todos', 'Firmas', 'Tickets', 'Inventario', 'Documentos', 'Empleados', 'Proyectos', 'Otros',
] as const

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number]

export interface AuditEntry {
  id: number
  actor: string
  action: string
  target: string
  category: AuditCategory
  /** Grouping label: "Hoy", "Ayer", or an explicit date. */
  group: string
  time: string
  occurredAt: string
  /** Field names that changed, for the detail line on updates. */
  changedFields: string[]
  destructive: boolean
}
