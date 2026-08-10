import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { dayCount } from '@/lib/domain'
import {
  PAGE_SIZE,
  pageRange,
  rosterFor,
  totalOf,
  type Page,
  type RosterEntry,
} from './shared'

/**
 * Absences and vacation balances, read through RLS.
 *
 * The screen used to hold four absences and six balances in `useState`, keyed
 * by the person's *name*, with dates as pre-formatted Spanish strings
 * ('16 jun 2026') — so nothing could be sorted, compared or counted, and the
 * day count was typed in rather than derived from the range.
 *
 * There was also a hardcoded 35-cell heatmap of June. It is gone: it charted
 * numbers nobody entered.
 */

export interface AusenciaRow {
  id: string
  code: string | null
  employeeId: string
  employeeName: string
  kind: string
  startsOn: string
  endsOn: string
  /** Inclusive day count, derived from the range rather than stored. */
  days: number
  status: string
  notes: string
}

export interface VacacionRow {
  employeeId: string
  employeeName: string
  year: number
  entitledDays: number
  takenDays: number
  /** What the old fixture called `disponibles`, computed rather than typed. */
  remainingDays: number
}

export interface AsistenciaData {
  ausencias: AusenciaRow[]
  /** Absences in the organization, of which `ausencias` is the first page. */
  ausenciasTotal: number
  vacaciones: VacacionRow[]
  roster: RosterEntry[]
  canWrite: boolean
  year: number
}

interface AbsenceRecord {
  id: string
  code: string | null
  employee_id: string
  kind: string
  starts_on: string
  ends_on: string
  status: string
  notes: string
  employees: { full_name: string } | null
}

interface BalanceRecord {
  employee_id: string
  year: number
  entitled_days: number
  taken_days: number
  employees: { full_name: string } | null
}

// The day count is shared with the client, which previews it while the dates
// are being picked — one implementation, in lib/domain.
export { dayCount }

/** One page of absences, newest range first. Used by the screen and its "load more". */
export async function getAusencias(offset = 0): Promise<Page<AusenciaRow>> {
  const member = await requirePermission('asistencia:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('absences')
    .select(
      'id, code, employee_id, kind, starts_on, ends_on, status, notes, employees ( full_name )',
      { count: 'exact' },
    )
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('starts_on', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[asistencia] getAusencias', error)
    return { rows: [], total: 0 }
  }

  return {
    rows: (data as unknown as AbsenceRecord[]).map(toAusencia),
    total: totalOf(count, data.length, from),
  }
}

function toAusencia(row: AbsenceRecord): AusenciaRow {
  return {
    id: row.id,
    code: row.code,
    employeeId: row.employee_id,
    employeeName: row.employees?.full_name ?? 'Alguien que ya no está en la organización',
    kind: row.kind,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    days: dayCount(row.starts_on, row.ends_on),
    status: row.status,
    notes: row.notes,
  }
}

export async function getAsistencia(): Promise<AsistenciaData> {
  const member = await requirePermission('asistencia:read')
  const supabase = await createClient()
  const year = new Date().getFullYear()

  const [absencesResult, balancesResult, roster] = await Promise.all([
    supabase
      .from('absences')
      .select(
        'id, code, employee_id, kind, starts_on, ends_on, status, notes, employees ( full_name )',
        { count: 'exact' },
      )
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('starts_on', { ascending: false })
      .range(...pageRange(0)),
    // One row per employee per year, so this is bounded by the directory
    // rather than by activity — it pages with the roster or not at all.
    supabase
      .from('vacation_balances')
      .select('employee_id, year, entitled_days, taken_days, employees ( full_name )')
      .eq('org_id', member.orgId)
      .eq('year', year)
      .limit(PAGE_SIZE),
    rosterFor(supabase, member),
  ])

  if (absencesResult.error) {
    console.error('[asistencia] getAsistencia', absencesResult.error)
    return { ausencias: [], ausenciasTotal: 0, vacaciones: [], roster: [], canWrite: false, year }
  }

  const ausencias = (absencesResult.data as unknown as AbsenceRecord[]).map(toAusencia)

  const vacaciones = (balancesResult.data as unknown as BalanceRecord[] ?? [])
    .map((row) => ({
      employeeId: row.employee_id,
      employeeName: row.employees?.full_name ?? 'Alguien que ya no está en la organización',
      year: row.year,
      entitledDays: Number(row.entitled_days),
      takenDays: Number(row.taken_days),
      remainingDays: Number(row.entitled_days) - Number(row.taken_days),
    }))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'es'))

  return {
    ausencias,
    ausenciasTotal: totalOf(absencesResult.count, ausencias.length),
    vacaciones,
    roster,
    canWrite: can(member.permissions, 'asistencia:write'),
    year,
  }
}
