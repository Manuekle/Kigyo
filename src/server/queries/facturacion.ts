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

/**
 * One client's unpaid invoices, bucketed by how long they have been past due.
 *
 * «Corriente» means either not yet due or issued without a due date — the two
 * are the same thing to whoever is waiting to be paid. The buckets count
 * calendar days past `due_on`, the same clock the list uses for «Vencida».
 */
export interface AgingRow {
  clientId: string | null
  clientName: string
  invoices: number
  current: number
  d1to30: number
  d31to60: number
  d61to90: number
  over90: number
  total: number
}

export interface AgingBucketTotals {
  current: number
  d1to30: number
  d31to60: number
  d61to90: number
  over90: number
  total: number
}

export interface ProductRef {
  id: string
  sku: string
  name: string
  /** Precio CON IVA incluido — lo que se cobra en mostrador (migración 104). */
  priceCents: number
  /** Tasa del producto, para poder descontarla al pasar el precio a la línea. */
  taxRate: number
}

export interface FacturacionData {
  facturas: InvoiceRow[]
  facturasTotal: number
  items: InvoiceItemRow[]
  pagos: PaymentRow[]
  clientes: ClientRef[]
  productos: ProductRef[]
  aging: AgingRow[]
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
    .select('id, sku, name, price_cents, tax_rate')
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
    taxRate: Number(r.tax_rate),
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

function bucketOf(dueOn: string | null): keyof Omit<AgingRow, 'clientId' | 'clientName' | 'invoices' | 'total'> | null {
  const days = daysPast(dueOn)
  if (days === null) return 'current'
  if (days <= 30) return 'd1to30'
  if (days <= 60) return 'd31to60'
  if (days <= 90) return 'd61to90'
  return 'over90'
}

/**
 * Antigüedad de cartera, derivada: no hay tabla nueva, no hay columna nueva,
 * no hay nada que se pueda desincronizar. Las mismas facturas que la lista
 * marca vencidas son las que entran a los buckets.
 */
export async function getAging(member: Member, supabase: Supabase): Promise<AgingRow[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('id, client_id, client_name, status, due_on, total_cents, paid_cents')
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .in('status', ['Emitida', 'Vencida'])
    .limit(5000)

  if (error) {
    console.error('[facturacion] getAging', error)
    return []
  }

  const byClient = new Map<string, AgingRow>()
  for (const row of (data ?? []) as unknown as {
    client_id: string | null
    client_name: string
    due_on: string | null
    total_cents: number
    paid_cents: number
  }[]) {
    const balance = row.total_cents - row.paid_cents
    if (balance <= 0) continue
    const key = row.client_id ?? `walkin:${row.client_name}`
    const entry = byClient.get(key) ?? {
      clientId: row.client_id,
      clientName: row.client_name,
      invoices: 0,
      current: 0, d1to30: 0, d31to60: 0, d61to90: 0, over90: 0,
      total: 0,
    }
    entry.invoices += 1
    entry[bucketOf(row.due_on) ?? 'current'] += balance
    entry.total += balance
    byClient.set(key, entry)
  }

  return [...byClient.values()].sort((a, b) => b.total - a.total)
}

export async function getFacturacion(): Promise<FacturacionData> {
  const member = await requirePermission('facturacion:read')
  const supabase = await createClient()

  const [invoicesResult, clientes, productos, aging] = await Promise.all([
    supabase
      .from('invoices')
      .select(COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('issued_on', { ascending: false })
      .range(...pageRange(0)),
    clientsFor(supabase, member),
    productsFor(supabase, member),
    getAging(member, supabase),
  ])

  if (invoicesResult.error) {
    console.error('[facturacion] getFacturacion', invoicesResult.error)
    return {
      facturas: [], facturasTotal: 0, items: [], pagos: [],
      clientes: [], productos: [], aging: [], canWrite: false,
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
    aging,
    canWrite: can(member.permissions, 'facturacion:write'),
  }
}
