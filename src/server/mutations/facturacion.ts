'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { maybePostAutoEntry } from '@/server/contabilidad-auto'
import { INVOICE_STATUSES, PAYMENT_METHODS } from '@/lib/domain'
import { getFacturacion, type FacturacionData } from '@/server/queries/facturacion'

export type FacturacionResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

async function clientBelongs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string | null,
  orgId: string,
): Promise<boolean> {
  if (!id) return true
  const { data } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', id)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()
  return Boolean(data)
}

const itemSchema = z.object({
  productId: z.uuid().nullable().default(null),
  description: z.string().trim().min(1, 'Cada línea necesita una descripción.').max(300),
  quantity: z.coerce.number().positive('La cantidad debe ser mayor que cero.').max(1e9),
  unitPriceCents: z.coerce.number().int().min(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
})

const invoiceSchema = z.object({
  clientId: z.uuid().nullable().default(null),
  clientName: z.string().trim().max(200).default(''),
  issuedOn: z.string().date(),
  dueOn: z.string().date().nullable().default(null),
  currency: z.string().trim().length(3).toUpperCase().default('COP'),
  notes: z.string().trim().max(2000).default(''),
  items: z.array(itemSchema).min(1, 'Agrega al menos una línea.').max(200),
})

/**
 * Totals, computed on the server from the lines.
 *
 * Never taken from the client: a browser that posts its own total is a browser
 * that can invoice a customer for zero. The rounding happens once, per line,
 * so the sum of the printed lines always equals the printed total — computing
 * tax on the subtotal instead would leave the two off by a peso or two and
 * nobody would be able to say which was right.
 */
function totalsOf(items: z.infer<typeof itemSchema>[]) {
  let subtotal = 0
  let tax = 0
  for (const item of items) {
    const line = Math.round(item.quantity * item.unitPriceCents)
    subtotal += line
    tax += Math.round((line * item.taxRate) / 100)
  }
  return { subtotal, tax, total: subtotal + tax }
}

export async function createFactura(
  input: z.input<typeof invoiceSchema>,
): Promise<FacturacionResult<FacturacionData>> {
  try {
    const member = await requirePermission('facturacion:write')
    const parsed = invoiceSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    if (parsed.data.dueOn && parsed.data.dueOn < parsed.data.issuedOn) {
      return fail('La fecha de vencimiento no puede ser anterior a la de emisión.')
    }

    const supabase = await createClient()
    if (!(await clientBelongs(supabase, parsed.data.clientId, member.orgId))) {
      return fail('Ese cliente no existe en tu organización.')
    }

    // Every referenced product must be this tenant's. Checked as a set rather
    // than one round trip per line.
    const productIds = [...new Set(parsed.data.items.map((i) => i.productId).filter(Boolean))] as string[]
    if (productIds.length > 0) {
      const { data: owned } = await supabase
        .from('products')
        .select('id')
        .eq('org_id', member.orgId)
        .is('deleted_at', null)
        .in('id', productIds)

      if ((owned ?? []).length !== productIds.length) {
        return fail('Alguno de los productos no existe en tu catálogo.')
      }
    }

    const { subtotal, tax, total } = totalsOf(parsed.data.items)

    // The client name is denormalised on purpose: an invoice must still print
    // who it was issued to after the client row is removed.
    let clientName = parsed.data.clientName
    if (parsed.data.clientId && !clientName) {
      const { data: client } = await supabase
        .from('clients')
        .select('name')
        .eq('id', parsed.data.clientId)
        .eq('org_id', member.orgId)
        .maybeSingle()
      clientName = client?.name ?? ''
    }

    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        org_id: member.orgId,
        client_id: parsed.data.clientId,
        client_name: clientName,
        status: 'Borrador',
        issued_on: parsed.data.issuedOn,
        due_on: parsed.data.dueOn,
        subtotal_cents: subtotal,
        tax_cents: tax,
        total_cents: total,
        currency: parsed.data.currency,
        notes: parsed.data.notes,
      })
      .select('id')
      .single()

    if (error || !invoice) {
      console.error('[facturacion] createFactura', error)
      return fail('No se pudo crear la factura.')
    }

    const { error: itemsError } = await supabase.from('invoice_items').insert(
      parsed.data.items.map((item, index) => ({
        invoice_id: invoice.id,
        product_id: item.productId,
        description: item.description,
        quantity: item.quantity,
        unit_price_cents: item.unitPriceCents,
        tax_rate: item.taxRate,
        position: index,
      })),
    )

    if (itemsError) {
      console.error('[facturacion] createFactura items', itemsError)
      // An invoice whose header exists and whose lines do not is worse than no
      // invoice: it prints a total nothing supports. Rolled back by hand,
      // since PostgREST has no transaction across two calls.
      await supabase.from('invoices').delete().eq('id', invoice.id).eq('org_id', member.orgId)
      return fail('No se pudieron guardar las líneas de la factura.')
    }

    // Venta a crédito: nace una cuenta por cobrar. El asiento es derivado del
    // hecho, y post_auto_entry es idempotente por (source, source_id).
    if (parsed.data.dueOn) {
      await maybePostAutoEntry(
        member, 'venta_credito', 'Venta', invoice.id,
        `Factura ${parsed.data.clientName}`,
        parsed.data.issuedOn, total,
      )
    }

    revalidatePath('/dashboard/facturacion')
    return { ok: true, data: await getFacturacion() }
  } catch {
    return fail('No tienes permiso para gestionar facturación.')
  }
}

const updateSchema = invoiceSchema.extend({ id: z.uuid() })

export async function updateFactura(
  input: z.input<typeof updateSchema>,
): Promise<FacturacionResult<FacturacionData>> {
  try {
    const member = await requirePermission('facturacion:write')
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    if (parsed.data.dueOn && parsed.data.dueOn < parsed.data.issuedOn) {
      return fail('La fecha de vencimiento no puede ser anterior a la de emisión.')
    }

    const supabase = await createClient()
    if (!(await clientBelongs(supabase, parsed.data.clientId, member.orgId))) {
      return fail('Ese cliente no existe en tu organización.')
    }

    const productIds = [...new Set(parsed.data.items.map((i) => i.productId).filter(Boolean))] as string[]
    if (productIds.length > 0) {
      const { data: owned } = await supabase
        .from('products')
        .select('id')
        .eq('org_id', member.orgId)
        .is('deleted_at', null)
        .in('id', productIds)

      if ((owned ?? []).length !== productIds.length) {
        return fail('Alguno de los productos no existe en tu catálogo.')
      }
    }

    const { subtotal, tax, total } = totalsOf(parsed.data.items)

    let clientName = parsed.data.clientName
    if (parsed.data.clientId && !clientName) {
      const { data: client } = await supabase
        .from('clients')
        .select('name')
        .eq('id', parsed.data.clientId)
        .eq('org_id', member.orgId)
        .maybeSingle()
      clientName = client?.name ?? ''
    }

    // The old lines stay aside until the replacement is in: if the second
    // write fails, the invoice gets the lines it printed before rather than
    // an empty one.
    const { data: oldRows } = await supabase
      .from('invoice_items')
      .select('product_id, description, quantity, unit_price_cents, tax_rate, position')
      .eq('invoice_id', parsed.data.id)
      .order('position', { ascending: true })

    const { error } = await supabase
      .from('invoices')
      .update({
        client_id: parsed.data.clientId,
        client_name: clientName,
        issued_on: parsed.data.issuedOn,
        due_on: parsed.data.dueOn,
        subtotal_cents: subtotal,
        tax_cents: tax,
        total_cents: total,
        currency: parsed.data.currency,
        notes: parsed.data.notes,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[facturacion] updateFactura', error)
      return fail('No se pudo actualizar la factura.')
    }

    const { error: deleteError } = await supabase
      .from('invoice_items')
      .delete()
      .eq('invoice_id', parsed.data.id)

    if (deleteError) {
      console.error('[facturacion] updateFactura delete items', deleteError)
      return fail('No se pudieron reemplazar las líneas de la factura.')
    }

    const { error: itemsError } = await supabase.from('invoice_items').insert(
      parsed.data.items.map((item, index) => ({
        invoice_id: parsed.data.id,
        product_id: item.productId,
        description: item.description,
        quantity: item.quantity,
        unit_price_cents: item.unitPriceCents,
        tax_rate: item.taxRate,
        position: index,
      })),
    )

    if (itemsError) {
      console.error('[facturacion] updateFactura items', itemsError)
      await supabase.from('invoice_items').insert(
        (oldRows ?? []).map((row, index) => ({
          invoice_id: parsed.data.id,
          product_id: row.product_id,
          description: row.description,
          quantity: row.quantity,
          unit_price_cents: row.unit_price_cents,
          tax_rate: row.tax_rate,
          position: row.position ?? index,
        })),
      )
      return fail('No se pudieron guardar las líneas de la factura.')
    }

    revalidatePath('/dashboard/facturacion')
    return { ok: true, data: await getFacturacion() }
  } catch {
    return fail('No tienes permiso para gestionar facturación.')
  }
}

const statusSchema = z.object({ id: z.uuid(), status: z.enum(INVOICE_STATUSES) })

export async function setFacturaStatus(
  input: z.input<typeof statusSchema>,
): Promise<FacturacionResult<FacturacionData>> {
  try {
    const member = await requirePermission('facturacion:write')
    const parsed = statusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('invoices')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[facturacion] setFacturaStatus', error)
      return fail('No se pudo actualizar la factura.')
    }

    revalidatePath('/dashboard/facturacion')
    return { ok: true, data: await getFacturacion() }
  } catch {
    return fail('No tienes permiso para gestionar facturación.')
  }
}

const paymentSchema = z.object({
  invoiceId: z.uuid(),
  amountCents: z.coerce.number().int().positive('El pago debe ser mayor que cero.'),
  method: z.enum(PAYMENT_METHODS).default('Transferencia'),
  reference: z.string().trim().max(120).default(''),
  paidOn: z.string().date(),
})

/**
 * Records a payment and moves the invoice's balance.
 *
 * `paid_cents` on the header is the running total, kept in step with the rows
 * in `invoice_payments`. The `invoices_paid_within_total` constraint refuses
 * an overpayment at the database, but the check here is what turns that into a
 * sentence — and an invoice settled in full moves to 'Pagada' in the same
 * write, so a paid invoice can never sit in the receivables report.
 */
export async function registrarPago(
  input: z.input<typeof paymentSchema>,
): Promise<FacturacionResult<FacturacionData>> {
  try {
    const member = await requirePermission('facturacion:write')
    const parsed = paymentSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, code, total_cents, paid_cents, status')
      .eq('id', parsed.data.invoiceId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!invoice) return fail('Esa factura no existe en tu organización.')
    if (invoice.status === 'Anulada') return fail('No se puede pagar una factura anulada.')

    const paid = invoice.paid_cents + parsed.data.amountCents
    if (paid > invoice.total_cents) {
      const pending = (invoice.total_cents - invoice.paid_cents) / 100
      return fail(
        `El pago supera el saldo pendiente (${pending.toLocaleString('es-CO')}). Ajusta el monto.`,
      )
    }

    const { data: payment, error } = await supabase.from('invoice_payments').insert({
      invoice_id: parsed.data.invoiceId,
      amount_cents: parsed.data.amountCents,
      method: parsed.data.method,
      reference: parsed.data.reference,
      paid_on: parsed.data.paidOn,
    }).select('id').single()

    if (error || !payment) {
      console.error('[facturacion] registrarPago', error)
      return fail('No se pudo registrar el pago.')
    }

    const { error: headerError } = await supabase
      .from('invoices')
      .update({
        paid_cents: paid,
        ...(paid >= invoice.total_cents ? { status: 'Pagada' as const } : {}),
      })
      .eq('id', parsed.data.invoiceId)
      .eq('org_id', member.orgId)

    if (headerError) {
      console.error('[facturacion] registrarPago header', headerError)
      return fail('El pago se guardó pero no se pudo actualizar el saldo. Revisa la factura.')
    }

    // El cobro también es un hecho contable: entra caja, sale la cuenta por
    // cobrar. Idempotente por (Cobro, payment_id).
    await maybePostAutoEntry(
      member, 'cobro', 'Cobro', payment.id,
      `Cobro ${invoice.code ?? 'factura'}`,
      parsed.data.paidOn, parsed.data.amountCents,
    )

    revalidatePath('/dashboard/facturacion')
    revalidatePath('/dashboard/contabilidad')
    return { ok: true, data: await getFacturacion() }
  } catch {
    return fail('No tienes permiso para gestionar facturación.')
  }
}

export async function deleteFactura(id: string): Promise<FacturacionResult<FacturacionData>> {
  try {
    const member = await requirePermission('facturacion:write')
    if (!z.uuid().safeParse(id).success) return fail('Factura desconocida.')

    const supabase = await createClient()
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, paid_cents')
      .eq('id', id)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!invoice) return fail('Esa factura no existe en tu organización.')
    if (invoice.paid_cents > 0) {
      return fail('Esta factura tiene pagos registrados. Anúlala en vez de eliminarla.')
    }

    const { error } = await supabase
      .from('invoices')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[facturacion] deleteFactura', error)
      return fail('No se pudo eliminar la factura.')
    }

    revalidatePath('/dashboard/facturacion')
    return { ok: true, data: await getFacturacion() }
  } catch {
    return fail('No tienes permiso para gestionar facturación.')
  }
}
