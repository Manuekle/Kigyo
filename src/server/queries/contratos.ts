import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import {
  allows, pageRange, rosterFor, totalOf,
  type Page, type RosterEntry, type Supabase,
} from './shared'
import type { Member } from '@/lib/auth/session'
import { daysUntil, todayIn } from '@/lib/domain'

/**
 * Contracts, their milestones, and — above all — when they expire.
 *
 * `notice_days` is per contract rather than a global setting because a
 * twelve-month lease and a two-week service agreement do not deserve the same
 * warning. "Por vencer" is derived from it at read time instead of being a
 * stored status: a status column would only be correct on the day something
 * wrote it, and nothing runs daily to do that.
 */

export interface ContractRow {
  id: string
  code: string | null
  title: string
  kind: string
  status: string
  counterparty: string
  clientId: string | null
  clientName: string
  employeeId: string | null
  ownerId: string | null
  valueCents: number
  startsOn: string | null
  endsOn: string | null
  noticeDays: number
  autoRenew: boolean
  notes: string
  /** Derived: days until `ends_on`, negative once past. Null when open-ended. */
  daysLeft: number | null
  /** Derived: inside the notice window and not already finished. */
  expiringSoon: boolean
  milestones: number
  milestonesDone: number
}

export interface MilestoneRow {
  id: string
  contractId: string
  title: string
  dueOn: string | null
  amountCents: number
  completedAt: string | null
  position: number
}

export interface ClientRef {
  id: string
  name: string
}

export interface ContratosData {
  contratos: ContractRow[]
  contratosTotal: number
  hitos: MilestoneRow[]
  clientes: ClientRef[]
  roster: RosterEntry[]
  canWrite: boolean
}

interface ContractRecord {
  id: string
  code: string | null
  title: string
  kind: string
  status: string
  counterparty: string
  client_id: string | null
  employee_id: string | null
  owner_id: string | null
  value_cents: number
  starts_on: string | null
  ends_on: string | null
  notice_days: number
  auto_renew: boolean
  notes: string
}

interface MilestoneRecord {
  id: string
  contract_id: string
  title: string
  due_on: string | null
  amount_cents: number
  completed_at: string | null
  position: number
}

const COLUMNS = `id, code, title, kind, status, counterparty, client_id, employee_id, owner_id,
   value_cents, starts_on, ends_on, notice_days, auto_renew, notes`

/**
 * `hoy` entra por parámetro y no se lee del reloj del servidor.
 *
 * Antes había aquí una copia local de `daysUntil` que usaba `new Date()`, o sea
 * la fecha UTC de la máquina: un contrato que vence mañana se leía «vence hoy»
 * desde las 19:00 en Bogotá. Es el mismo corte de día que se corrigió en el
 * resto del producto.
 */
function toContract(
  row: ContractRecord,
  clientNames: Map<string, string>,
  milestones: Map<string, { total: number; done: number }>,
  hoy: string,
): ContractRow {
  const daysLeft = daysUntil(row.ends_on, hoy)
  const live = row.status === 'Vigente' || row.status === 'Por vencer'
  const counts = milestones.get(row.id) ?? { total: 0, done: 0 }

  return {
    id: row.id,
    code: row.code,
    title: row.title,
    kind: row.kind,
    status: row.status,
    counterparty: row.counterparty,
    clientId: row.client_id,
    clientName: row.client_id ? clientNames.get(row.client_id) ?? '' : '',
    employeeId: row.employee_id,
    ownerId: row.owner_id,
    valueCents: row.value_cents,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    noticeDays: row.notice_days,
    autoRenew: row.auto_renew,
    notes: row.notes,
    daysLeft,
    expiringSoon: live && daysLeft !== null && daysLeft <= row.notice_days,
    milestones: counts.total,
    milestonesDone: counts.done,
  }
}

function tallyMilestones(rows: MilestoneRecord[]): Map<string, { total: number; done: number }> {
  const counts = new Map<string, { total: number; done: number }>()
  for (const row of rows) {
    const entry = counts.get(row.contract_id) ?? { total: 0, done: 0 }
    entry.total += 1
    if (row.completed_at !== null) entry.done += 1
    counts.set(row.contract_id, entry)
  }
  return counts
}

/** Client accounts, when the caller can read them. Same contract as `rosterFor`. */
async function clientsFor(supabase: Supabase, member: Member, limit = 200): Promise<ClientRef[]> {
  if (!allows(member, 'clientes:read')) return []

  const { data, error } = await supabase
    .from('clients')
    .select('id, name')
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[contratos] clientsFor', error)
    return []
  }
  return (data ?? []).map((r) => ({ id: r.id, name: r.name }))
}

export async function getContratosPage(offset = 0): Promise<Page<ContractRow>> {
  const member = await requirePermission('contratos:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('contracts')
    .select(COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('ends_on', { ascending: true, nullsFirst: false })
    .range(from, to)

  if (error) {
    console.error('[contratos] getContratosPage', error)
    return { rows: [], total: 0 }
  }

  const rows = data as unknown as ContractRecord[]
  const [{ data: milestoneRows }, clients] = await Promise.all([
    supabase
      .from('contract_milestones')
      .select('id, contract_id, title, due_on, amount_cents, completed_at, position')
      .in('contract_id', rows.map((r) => r.id)),
    clientsFor(supabase, member),
  ])

  const names = new Map(clients.map((c) => [c.id, c.name]))
  const counts = tallyMilestones((milestoneRows ?? []) as unknown as MilestoneRecord[])

  return {
    rows: rows.map((row) => toContract(row, names, counts, todayIn(member.orgTimezone))),
    total: totalOf(count, rows.length, from),
  }
}

export async function getContratos(): Promise<ContratosData> {
  const member = await requirePermission('contratos:read')
  const supabase = await createClient()

  const [contractsResult, clientes, roster] = await Promise.all([
    supabase
      .from('contracts')
      .select(COLUMNS, { count: 'exact' })
      // Soonest to expire first: the whole point of the screen is the top of
      // this list, and open-ended contracts belong at the bottom.
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('ends_on', { ascending: true, nullsFirst: false })
      .range(...pageRange(0)),
    clientsFor(supabase, member),
    rosterFor(supabase, member),
  ])

  if (contractsResult.error) {
    console.error('[contratos] getContratos', contractsResult.error)
    return { contratos: [], contratosTotal: 0, hitos: [], clientes: [], roster: [], canWrite: false }
  }

  const rows = contractsResult.data as unknown as ContractRecord[]
  const { data: milestoneData, error: milestoneError } = await supabase
    .from('contract_milestones')
    .select('id, contract_id, title, due_on, amount_cents, completed_at, position')
    .in('contract_id', rows.map((r) => r.id))
    .order('position', { ascending: true })
    .limit(500)

  if (milestoneError) console.error('[contratos] milestones', milestoneError)

  const milestoneRows = (milestoneData ?? []) as unknown as MilestoneRecord[]
  const names = new Map(clientes.map((c) => [c.id, c.name]))

  return {
    contratos: rows.map((row) => toContract(row, names, tallyMilestones(milestoneRows), todayIn(member.orgTimezone))),
    contratosTotal: totalOf(contractsResult.count, rows.length),
    hitos: milestoneRows.map((row) => ({
      id: row.id,
      contractId: row.contract_id,
      title: row.title,
      dueOn: row.due_on,
      amountCents: row.amount_cents,
      completedAt: row.completed_at,
      position: row.position,
    })),
    clientes,
    roster,
    canWrite: can(member.permissions, 'contratos:write'),
  }
}
