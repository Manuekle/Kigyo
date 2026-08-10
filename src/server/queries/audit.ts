import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import type { AuditCategory, AuditEntry } from '@/lib/audit'

export type { AuditCategory, AuditEntry }

/**
 * The audit trail behind the trazabilidad screen.
 *
 * Rows are written by the `app.audit_row()` trigger on every business table,
 * not by application code — an audit log the app can forget to write is not an
 * audit log. RLS scopes reads to the caller's organization and to holders of
 * `trazabilidad:read`, and nothing may update or delete a row.
 */

/** Table name → the category chip shown in the UI. */
const TABLE_CATEGORY: Record<string, AuditCategory> = {
  signature_requests: 'Firmas',
  tickets: 'Tickets',
  inventory_assets: 'Inventario',
  inventory_orders: 'Inventario',
  supplier_invoices: 'Inventario',
  documents: 'Documentos',
  document_folders: 'Documentos',
  employees: 'Empleados',
  absences: 'Empleados',
  evaluations: 'Empleados',
  departures: 'Empleados',
  job_openings: 'Empleados',
  projects: 'Proyectos',
  quotes: 'Proyectos',
  purchase_requests: 'Proyectos',
  purchase_orders: 'Proyectos',
}

/** Table name → a human noun, so entries read as sentences. */
const TABLE_NOUN: Record<string, string> = {
  signature_requests: 'la solicitud de firma',
  tickets: 'el ticket',
  inventory_assets: 'el activo',
  inventory_orders: 'el pedido',
  supplier_invoices: 'la factura',
  documents: 'el documento',
  document_folders: 'la carpeta',
  employees: 'el empleado',
  absences: 'la ausencia',
  evaluations: 'la evaluación',
  departures: 'la salida',
  job_openings: 'la vacante',
  projects: 'el proyecto',
  quotes: 'la cotización',
  purchase_requests: 'la requisición',
  purchase_orders: 'la orden de compra',
  risks: 'el riesgo',
  hseq_reports: 'el reporte HSEQ',
  calendar_events: 'el evento',
  consultations: 'la consultoría',
  channels: 'el canal',
  products: 'el producto',
  benefits: 'el beneficio',
  payroll_periods: 'el periodo de nómina',
  courses: 'el curso',
  certifications: 'la certificación',
  surveys: 'la encuesta',
  recommendations: 'la recomendación',
  vacation_balances: 'el saldo de vacaciones',
}

const ACTION_VERB = {
  insert: 'creó',
  update: 'actualizó',
  delete: 'eliminó',
} as const

function groupLabel(date: Date): string {
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.floor((startOfToday.getTime() - new Date(
    date.getFullYear(), date.getMonth(), date.getDate(),
  ).getTime()) / 86_400_000)

  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** One screenful of the trail, plus the cursor that continues it. */
export interface AuditPage {
  entries: AuditEntry[]
  /** Id to pass as `before` for the next page; null once the trail ends. */
  nextCursor: number | null
}

/**
 * @param options.before Keyset cursor — the id of the oldest entry already
 *   shown. Paging by offset would repeat and skip rows here: the trail grows
 *   while it is being read, and every new row shifts the window by one.
 */
export async function getAuditLog(
  options: { limit?: number; before?: number } = {},
): Promise<AuditPage> {
  await requirePermission('trazabilidad:read')
  const supabase = await createClient()

  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500)

  // Ordered by id, not `occurred_at`, because the cursor has to be a total
  // order: rows written by one transaction share a timestamp to the
  // microsecond, and a tie there loses or duplicates entries at the seam.
  // `id` is a sequence on an append-only table, so it sorts the same way.
  let query = supabase
    .from('audit_log')
    .select('id, actor_email, action, table_name, record_code, changes, occurred_at')
    .order('id', { ascending: false })
    .limit(limit)

  if (options.before !== undefined) query = query.lt('id', options.before)

  const { data, error } = await query

  if (error) {
    console.error('[audit] read failed', error)
    return { entries: [], nextCursor: null }
  }

  const entries = data.map((row) => {
    const occurredAt = new Date(row.occurred_at)
    const noun = TABLE_NOUN[row.table_name] ?? `el registro (${row.table_name})`
    const changes = (row.changes ?? {}) as Record<string, unknown>

    return {
      id: row.id,
      // A deleted profile leaves actor_id null but keeps the denormalised
      // email, and system-driven rows (triggers, cron) have neither.
      actor: row.actor_email ?? 'Sistema',
      action: `${ACTION_VERB[row.action]} ${noun}`,
      target: row.record_code ?? '',
      category: TABLE_CATEGORY[row.table_name] ?? 'Otros',
      group: groupLabel(occurredAt),
      time: occurredAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }),
      occurredAt: row.occurred_at,
      changedFields:
        row.action === 'update'
          ? Object.keys(changes).filter((key) => key !== 'before' && key !== 'after')
          : [],
      destructive: row.action === 'delete',
    }
  })

  // A short page is the end of the trail. A full one only means there may be
  // more — one extra request that comes back empty is cheaper than a count.
  return {
    entries,
    nextCursor: entries.length === limit ? entries[entries.length - 1].id : null,
  }
}

/** Groups entries by day label, preserving the newest-first ordering. */
export function groupAuditEntries(entries: AuditEntry[]): { group: string; items: AuditEntry[] }[] {
  const groups: { group: string; items: AuditEntry[] }[] = []
  for (const entry of entries) {
    const last = groups[groups.length - 1]
    if (last && last.group === entry.group) last.items.push(entry)
    else groups.push({ group: entry.group, items: [entry] })
  }
  return groups
}
