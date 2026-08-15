'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import {
  PURCHASE_CATEGORIES, PURCHASE_ORDER_STATUSES, PURCHASE_REQUEST_STATUSES, PURCHASE_URGENCIES,
} from '@/lib/domain'
import { belongsToOrg, currentEmployeeId } from '@/server/queries/shared'
import { getCompras, type ComprasData } from '@/server/queries/compras'

export type CompraResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

export type PurchaseRequestEvent = {
  id: string
  actorName: string | null
  note: string
  occurredAt: string
}

export async function fetchRequestEvents(
  purchaseRequestId: string,
): Promise<PurchaseRequestEvent[]> {
  try {
    await requirePermission('compras:read')
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('purchase_request_events')
      .select('id, note, occurred_at, employees ( full_name )')
      .eq('purchase_request_id', purchaseRequestId)
      .order('occurred_at', { ascending: true })
    if (error) {
      console.error('[compras] fetchRequestEvents', error)
      return []
    }
    return (data ?? []).map((row) => ({
      id: row.id,
      actorName: row.employees?.full_name ?? null,
      note: row.note,
      occurredAt: row.occurred_at,
    }))
  } catch {
    return []
  }
}

const itemSchema = z.object({
  productId: z.uuid().nullable().default(null),
  description: z.string().trim().min(1, 'Cada línea necesita una descripción.').max(300),
  quantity: z.number().positive('La cantidad debe ser mayor que cero.').max(1_000_000),
  unit: z.string().trim().max(10).default('UN'),
  unitCostCents: z.number().int().min(0, 'El costo no puede ser negativo.'),
})

const baseSchema = z.object({
  supplier: z.string().trim().max(160).default(''),
  projectId: z.uuid().nullable().default(null),
  ownerId: z.uuid().nullable().default(null),
  category: z.enum(PURCHASE_CATEGORIES).default('Materiales'),
  urgency: z.enum(PURCHASE_URGENCIES).default('Normal'),
  neededOn: z.string().date().nullable().default(null),
  notes: z.string().trim().max(4000).default(''),
  items: z.array(itemSchema).min(1, 'Agrega al menos una línea.').max(100),
})

const updateSchema = baseSchema.extend({ id: z.uuid() })

async function replaceItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestId: string,
  items: z.output<typeof itemSchema>[],
): Promise<boolean> {
  const { error: deleteError } = await supabase
    .from('purchase_request_items')
    .delete()
    .eq('purchase_request_id', requestId)
  if (deleteError) {
    console.error('[compras] replaceItems delete', deleteError)
    return false
  }

  const { error } = await supabase.from('purchase_request_items').insert(
    items.map((item, position) => ({
      purchase_request_id: requestId,
      product_id: item.productId,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_cost_cents: item.unitCostCents,
      position,
    })),
  )
  if (error) console.error('[compras] replaceItems insert', error)
  return !error
}

async function refsValid(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  projectId: string | null,
  ownerId: string | null,
): Promise<string | null> {
  if (!(await belongsToOrg(supabase, 'projects', projectId, orgId))) {
    return 'Ese proyecto no pertenece a tu organización.'
  }
  if (!(await belongsToOrg(supabase, 'employees', ownerId, orgId))) {
    return 'Esa persona no está en el equipo de tu organización.'
  }
  return null
}

export async function createCompra(
  input: z.input<typeof baseSchema>,
): Promise<CompraResult<ComprasData>> {
  try {
    const member = await requirePermission('compras:write')
    const parsed = baseSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const refError = await refsValid(supabase, member.orgId, parsed.data.projectId, parsed.data.ownerId)
    if (refError) return fail(refError)

    const { data: request, error } = await supabase
      .from('purchase_requests')
      .insert({
        org_id: member.orgId,
        supplier: parsed.data.supplier,
        project_id: parsed.data.projectId,
        owner_id: parsed.data.ownerId,
        category: parsed.data.category,
        status: 'Pendiente',
        urgency: parsed.data.urgency,
        needed_on: parsed.data.neededOn,
        notes: parsed.data.notes,
      })
      .select('id')
      .single()

    if (error || !request) {
      console.error('[compras] createCompra', error)
      return fail('No se pudo crear la requisición.')
    }

    if (!(await replaceItems(supabase, request.id, parsed.data.items))) {
      return fail('La requisición se creó pero sus líneas no se guardaron.')
    }

    revalidatePath('/dashboard/compras')
    return { ok: true, data: await getCompras() }
  } catch {
    return fail('No tienes permiso para gestionar compras.')
  }
}

export async function updateCompra(
  input: z.input<typeof updateSchema>,
): Promise<CompraResult<ComprasData>> {
  try {
    const member = await requirePermission('compras:write')
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    // An approved requisition has already produced an order; editing its lines
    // afterwards would leave the order quoting figures the requisition no
    // longer says.
    const { data: current } = await supabase
      .from('purchase_requests')
      .select('status')
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)
      .maybeSingle()

    if (current?.status === 'OC generada') {
      return fail('Esta requisición ya generó una orden de compra y no puede editarse.')
    }

    const refError = await refsValid(supabase, member.orgId, parsed.data.projectId, parsed.data.ownerId)
    if (refError) return fail(refError)

    const { error } = await supabase
      .from('purchase_requests')
      .update({
        supplier: parsed.data.supplier,
        project_id: parsed.data.projectId,
        owner_id: parsed.data.ownerId,
        category: parsed.data.category,
        urgency: parsed.data.urgency,
        needed_on: parsed.data.neededOn,
        notes: parsed.data.notes,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[compras] updateCompra', error)
      return fail('No se pudo actualizar la requisición.')
    }

    if (!(await replaceItems(supabase, parsed.data.id, parsed.data.items))) {
      return fail('No se pudieron guardar las líneas.')
    }

    revalidatePath('/dashboard/compras')
    return { ok: true, data: await getCompras() }
  } catch {
    return fail('No tienes permiso para gestionar compras.')
  }
}

const statusSchema = z.object({
  id: z.uuid(),
  status: z.enum(PURCHASE_REQUEST_STATUSES),
})

export async function setCompraStatus(
  input: z.input<typeof statusSchema>,
): Promise<CompraResult<ComprasData>> {
  try {
    const member = await requirePermission('compras:write')
    const parsed = statusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    // 'OC generada' is set by `generateOrder`, not chosen from a dropdown:
    // claiming an order exists without creating one is exactly the lie this
    // module was full of.
    if (parsed.data.status === 'OC generada') {
      return fail('Ese estado lo asigna la generación de la orden de compra.')
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('purchase_requests')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)
      .neq('status', 'OC generada')

    if (error) {
      console.error('[compras] setCompraStatus', error)
      return fail('No se pudo actualizar la requisición.')
    }

    const actorId = await currentEmployeeId(supabase, member.orgId, member.userId)
    const { error: eventError } = await supabase.from('purchase_request_events').insert({
      purchase_request_id: parsed.data.id,
      actor_id: actorId,
      note: `Estado cambiado a ${parsed.data.status}`,
    })
    if (eventError) console.error('[compras] setCompraStatus event', eventError)

    revalidatePath('/dashboard/compras')
    return { ok: true, data: await getCompras() }
  } catch {
    return fail('No tienes permiso para gestionar compras.')
  }
}

/**
 * Turn an approved requisition into a purchase order.
 *
 * This is the link the two screens always claimed and never had: the order
 * copies the requisition's lines, keeps `purchase_request_id` so the trail
 * survives, and the requisition moves to 'OC generada' so it cannot be turned
 * into a second order.
 */
export async function generateOrder(requestId: string): Promise<CompraResult<ComprasData>> {
  try {
    const member = await requirePermission('compras:write')
    if (!z.uuid().safeParse(requestId).success) return fail('Requisición desconocida.')

    const supabase = await createClient()
    const { data: request } = await supabase
      .from('purchase_requests')
      .select('id, status, supplier, project_id, needed_on, notes, purchase_request_items ( description, quantity, unit_cost_cents, product_id, position )')
      .eq('id', requestId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!request) return fail('Requisición desconocida.')
    if (request.status === 'OC generada') return fail('Esta requisición ya generó una orden.')
    if (request.status !== 'Aprobada') return fail('Solo una requisición aprobada puede generar una orden.')

    const items = (request.purchase_request_items ?? []) as Array<{
      description: string; quantity: number; unit_cost_cents: number
      product_id: string | null; position: number
    }>
    if (items.length === 0) return fail('La requisición no tiene líneas que ordenar.')

    const { data: order, error } = await supabase
      .from('purchase_orders')
      .insert({
        org_id: member.orgId,
        purchase_request_id: request.id,
        supplier: request.supplier || 'Por definir',
        project_id: request.project_id,
        status: 'Pendiente',
        due_on: request.needed_on,
        notes: request.notes,
      })
      .select('id')
      .single()

    if (error || !order) {
      console.error('[compras] generateOrder', error)
      return fail('No se pudo generar la orden de compra.')
    }

    const { error: itemsError } = await supabase.from('purchase_order_items').insert(
      items
        .sort((a, b) => a.position - b.position)
        .map((item, position) => ({
          purchase_order_id: order.id,
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          // The requisition's *cost* becomes the order's price: this is what
          // the company agreed to pay the supplier.
          unit_price_cents: item.unit_cost_cents,
          position,
        })),
    )

    if (itemsError) {
      console.error('[compras] generateOrder items', itemsError)
      return fail('La orden se creó pero sus líneas no se copiaron.')
    }

    await supabase
      .from('purchase_requests')
      .update({ status: 'OC generada' })
      .eq('id', request.id)
      .eq('org_id', member.orgId)

    revalidatePath('/dashboard/compras')
    revalidatePath('/dashboard/ordenes-compra')
    return { ok: true, data: await getCompras() }
  } catch {
    return fail('No tienes permiso para gestionar compras.')
  }
}

export async function deleteCompra(id: string): Promise<CompraResult<ComprasData>> {
  try {
    const member = await requirePermission('compras:write')
    if (!z.uuid().safeParse(id).success) return fail('Requisición desconocida.')

    const supabase = await createClient()
    const { count } = await supabase
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true })
      .eq('purchase_request_id', id)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)

    if ((count ?? 0) > 0) {
      return fail('Esta requisición ya tiene una orden de compra. Cancela la orden primero.')
    }

    const { error } = await supabase
      .from('purchase_requests')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[compras] deleteCompra', error)
      return fail('No se pudo eliminar la requisición.')
    }

    revalidatePath('/dashboard/compras')
    return { ok: true, data: await getCompras() }
  } catch {
    return fail('No tienes permiso para gestionar compras.')
  }
}

const orderStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(PURCHASE_ORDER_STATUSES),
})

export async function setOrdenStatus(
  input: z.input<typeof orderStatusSchema>,
): Promise<CompraResult<ComprasData>> {
  try {
    const member = await requirePermission('compras:write')
    const parsed = orderStatusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[compras] setOrdenStatus', error)
      return fail('No se pudo actualizar la orden.')
    }

    revalidatePath('/dashboard/ordenes-compra')
    revalidatePath('/dashboard/compras')
    return { ok: true, data: await getCompras() }
  } catch {
    return fail('No tienes permiso para gestionar compras.')
  }
}

export interface SupplierPaymentRow {
  id: string
  amountCents: number
  method: string
  reference: string
  paidOn: string | null
  scheduledOn: string | null
}

export interface SupplierInvoiceRow {
  id: string
  code: string | null
  supplier: string
  issuedOn: string
  status: string
  totalCents: number
  /** Suma de pagos hechos. */
  paidCents: number
  /** Lo que falta por pagar. */
  remainingCents: number
  /** Próximo pago programado, si hay. */
  nextScheduledOn: string | null
  payments: SupplierPaymentRow[]
}

interface SupplierInvoiceRecord {
  id: string
  code: string | null
  supplier: string
  issued_on: string
  status: string
  supplier_invoice_items: Array<{ subtotal_cents: number }> | null
  supplier_payments: Array<{
    id: string
    amount_cents: number
    method: string
    reference: string
    paid_on: string | null
    scheduled_on: string | null
  }> | null
}

const SUPPLIER_INVOICE_STATUSES = ['Pendiente', 'En revisión', 'Pagada', 'Anulada'] as const

const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, 'Cada línea necesita una descripción.').max(300),
  quantity: z.number().positive('La cantidad debe ser mayor que cero.').max(1_000_000),
  unitPriceCents: z.number().int().min(0, 'El precio no puede ser negativo.'),
})

const supplierInvoiceSchema = z.object({
  supplier: z.string().trim().min(2, 'El proveedor debe tener al menos 2 caracteres.').max(160),
  issuedOn: z.string().date('La fecha debe ser válida.'),
  items: z.array(invoiceItemSchema).min(1, 'Agrega al menos una línea.').max(100),
})

const invoiceStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(SUPPLIER_INVOICE_STATUSES),
})

function toSupplierInvoice(row: SupplierInvoiceRecord): SupplierInvoiceRow {
  const total = (row.supplier_invoice_items ?? []).reduce((s, i) => s + Number(i.subtotal_cents), 0)
  const payments: SupplierPaymentRow[] = (row.supplier_payments ?? []).map((p) => ({
    id: p.id,
    amountCents: Number(p.amount_cents),
    method: p.method,
    reference: p.reference,
    paidOn: p.paid_on,
    scheduledOn: p.scheduled_on,
  }))
  const paid = payments
    .filter((p) => p.paidOn !== null)
    .reduce((s, p) => s + p.amountCents, 0)
  const nextScheduled = payments
    .filter((p) => p.scheduledOn !== null)
    .map((p) => p.scheduledOn as string)
    .sort()[0] ?? null

  return {
    id: row.id,
    code: row.code,
    supplier: row.supplier,
    issuedOn: row.issued_on,
    status: row.status,
    totalCents: total,
    paidCents: paid,
    remainingCents: total - paid,
    nextScheduledOn: nextScheduled,
    payments,
  }
}

async function listSupplierInvoices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
): Promise<SupplierInvoiceRow[]> {
  const { data, error } = await supabase
    .from('supplier_invoices')
    .select('id, code, supplier, issued_on, status, supplier_invoice_items ( subtotal_cents ), supplier_payments ( id, amount_cents, method, reference, paid_on, scheduled_on )')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('issued_on', { ascending: false })

  if (error) {
    console.error('[compras] listSupplierInvoices', error)
    return []
  }
  return (data as unknown as SupplierInvoiceRecord[]).map(toSupplierInvoice)
}

export async function fetchSupplierInvoices(): Promise<CompraResult<SupplierInvoiceRow[]>> {
  try {
    const member = await requirePermission('compras:read')
    const supabase = await createClient()
    return { ok: true, data: await listSupplierInvoices(supabase, member.orgId) }
  } catch {
    return fail('No tienes permiso para consultar compras.')
  }
}

export async function createSupplierInvoice(
  input: z.input<typeof supplierInvoiceSchema>,
): Promise<CompraResult<SupplierInvoiceRow[]>> {
  try {
    const member = await requirePermission('compras:write')
    const parsed = supplierInvoiceSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { data: invoice, error } = await supabase
      .from('supplier_invoices')
      .insert({
        org_id: member.orgId,
        supplier: parsed.data.supplier,
        issued_on: parsed.data.issuedOn,
        status: 'Pendiente',
      })
      .select('id')
      .single()

    if (error || !invoice) {
      console.error('[compras] createSupplierInvoice', error)
      return fail('No se pudo crear la factura.')
    }

    const { error: itemsError } = await supabase.from('supplier_invoice_items').insert(
      parsed.data.items.map((item, position) => ({
        supplier_invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price_cents: item.unitPriceCents,
        position,
      })),
    )

    if (itemsError) {
      console.error('[compras] createSupplierInvoice items', itemsError)
      return fail('La factura se creó pero sus líneas no se guardaron.')
    }

    revalidatePath('/dashboard/compras')
    return { ok: true, data: await listSupplierInvoices(supabase, member.orgId) }
  } catch {
    return fail('No tienes permiso para gestionar compras.')
  }
}

export async function setSupplierInvoiceStatus(
  input: z.input<typeof invoiceStatusSchema>,
): Promise<CompraResult<SupplierInvoiceRow[]>> {
  try {
    const member = await requirePermission('compras:write')
    const parsed = invoiceStatusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('supplier_invoices')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)

    if (error) {
      console.error('[compras] setSupplierInvoiceStatus', error)
      return fail('No se pudo actualizar la factura.')
    }

    revalidatePath('/dashboard/compras')
    return { ok: true, data: await listSupplierInvoices(supabase, member.orgId) }
  } catch {
    return fail('No tienes permiso para gestionar compras.')
  }
}

export async function deleteSupplierInvoice(id: string): Promise<CompraResult<SupplierInvoiceRow[]>> {
  try {
    const member = await requirePermission('compras:write')
    if (!z.uuid().safeParse(id).success) return fail('Factura desconocida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('supplier_invoices')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)

    if (error) {
      console.error('[compras] deleteSupplierInvoice', error)
      return fail('No se pudo eliminar la factura.')
    }

    revalidatePath('/dashboard/compras')
    return { ok: true, data: await listSupplierInvoices(supabase, member.orgId) }
  } catch {
    return fail('No tienes permiso para gestionar compras.')
  }
}

const supplierPaymentSchema = z.object({
  invoiceId: z.uuid(),
  amountCents: z.number().int().min(1, 'El monto debe ser positivo.'),
  method: z.string().trim().max(60).default('Transferencia'),
  reference: z.string().trim().max(200).default(''),
  paidOn: z.string().date().nullable().default(null),
  scheduledOn: z.string().date().nullable().default(null),
})

/**
 * Registra un pago hecho o programado contra una factura de proveedor.
 *
 * El trabajo lo hace `register_supplier_payment` (migración 77): valida el
 * monto contra el saldo, inserta el pago y marca la factura Pagada cuando
 * queda cubierta — todo en una transacción. Esta función traduce los errores.
 */
export async function registerSupplierPayment(
  input: z.input<typeof supplierPaymentSchema>,
): Promise<CompraResult<SupplierInvoiceRow[]>> {
  try {
    const member = await requirePermission('compras:write')
    const parsed = supplierPaymentSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')
    if ((parsed.data.paidOn === null) === (parsed.data.scheduledOn === null)) {
      return fail('El pago es hecho o programado: elige una fecha u otra.')
    }

    const supabase = await createClient()
    const { error } = await supabase.rpc('register_supplier_payment', {
      p_invoice_id: parsed.data.invoiceId,
      p_amount_cents: parsed.data.amountCents,
      p_method: parsed.data.method,
      p_reference: parsed.data.reference,
      p_paid_on: parsed.data.paidOn,
      p_scheduled_on: parsed.data.scheduledOn,
    })

    if (error) {
      console.error('[compras] registerSupplierPayment', error)
      if (error.code === 'KG105') return fail('El pago supera el saldo de la factura.')
      if (error.code === 'KG104') return fail('Esta factura ya está cerrada.')
      if (error.code === 'KG103') return fail('La factura no existe o no puedes verla.')
      if (error.code === 'KG102') return fail('El pago es hecho o programado, no ambos.')
      if (error.code === 'KG101') return fail('El monto debe ser positivo.')
      return fail('No se pudo registrar el pago.')
    }

    revalidatePath('/dashboard/compras')
    return { ok: true, data: await listSupplierInvoices(supabase, member.orgId) }
  } catch {
    return fail('No tienes permiso para gestionar compras.')
  }
}

/** Cancela un pago programado (nunca uno hecho: el dinero ya salió). */
export async function cancelSupplierPayment(id: string): Promise<CompraResult<SupplierInvoiceRow[]>> {
  try {
    const member = await requirePermission('compras:write')
    if (!z.uuid().safeParse(id).success) return fail('Pago desconocido.')

    const supabase = await createClient()
    // Solo los programados: un pago hecho no se deshace desde aquí.
    const { error } = await supabase
      .from('supplier_payments')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)
      .not('scheduled_on', 'is', null)

    if (error) {
      console.error('[compras] cancelSupplierPayment', error)
      return fail('No se pudo cancelar el pago programado.')
    }

    revalidatePath('/dashboard/compras')
    return { ok: true, data: await listSupplierInvoices(supabase, member.orgId) }
  } catch {
    return fail('No tienes permiso para gestionar compras.')
  }
}
