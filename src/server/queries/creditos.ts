import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { scoped } from './shared'

/**
 * Créditos: préstamos, cuotas y mora.
 *
 * Un préstamo es una fila; sus cuotas, otras. La mora no se guarda: se deriva
 * de cuotas pendientes cuya fecha ya pasó, porque guardarla sería una segunda
 * verdad que puede discrepar de la primera. El encabezado responde «¿cuántas
 * cuotas están en mora?» y «¿cuánto suma eso?».
 */

export interface LoanRow {
  id: string
  clientId: string | null
  clientName: string | null
  amountCents: number
  interestRateBps: number
  termMonths: number
  startDate: string
  status: string
  notes: string | null
}

export interface InstallmentRow {
  id: string
  loanId: string
  number: number
  dueDate: string
  amountCents: number
  status: string
  paidAt: string | null
}

export interface CreditosData {
  /** Préstamos del módulo créditos, del más reciente al más viejo. */
  loans: LoanRow[]
  /** Cuotas de todos los préstamos de la empresa, por vencimiento. */
  installments: InstallmentRow[]
  /** Clientes vivos, para el selector de cliente. */
  clients: Array<{ id: string; name: string }>
  /** Cuotas pendientes cuya fecha ya pasó. */
  enMoraCount: number
  /** Suma vencida sin pagar, en centavos. */
  moraCents: number
}

interface LoanRecord {
  id: string
  client_id: string | null
  amount_cents: number
  interest_rate_bps: number
  term_months: number
  start_date: string
  status: string
  notes: string | null
  clients: { name: string } | null
}

interface InstallmentRecord {
  id: string
  loan_id: string
  number: number
  due_date: string
  amount_cents: number
  status: string
  paid_at: string | null
}

function toLoanRow(row: LoanRecord): LoanRow {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.clients?.name ?? null,
    amountCents: row.amount_cents,
    interestRateBps: row.interest_rate_bps,
    termMonths: row.term_months,
    startDate: row.start_date,
    status: row.status,
    notes: row.notes,
  }
}

function toInstallmentRow(row: InstallmentRecord): InstallmentRow {
  return {
    id: row.id,
    loanId: row.loan_id,
    number: row.number,
    dueDate: row.due_date,
    amountCents: row.amount_cents,
    status: row.status,
    paidAt: row.paid_at,
  }
}

export async function getCreditos(): Promise<CreditosData> {
  const member = await requirePermission('creditos:read')
  const supabase = await createClient()

  const [loansResult, installmentsResult, clientsResult] = await Promise.all([
    scoped(supabase, member, 'loans')
      .select(
        'id, client_id, amount_cents, interest_rate_bps, term_months, start_date, status, notes, ' +
          'clients ( name )',
      )
      .order('start_date', { ascending: false }),
    scoped(supabase, member, 'loan_installments')
      .select('id, loan_id, number, due_date, amount_cents, status, paid_at')
      .order('due_date', { ascending: true })
      .limit(500),
    scoped(supabase, member, 'clients')
      .select('id, name')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
  ])

  const loans = ((loansResult.data ?? []) as unknown as LoanRecord[]).map(toLoanRow)
  const installments = ((installmentsResult.data ?? []) as unknown as InstallmentRecord[]).map(
    toInstallmentRow,
  )

  const today = new Date().toISOString().slice(0, 10)
  const enMora = installments.filter(
    (i) => i.status === 'pendiente' && i.dueDate < today,
  )

  return {
    loans,
    installments,
    clients: (clientsResult.data ?? []) as unknown as Array<{ id: string; name: string }>,
    enMoraCount: enMora.length,
    moraCents: enMora.reduce((sum, i) => sum + i.amountCents, 0),
  }
}
