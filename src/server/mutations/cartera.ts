'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import type { Supabase } from '@/server/queries/shared'
import { getCartera, type CarteraData } from '@/server/queries/cartera'

export type CarteraResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar la cartera.'

async function refreshed(): Promise<CarteraResult<CarteraData>> {
  revalidatePath('/dashboard/cartera')
  return { ok: true, data: await getCartera() }
}

/**
 * Rechaza un FK que no es una fila viva de *esta* organización. RLS sobre
 * `receivable_agreements` mira el `org_id` de la fila, no lo que la fila
 * señala.
 */
async function invoiceInOrg(
  supabase: Supabase,
  invoiceId: string | null,
  orgId: string,
): Promise<boolean> {
  if (!invoiceId) return true
  const { data } = await supabase
    .from('invoices')
    .select('id')
    .eq('id', invoiceId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()
  return Boolean(data)
}

async function clientInOrg(
  supabase: Supabase,
  clientId: string | null,
  orgId: string,
): Promise<boolean> {
  if (!clientId) return true
  const { data } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()
  return Boolean(data)
}

/* ─── Cuentas por cobrar ───────────────────────────────────────────────── */

const addDeudaSchema = z.object({
  invoiceId: z.string().uuid().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  amountCents: z.coerce.number().int().min(1).max(1_000_000_000),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(500).default(''),
})

/**
 * Registra una cuenta por cobrar.
 *
 * Factura y cliente son opcionales — hay deudas sin factura (acuerdo verbal)
 * y sin cliente asignado —, y cuando vienen se validan contra *esta*
 * organización: RLS sobre `receivable_agreements` mira el `org_id` de la
 * fila, no lo que la fila señala. Toda deuda nueva nace `pendiente`.
 */
export async function addDeuda(
  input: z.input<typeof addDeudaSchema>,
): Promise<CarteraResult<CarteraData>> {
  try {
    const member = await requirePermission('cartera:write')
    const parsed = addDeudaSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    if (!(await invoiceInOrg(supabase, parsed.data.invoiceId ?? null, member.orgId))) {
      return fail('Esa factura no pertenece a tu organización.')
    }
    if (!(await clientInOrg(supabase, parsed.data.clientId ?? null, member.orgId))) {
      return fail('Ese cliente no pertenece a tu organización.')
    }

    const { error } = await supabase.from('receivable_agreements').insert({
      org_id: member.orgId,
      invoice_id: parsed.data.invoiceId ?? null,
      client_id: parsed.data.clientId ?? null,
      amount_cents: parsed.data.amountCents,
      due_date: parsed.data.dueDate,
      status: 'pendiente',
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[cartera] addDeuda', error)
      return fail('No se pudo crear la cuenta por cobrar.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

const DEUDA_STATUS = ['pendiente', 'pagada', 'vencida', 'mora'] as const

/**
 * Cambia el estado del cobro. Pagar sella la fecha; cualquier otro estado la
 * limpia — la deuda sigue viva y el `paid_at` no puede mentir.
 */
export async function setDeudaStatus(
  id: string,
  status: string,
): Promise<CarteraResult<CarteraData>> {
  try {
    const member = await requirePermission('cartera:write')
    if (!z.uuid().safeParse(id).success) return fail('Cuenta por cobrar inválida.')
    const parsedStatus = z.enum(DEUDA_STATUS).safeParse(status)
    if (!parsedStatus.success) return fail('Estado inválido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('receivable_agreements')
      .update({
        status: parsedStatus.data,
        paid_at: parsedStatus.data === 'pagada' ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[cartera] setDeudaStatus', error)
      return fail('No se pudo cambiar el estado.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteDeuda(id: string): Promise<CarteraResult<CarteraData>> {
  try {
    const member = await requirePermission('cartera:write')
    if (!z.uuid().safeParse(id).success) return fail('Cuenta por cobrar inválida.')

    const supabase = await createClient()
    // Borrado real, no suave: una deuda mal tecleada no es historia que
    // preservar. `org_id` va explícito para que nadie pueda borrar por id lo
    // que no es de su empresa.
    const { error } = await supabase
      .from('receivable_agreements')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[cartera] deleteDeuda', error)
      return fail('No se pudo eliminar la cuenta por cobrar.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
