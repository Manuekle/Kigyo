import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import {
  currentEmployeeId,
  pageRange,
  rosterFor,
  totalOf,
  type Page,
  type RosterEntry,
} from './shared'

/**
 * Signature requests, read through RLS.
 *
 * The screen used to hold five requests in `useState` with the date as a
 * pre-formatted string and `days` — days overdue — typed in beside it, so a
 * document was "18 días" late forever. Signing flipped a local flag.
 *
 * `signature_requests` has `requested_on`, `due_on` and `signed_at`, and a
 * `signature_requests_signed_consistent` check that keeps 'Firmado' and
 * `signed_at` from disagreeing.
 */

export interface FirmaRow {
  id: string
  code: string | null
  title: string
  kind: string
  status: string
  signerId: string | null
  signerName: string | null
  signerEmail: string | null
  requestedOn: string
  dueOn: string | null
  signedAt: string | null
  documentId: string | null
  /** Negative while there is time left; positive once overdue. Derived. */
  daysOverdue: number | null
}

export interface FirmasData {
  firmas: FirmaRow[]
  /** Requests in the organization, of which `firmas` is the first page. */
  firmasTotal: number
  roster: RosterEntry[]
  canWrite: boolean
  /** The signed-in user's employee row — who can sign their own requests. */
  meEmployeeId: string | null
  meName: string
  meRole: string
}

interface RequestRecord {
  id: string
  code: string | null
  title: string
  kind: string
  status: string
  signer_id: string | null
  signer_email: string | null
  requested_on: string
  due_on: string | null
  signed_at: string | null
  document_id: string | null
  employees: { full_name: string } | null
}

/** Whole days past the due date. Null when nothing is due or already signed. */
function overdueDays(dueOn: string | null, signedAt: string | null): number | null {
  if (!dueOn || signedAt) return null
  const due = Date.parse(`${dueOn}T23:59:59Z`)
  if (Number.isNaN(due)) return null
  return Math.floor((Date.now() - due) / 86_400_000)
}

const REQUEST_COLUMNS = `id, code, title, kind, status, signer_id, signer_email, requested_on,
   due_on, signed_at, document_id, employees ( full_name )`

function toFirma(row: RequestRecord): FirmaRow {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    kind: row.kind,
    status: row.status,
    signerId: row.signer_id,
    signerName: row.employees?.full_name ?? null,
    signerEmail: row.signer_email,
    requestedOn: row.requested_on,
    dueOn: row.due_on,
    signedAt: row.signed_at,
    documentId: row.document_id,
    daysOverdue: overdueDays(row.due_on, row.signed_at),
  }
}

/** One page of signature requests, newest first. */
export async function getFirmasPage(offset = 0): Promise<Page<FirmaRow>> {
  const member = await requirePermission('firmas:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('signature_requests')
    .select(REQUEST_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('requested_on', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[firmas] getFirmasPage', error)
    return { rows: [], total: 0 }
  }

  return {
    rows: (data as unknown as RequestRecord[]).map(toFirma),
    total: totalOf(count, data.length, from),
  }
}

export async function getFirmas(): Promise<FirmasData> {
  const member = await requirePermission('firmas:read')
  const supabase = await createClient()

  const [requestsResult, roster, meId] = await Promise.all([
    supabase
      .from('signature_requests')
      .select(REQUEST_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('requested_on', { ascending: false })
      .range(...pageRange(0)),
    rosterFor(supabase, member),
    currentEmployeeId(supabase, member.orgId, member.userId),
  ])

  if (requestsResult.error) {
    console.error('[firmas] getFirmas', requestsResult.error)
    return {
      firmas: [], firmasTotal: 0, roster: [], canWrite: false,
      meEmployeeId: null, meName: member.fullName, meRole: member.role,
    }
  }

  const firmas = (requestsResult.data as unknown as RequestRecord[]).map(toFirma)

  return {
    firmas,
    firmasTotal: totalOf(requestsResult.count, firmas.length),
    roster,
    canWrite: can(member.permissions, 'firmas:write'),
    meEmployeeId: meId,
    meName: member.fullName,
    meRole: member.role,
  }
}
