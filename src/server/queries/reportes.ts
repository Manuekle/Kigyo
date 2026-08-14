import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import type { Supabase } from './shared'

/**
 * Reportes: vistas guardadas por módulo y periodo.
 *
 * Un reporte guardado es un nombre sobre una pantalla: qué módulo, qué
 * periodo y una nota de quién lo guardó. `saved_reports` guarda la vista;
 * la exportación CSV sale de las tablas del módulo con el filtro de periodo.
 */

export interface ReportRow {
  id: string
  name: string
  moduleKey: string
  period: string
  notes: string | null
  createdAt: string
}

export interface ReportesData {
  /** Reportes guardados, el más reciente primero. */
  reports: ReportRow[]
  /** Módulos que esta empresa tiene activos y que se pueden exportar. */
  moduleOptions: string[]
}

/** Módulos exportables a CSV, de la lista fija de exportables. */
export const EXPORTABLE_MODULES = [
  'clientes', 'facturacion', 'compras', 'caja', 'pos', 'tiempos',
  'suscripciones', 'cartera', 'pacientes', 'estudiantes', 'tickets',
] as const

interface SavedReportRecord {
  id: string
  name: string
  module_key: string
  period: string
  notes: string | null
  created_at: string
}

/**
 * Client sin tipar: `saved_reports` aún no está en los tipos generados (la
 * migración 51 no ha llegado a la base desde la que se generan). Mismo escape
 * que `rawClient` en mutations/pacientes.ts; se quita al regenerar tipos.
 */
function rawClient(supabase: Supabase): SupabaseClient {
  return supabase as unknown as SupabaseClient
}

export async function getReportes(): Promise<ReportesData> {
  const member = await requirePermission('reportes:read')
  const supabase = await createClient()
  const client = rawClient(supabase)

  const { data } = await client
    .from('saved_reports')
    .select('id, name, module_key, period, notes, created_at')
    .eq('org_id', member.orgId)
    .order('created_at', { ascending: false })

  const reports = ((data ?? []) as unknown as SavedReportRecord[]).map((row) => ({
    id: row.id,
    name: row.name,
    moduleKey: row.module_key,
    period: row.period,
    notes: row.notes,
    createdAt: row.created_at,
  }))

  return {
    reports,
    moduleOptions: EXPORTABLE_MODULES.filter((key) => member.modules.has(key)),
  }
}
