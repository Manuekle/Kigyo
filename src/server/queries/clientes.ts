import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { pageRange, rosterFor, totalOf, type Page, type RosterEntry } from './shared'

/**
 * The customer record the rest of the commercial modules point at.
 *
 * Before this, `quotes.client` and every invoice were free text. Two documents
 * for the same company spelled differently were two companies, so nothing
 * could answer what an account was worth, who owned it, or when anyone last
 * spoke to them. That last question is what `client_interactions` exists for:
 * a CRM without a history of contact is an address book.
 */

export interface ClientRow {
  id: string
  code: string | null
  name: string
  legalName: string
  taxId: string
  kind: string
  status: string
  industry: string
  email: string | null
  phone: string
  address: string
  city: string
  ownerId: string | null
  creditLimitCents: number
  paymentTermsDays: number
  notes: string
  /** Contacts and interactions recorded against this account. */
  contacts: number
  lastInteractionAt: string | null
}

export interface ContactRow {
  id: string
  clientId: string
  fullName: string
  position: string
  email: string | null
  phone: string
  isPrimary: boolean
}

export interface InteractionRow {
  id: string
  clientId: string
  clientName: string
  kind: string
  subject: string
  detail: string
  employeeId: string | null
  happenedAt: string
  followUpOn: string | null
}

export interface ClientesData {
  clientes: ClientRow[]
  clientesTotal: number
  contactos: ContactRow[]
  interacciones: InteractionRow[]
  roster: RosterEntry[]
  canWrite: boolean
}

interface ClientRecord {
  id: string
  code: string | null
  name: string
  legal_name: string
  tax_id: string
  kind: string
  status: string
  industry: string
  email: string | null
  phone: string
  address: string
  city: string
  owner_id: string | null
  credit_limit_cents: number
  payment_terms_days: number
  notes: string
}

interface ContactRecord {
  id: string
  client_id: string
  full_name: string
  position: string
  email: string | null
  phone: string
  is_primary: boolean
}

interface InteractionRecord {
  id: string
  client_id: string
  kind: string
  subject: string
  detail: string
  employee_id: string | null
  happened_at: string
  follow_up_on: string | null
}

const CLIENT_COLUMNS = `id, code, name, legal_name, tax_id, kind, status, industry, email,
   phone, address, city, owner_id, credit_limit_cents, payment_terms_days, notes`

function toClient(
  row: ClientRecord,
  contacts: Map<string, number>,
  lastSeen: Map<string, string>,
): ClientRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    legalName: row.legal_name,
    taxId: row.tax_id,
    kind: row.kind,
    status: row.status,
    industry: row.industry,
    email: row.email,
    phone: row.phone,
    address: row.address,
    city: row.city,
    ownerId: row.owner_id,
    creditLimitCents: row.credit_limit_cents,
    paymentTermsDays: row.payment_terms_days,
    notes: row.notes,
    contacts: contacts.get(row.id) ?? 0,
    lastInteractionAt: lastSeen.get(row.id) ?? null,
  }
}

export async function getClientesPage(offset = 0): Promise<Page<ClientRow>> {
  const member = await requirePermission('clientes:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('clients')
    .select(CLIENT_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('[clientes] getClientesPage', error)
    return { rows: [], total: 0 }
  }

  const rows = data as unknown as ClientRecord[]
  const ids = rows.map((r) => r.id)

  const [{ data: contactRows }, { data: interactionRows }] = await Promise.all([
    supabase.from('client_contacts').select('id, client_id').in('client_id', ids),
    supabase
      .from('client_interactions')
      .select('client_id, happened_at')
      .in('client_id', ids)
      .order('happened_at', { ascending: false }),
  ])

  const contacts = new Map<string, number>()
  for (const row of contactRows ?? []) {
    contacts.set(row.client_id, (contacts.get(row.client_id) ?? 0) + 1)
  }

  // Ordered descending, so the first row seen per client is the most recent.
  const lastSeen = new Map<string, string>()
  for (const row of interactionRows ?? []) {
    if (!lastSeen.has(row.client_id)) lastSeen.set(row.client_id, row.happened_at)
  }

  return {
    rows: rows.map((row) => toClient(row, contacts, lastSeen)),
    total: totalOf(count, rows.length, from),
  }
}

export async function getClientes(): Promise<ClientesData> {
  const member = await requirePermission('clientes:read')
  const supabase = await createClient()

  const [clientsResult, roster] = await Promise.all([
    supabase
      .from('clients')
      .select(CLIENT_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .range(...pageRange(0)),
    rosterFor(supabase, member),
  ])

  if (clientsResult.error) {
    console.error('[clientes] getClientes', clientsResult.error)
    return { clientes: [], clientesTotal: 0, contactos: [], interacciones: [], roster: [], canWrite: false }
  }

  const clientRows = clientsResult.data as unknown as ClientRecord[]
  const ids = clientRows.map((r) => r.id)
  const names = new Map(clientRows.map((r) => [r.id, r.name]))

  const [contactsResult, interactionsResult] = await Promise.all([
    supabase
      .from('client_contacts')
      .select('id, client_id, full_name, position, email, phone, is_primary')
      .in('client_id', ids)
      .order('is_primary', { ascending: false })
      .limit(500),
    supabase
      .from('client_interactions')
      .select('id, client_id, kind, subject, detail, employee_id, happened_at, follow_up_on')
      .in('client_id', ids)
      .order('happened_at', { ascending: false })
      .limit(300),
  ])

  if (contactsResult.error) console.error('[clientes] contacts', contactsResult.error)
  if (interactionsResult.error) console.error('[clientes] interactions', interactionsResult.error)

  const contactRows = (contactsResult.data ?? []) as unknown as ContactRecord[]
  const interactionRows = (interactionsResult.data ?? []) as unknown as InteractionRecord[]

  const contactCounts = new Map<string, number>()
  for (const row of contactRows) {
    contactCounts.set(row.client_id, (contactCounts.get(row.client_id) ?? 0) + 1)
  }
  const lastSeen = new Map<string, string>()
  for (const row of interactionRows) {
    if (!lastSeen.has(row.client_id)) lastSeen.set(row.client_id, row.happened_at)
  }

  return {
    clientes: clientRows.map((row) => toClient(row, contactCounts, lastSeen)),
    clientesTotal: totalOf(clientsResult.count, clientRows.length),
    contactos: contactRows.map((row) => ({
      id: row.id,
      clientId: row.client_id,
      fullName: row.full_name,
      position: row.position,
      email: row.email,
      phone: row.phone,
      isPrimary: row.is_primary,
    })),
    interacciones: interactionRows.map((row) => ({
      id: row.id,
      clientId: row.client_id,
      clientName: names.get(row.client_id) ?? '',
      kind: row.kind,
      subject: row.subject,
      detail: row.detail,
      employeeId: row.employee_id,
      happenedAt: row.happened_at,
      followUpOn: row.follow_up_on,
    })),
    roster,
    canWrite: can(member.permissions, 'clientes:write'),
  }
}
