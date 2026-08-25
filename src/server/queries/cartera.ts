import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { scoped } from './shared'

/**
 * Cartera: cuentas por cobrar y acuerdos de pago.
 *
 * Una fila es una deuda: cuánto deben, desde cuándo y en qué estado va el
 * cobro. La factura sigue siendo la fuente del cargo — cuando existe —, y el
 * cliente es quien debe; ambos son opcionales porque hay acuerdos verbales y
 * deudas que sobreviven al borrado de su factura o su cliente.
 *
 * El estado cuenta la historia del cobro: pendiente (aún no vence), vencida
 * (pasó la fecha), mora (vencida y ya escalada) y pagada (saldada, con su
 * fecha de pago). Las sumas del encabezado responden «¿cuánto hay por cobrar?»
 * y «¿cuánto de eso ya está vencido?».
 */

export interface DeudaRow {
  id: string
  invoiceId: string | null
  invoiceCode: string | null
  clientId: string | null
  clientName: string | null
  amountCents: number
  dueDate: string
  status: string
  paidAt: string | null
  notes: string | null
}

export interface CarteraData {
  /** Cuentas por cobrar, por estado y vencimiento. */
  debts: DeudaRow[]
  /** Clientes vivos, para el selector de cliente. */
  clients: Array<{ id: string; name: string }>
  /**
   * Facturas vivas, para el selector de factura.
   *
   * Con su saldo, su cliente y su vencimiento, y no solo el código. Antes eran
   * `{ id, code }` a secas, y eso convertía el selector en un adorno: quien
   * registraba una deuda elegía «FAC-0007» y tenía que ir a Facturación, mirar
   * cuánto quedaba debiendo y volver a teclearlo aquí. Dos lecturas de la misma
   * verdad escritas a mano son dos verdades: Facturación calcula su cartera
   * vencida desde `invoices` y esta pantalla desde `receivable_agreements`, así
   * que un dedo torcido las separa para siempre.
   */
  invoices: InvoiceOption[]
  /** Suma pendiente de cobro (pendiente + vencida + mora), en centavos. */
  pendienteCents: number
  /** Suma ya vencida (solo estado vencida), en centavos. */
  vencidaCents: number
}

/** Una factura como candidata a deuda: lo que hace falta para prellenar. */
export interface InvoiceOption {
  id: string
  code: string
  clientId: string | null
  clientName: string
  /** `total_cents - paid_cents`, la misma resta que hace Facturación. */
  balanceCents: number
  dueOn: string | null
}

interface DeudaRecord {
  id: string
  invoice_id: string | null
  client_id: string | null
  amount_cents: number
  due_date: string
  status: string
  paid_at: string | null
  notes: string | null
  invoices: { code: string | null } | null
  clients: { name: string } | null
}

function toDeudaRow(row: DeudaRecord): DeudaRow {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    invoiceCode: row.invoices?.code ?? null,
    clientId: row.client_id,
    clientName: row.clients?.name ?? null,
    amountCents: row.amount_cents,
    dueDate: row.due_date,
    status: row.status,
    paidAt: row.paid_at,
    notes: row.notes,
  }
}

const EN_MORA = new Set(['pendiente', 'vencida', 'mora'])

export async function getCartera(): Promise<CarteraData> {
  const member = await requirePermission('cartera:read')
  const supabase = await createClient()

  const [debtsResult, clientsResult, invoicesResult] = await Promise.all([
    scoped(supabase, member, 'receivable_agreements')
      .select(
        'id, invoice_id, client_id, amount_cents, due_date, status, paid_at, notes, ' +
          'invoices ( code ), clients ( name )',
      )
      .order('status')
      .order('due_date', { ascending: true }),
    scoped(supabase, member, 'clients')
      .select('id, name')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    scoped(supabase, member, 'invoices')
      .select('id, code, client_id, client_name, due_on, total_cents, paid_cents, status')
      .is('deleted_at', null)
      .order('code', { ascending: true }),
  ])

  const debts = ((debtsResult.data ?? []) as unknown as DeudaRecord[]).map(toDeudaRow)

  return {
    debts,
    clients: (clientsResult.data ?? []) as unknown as Array<{ id: string; name: string }>,
    invoices: ((invoicesResult.data ?? []) as unknown as Array<{
      id: string
      code: string | null
      client_id: string | null
      client_name: string
      due_on: string | null
      total_cents: number
      paid_cents: number
      status: string
    }>)
      // Un borrador no se cobra y una factura saldada tampoco: ofrecer
      // cualquiera de las dos como origen de una deuda es invitar a registrar
      // una que no existe. Misma regla que usa el envejecimiento de cartera en
      // Facturación (`collectable && balance > 0`).
      .filter((r) => r.status !== 'Borrador' && r.total_cents - r.paid_cents > 0)
      .map((r) => ({
        id: r.id,
        code: r.code ?? '',
        clientId: r.client_id,
        clientName: r.client_name,
        balanceCents: r.total_cents - r.paid_cents,
        dueOn: r.due_on,
      })),
    pendienteCents: debts.reduce((sum, d) => (EN_MORA.has(d.status) ? sum + d.amountCents : sum), 0),
    vencidaCents: debts.reduce((sum, d) => (d.status === 'vencida' ? sum + d.amountCents : sum), 0),
  }
}
