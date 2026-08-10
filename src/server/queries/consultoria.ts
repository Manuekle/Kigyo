import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { pageRange, rosterFor, totalOf, type Page, type RosterEntry } from './shared'

/**
 * Advisory consultations, read through RLS.
 *
 * The screen used to hold four consultations in `useState` with the date as a
 * pre-formatted string ('Hoy', '22 jun'). "Agendar sesión" pushed a row into a
 * *second* local array and toasted "revisa el Calendario" — the calendar never
 * saw it, because nothing was written anywhere.
 *
 * Sessions are `calendar_events` of kind 'Consultoría' now, so that sentence
 * is true.
 */

export interface ConsultaRow {
  id: string
  code: string | null
  topic: string
  requesterId: string | null
  requesterName: string | null
  category: string
  advisor: string
  status: string
  answer: string
  scheduledAt: string | null
  createdAt: string
}

export interface SesionRow {
  id: string
  title: string
  startsAt: string
  endsAt: string
  location: string
}

export interface ConsultoriaData {
  consultas: ConsultaRow[]
  /** Consultations in the organization, of which `consultas` is the first page. */
  consultasTotal: number
  /** Upcoming 'Consultoría' events, when the caller can read the calendar. */
  sesiones: SesionRow[]
  roster: RosterEntry[]
  canWrite: boolean
  /** False when `calendario` is off or the role cannot write to it. */
  canSchedule: boolean
}

interface ConsultationRecord {
  id: string
  code: string | null
  topic: string
  requester_id: string | null
  category: string
  advisor: string
  status: string
  answer: string
  scheduled_at: string | null
  created_at: string
  employees: { full_name: string } | null
}

const CONSULTATION_COLUMNS = `id, code, topic, requester_id, category, advisor, status, answer,
   scheduled_at, created_at, employees ( full_name )`

function toConsulta(row: ConsultationRecord): ConsultaRow {
  return {
    id: row.id,
    code: row.code,
    topic: row.topic,
    requesterId: row.requester_id,
    requesterName: row.employees?.full_name ?? null,
    category: row.category,
    advisor: row.advisor,
    status: row.status,
    answer: row.answer,
    scheduledAt: row.scheduled_at,
    createdAt: row.created_at,
  }
}

/** One page of consultations, newest first. */
export async function getConsultasPage(offset = 0): Promise<Page<ConsultaRow>> {
  const member = await requirePermission('consultoria:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('consultations')
    .select(CONSULTATION_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[consultoria] getConsultasPage', error)
    return { rows: [], total: 0 }
  }

  return {
    rows: (data as unknown as ConsultationRecord[]).map(toConsulta),
    total: totalOf(count, data.length, from),
  }
}

export async function getConsultoria(): Promise<ConsultoriaData> {
  const member = await requirePermission('consultoria:read')
  const supabase = await createClient()

  // Scheduling writes a calendar event, so the button only appears when the
  // caller could actually create one. Offering it otherwise puts the failure
  // after the click instead of before it.
  const canSchedule =
    member.modules.has('calendario') && can(member.permissions, 'calendario:write')
  const canReadCalendar =
    member.modules.has('calendario') && can(member.permissions, 'calendario:read')

  const [consultationsResult, sessionsResult, roster] = await Promise.all([
    supabase
      .from('consultations')
      .select(CONSULTATION_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(...pageRange(0)),
    canReadCalendar
      ? supabase
          .from('calendar_events')
          .select('id, title, starts_at, ends_at, location')
          .eq('org_id', member.orgId)
          .eq('kind', 'Consultoría')
          .is('deleted_at', null)
          .gte('ends_at', new Date().toISOString())
          .order('starts_at', { ascending: true })
          .limit(10)
      : Promise.resolve({ data: [], error: null }),
    rosterFor(supabase, member),
  ])

  if (consultationsResult.error) {
    console.error('[consultoria] getConsultoria', consultationsResult.error)
    return {
      consultas: [], consultasTotal: 0, sesiones: [], roster: [],
      canWrite: false, canSchedule: false,
    }
  }

  const consultas = (consultationsResult.data as unknown as ConsultationRecord[]).map(toConsulta)

  return {
    consultas,
    consultasTotal: totalOf(consultationsResult.count, consultas.length),
    sesiones: ((sessionsResult.data ?? []) as Array<{
      id: string; title: string; starts_at: string; ends_at: string; location: string
    }>).map((s) => ({
      id: s.id,
      title: s.title,
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      location: s.location,
    })),
    roster,
    canWrite: can(member.permissions, 'consultoria:write'),
    canSchedule,
  }
}
