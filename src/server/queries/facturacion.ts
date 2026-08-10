import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import {
  allows, pageRange, totalOf, type Page, type Supabase,
} from './shared'
import type { Member } from '@/lib/auth/session'

/**
 * Invoices, their lines, and what has been paid against them.
 *
 * `total_cents` and `paid_cents` are stored rather than recomputed on read. An
 * invoice must keep the total it was issued with after a product's price
 * changes, and a view that re-derives it from today's catalogue quietly
 * rewrites the past. The lines are the audit trail; the header is the invoice.
 *
 * "Vencida" is derived here rather than stored, for the same reason `contratos`
 * derives "Por vencer": a status column is only correct on the day something
 * wrote it, and nothing runs daily to do that.
 */

export interface InvoiceRow {
  id: string
  code: string | null
  clientId: string | null
  clientName: string
  quoteId: string | null
  projectId: string | null
  status: string
  issuedOn: string
  dueOn: string | null
  subtotalCents: number
  taxCents: number
  totalCents: number
  paidCents: number
  currency: string
  notes: string
  /** Derived: `total_cents - paid_cents`. */
  balanceCents: number
  /** Derived: past due, issued and not fully paid. */
  overdue: boolean
  /** Derived: days past `due_on`, or null when not yet due. */
  daysOverdue: number | null
  items: number
}

export interface InvoiceItemRow {
  id: string
  invoiceId: string
  productId: string | null
  description: string
  quantity: number
  unitPriceCents: number
  taxRate: number
  position: number
}

export interface PaymentRow {
  id: string
  invoiceId: string
  amountCents: number
  method: string
  reference: string
  paidOn: string
}

export interface ClientRef {
  id: string
  name: string
}

export interface ProductRef {
  id: string
  sku: string
  name: string
  priceCents: number
}

export interface FacturacionData {
  facturas: InvoiceRow[]
  facturasTotal: number
  items: InvoiceItemRow[]
  pagos: PaymentRow[]
  clientes: ClientRef[]
  productos: ProductRef[]
  canWrite: boolean
}

interface InvoiceRecord {
  id: string
  code: string | null
  client_id: string | null
  client_name: string
  quote_id: string | null
  project_id: string | null
  status: string
  issued_on: string
  due_on: string | null
  subtotal_cents: number
  tax_cents: number
  total_cents: number
  paid_cents: number
  currency: string
  notes: string
}

interface ItemRecord {
  id: string
  invoice_id: string
  product_id: string | null
  description: string
  quantity: number
  unit_price_cents: number
  tax_rate: number
  position: number
}

interface PaymentRecord {
  id: string
  invoice_id: string
  amount_cents: number
  method: string
  reference: string
  paid_on: string
}

const COLUMNS = `id, code, client_id, client_name, quote_id, project_id, status, issued_on,
   due_on, subtotal_cents, tax_cents, total_cents, paid_cents, currency, notes`

function daysPast(iso: string | null): number | null {
  if (!iso) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - new Date(`${iso}T00:00:00`).getTime()) / 86_400_000)
  return diff > 0 ? diff : null
}

function toInvoice(row: InvoiceRecord, items: Map<string, number>): InvoiceRow {
  const balance = row.total_cents - row.paid_cents
  const late = daysPast(row.due_on)
  // Only an issued, unpaid invoice can be overdue. A draft past its due date is
  // a draft, and an annulled one is not a receivable at all.
  const collectable = row.status === 'Emitida' || row.status === 'Vencida'

  return {
    id: row.id,
    code: row.code,
    clientId: row.client_id,
    clientName: row.client_name,
    quoteId: row.quote_id,
    projectId: row.project_id,
    status: row.status,
    issuedOn: row.issued_on,
    dueOn: row.due_on,
    subtotalCents: row.subtotal_cents,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    paidCents: row.paid_cents,
    currency: row.currency,
    notes: row.notes,
    balanceCents: balance,
    overdue: collectable && balance > 0 && late !== null,
    daysOverdue: collectable && balance > 0 ? late : null,
    items: items.get(row.id) ?? 0,
  }
}

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
    console.error('[facturacion] clientsFor', error)
    return []
  }
  return (data ?? []).map((r) => ({ id: r.id, name: r.name }))
}

async function productsFor(supabase: Supabase, member: Member, limit = 200): Promise<ProductRef[]> {
  if (!allows(member, 'catalogos:read')) return []
  const { data, error } = await supabase
    .from('products')
    .select('id, sku, name, price_cents')
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(limit)
  if (error) {
    console.error('[facturacion] productsFor', error)
    return []
  }
  return (data ?? []).map((r) => ({
    id: r.id, sku: r.sku, name: r.name, priceCents: r.price_cents,
  }))
}

export async function getFacturasPage(offset = 0): Promise<Page<InvoiceRow>> {
  const member = await requirePermission('facturacion:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('invoices')
    .select(COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('issued_on', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[facturacion] getFacturasPage', error)
    return { rows: [], total: 0 }
  }

  const rows = data as unknown as InvoiceRecord[]
  const { data: itemRows } = await supabase
    .from('invoice_items')
    .select('id, invoice_id')
    .in('invoice_id', rows.map((r) => r.id))

  const counts = new Map<string, number>()
  for (const row of itemRows ?? []) {
    counts.set(row.invoice_id, (counts.get(row.invoice_id) ?? 0) + 1)
  }

  return {
    rows: rows.map((row) => toInvoice(row, counts)),
    total: totalOf(count, rows.length, from),
  }
}

export async function getFacturacion(): Promise<FacturacionData> {
  const member = await requirePermission('facturacion:read')
  const supabase = await createClient()

  const [invoicesResult, clientes, productos] = await Promise.all([
    supabase
      .from('invoices')
      .select(COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('issued_on', { ascending: false })
      .range(...pageRange(0)),
    clientsFor(supabase, member),
    productsFor(supabase, member),
  ])

  if (invoicesResult.error) {
    console.error('[facturacion] getFacturacion', invoicesResult.error)
    return {
      facturas: [], facturasTotal: 0, items: [], pagos: [],
      clientes: [], productos: [], canWrite: false,
    }
  }

  const rows = invoicesResult.data as unknown as InvoiceRecord[]
  const ids = rows.map((r) => r.id)

  const [itemsResult, paymentsResult] = await Promise.all([
    supabase
      .from('invoice_items')
      .select('id, invoice_id, product_id, description, quantity, unit_price_cents, tax_rate, position')
      .in('invoice_id', ids)
      .order('position', { ascending: true })
      .limit(1000),
    supabase
      .from('invoice_payments')
      .select('id, invoice_id, amount_cents, method, reference, paid_on')
      .in('invoice_id', ids)
      .order('paid_on', { ascending: false })
      .limit(500),
  ])

  if (itemsResult.error) console.error('[facturacion] items', itemsResult.error)
  if (paymentsResult.error) console.error('[facturacion] payments', paymentsResult.error)

  const itemRows = (itemsResult.data ?? []) as unknown as ItemRecord[]
  const counts = new Map<string, number>()
  for (const row of itemRows) {
    counts.set(row.invoice_id, (counts.get(row.invoice_id) ?? 0) + 1)
  }

  return {
    facturas: rows.map((row) => toInvoice(row, counts)),
    facturasTotal: totalOf(invoicesResult.count, rows.length),
    items: itemRows.map((row) => ({
      id: row.id,
      invoiceId: row.invoice_id,
      productId: row.product_id,
      description: row.description,
      quantity: row.quantity,
      unitPriceCents: row.unit_price_cents,
      taxRate: row.tax_rate,
      position: row.position,
    })),
    pagos: ((paymentsResult.data ?? []) as unknown as PaymentRecord[]).map((row) => ({
      id: row.id,
      invoiceId: row.invoice_id,
      amountCents: row.amount_cents,
      method: row.method,
      reference: row.reference,
      paidOn: row.paid_on,
    })),
    clientes,
    productos,
    canWrite: can(member.permissions, 'facturacion:write'),
  }
}
