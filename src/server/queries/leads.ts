import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import {
  pageRange, rosterFor, totalOf, type Page, type RosterEntry,
} from './shared'

/**
 * Leads, their activities, and the people who own them.
 *
 * A lead is the phase of the deal before there is a deal: a name, an origin
 * and a stage. The stage is the same five-answer question every CRM asks, and
 * the activities are the history that explains why the stage is what it is.
 * Converting is a one-way RPC (`leads_convert`): the client is born and the
 * lead is marked Convertido in one transaction, and `convertedClientId` keeps
 * the trace.
 */

export interface LeadActivityRow {
  id: string
  kind: string
  note: string
  occurredAt: string
}

export interface LeadRow {
  id: string
  name: string
  companyName: string
  email: string
  phone: string
  source: string
  stage: string
  ownerId: string | null
  ownerName: string | null
  lostReason: string
  notes: string
  convertedClientId: string | null
  createdAt: string
  activities: LeadActivityRow[]
}

export interface LeadsData {
  leads: LeadRow[]
  leadsTotal: number
  /** Puestos por etapa, para los contadores del encabezado. */
  byStage: Record<string, number>
  roster: RosterEntry[]
  canWrite: boolean
}

interface LeadRecord {
  id: string
  name: string
  company_name: string
  email: string
  phone: string
  source: string
  stage: string
  owner_id: string | null
  lost_reason: string
  notes: string
  converted_client_id: string | null
  created_at: string
  employees: { full_name: string } | null
  lead_activities: Array<{
    id: string
    kind: string
    note: string
    occurred_at: string
  }> | null
}

const LEAD_COLUMNS = `id, name, company_name, email, phone, source, stage, owner_id,
   lost_reason, notes, converted_client_id, created_at,
   employees ( full_name ),
   lead_activities ( id, kind, note, occurred_at )`

function toLead(row: LeadRecord): LeadRow {
  return {
    id: row.id,
    name: row.name,
    companyName: row.company_name,
    email: row.email,
    phone: row.phone,
    source: row.source,
    stage: row.stage,
    ownerId: row.owner_id,
    ownerName: row.employees?.full_name ?? null,
    lostReason: row.lost_reason,
    notes: row.notes,
    convertedClientId: row.converted_client_id,
    createdAt: row.created_at,
    activities: (row.lead_activities ?? [])
      .map((a) => ({
        id: a.id,
        kind: a.kind,
        note: a.note,
        occurredAt: a.occurred_at,
      }))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
  }
}

export async function getLeadsPage(offset = 0): Promise<Page<LeadRow>> {
  const member = await requirePermission('leads:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('leads')
    .select(LEAD_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[leads] getLeadsPage', error)
    return { rows: [], total: 0 }
  }

  return {
    rows: ((data ?? []) as LeadRecord[]).map(toLead),
    total: totalOf(count, (data ?? []).length, from),
  }
}

export async function getLeads(): Promise<LeadsData> {
  const member = await requirePermission('leads:read')
  const supabase = await createClient()

  const [page, rosterRows] = await Promise.all([
    getLeadsPage(0),
    rosterFor(supabase, member),
  ])

  const byStage: Record<string, number> = {}
  for (const lead of page.rows) {
    byStage[lead.stage] = (byStage[lead.stage] ?? 0) + 1
  }

  return {
    leads: page.rows,
    leadsTotal: page.total,
    byStage,
    roster: rosterRows,
    canWrite: can(member.permissions, 'leads:write'),
  }
}
