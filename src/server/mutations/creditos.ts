'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import type { Supabase } from '@/server/queries/shared'
import { getCreditos, type CreditosData } from '@/server/queries/creditos'

export type CreditosResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar los créditos.'

async function refreshed(): Promise<CreditosResult<CreditosData>> {
  revalidatePath('/dashboard/creditos')
  return { ok: true, data: await getCreditos() }
}

/**
 * Rechaza un cliente que no es una fila viva de *esta* organización. RLS sobre
 * `loans` mira el `org_id` de la fila, no lo que la fila señala.
 */
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

/* ─── Préstamos ──────────────────────────────────────────────────────────── */

const addLoanSchema = z.object({
  clientId: z.string().uuid().nullable().optional(),
  amountCents: z.coerce.number().int().min(1).max(1_000_000_000_00),
  interestRateBps: z.coerce.number().int().min(0).max(10000).default(0),
  termMonths: z.coerce.number().int().min(1).max(120),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(500).default(''),
})

/**
 * Coloca un préstamo y abre sus cuotas.
 *
 * Interés fijo mensual, cuotas iguales: el monto de cada cuota es el total
 * (capital + interés) dividido entre el plazo, redondeado a centavos. Toda la
 * colocación — el préstamo y sus cuotas — vive en un solo intento: si algo
 * falla, no queda un préstamo huérfano de cuotas.
 */
export async function addLoan(
  input: z.input<typeof addLoanSchema>,
): Promise<CreditosResult<CreditosData>> {
  try {
    const member = await requirePermission('creditos:write')
    const parsed = addLoanSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    if (!(await clientInOrg(supabase, parsed.data.clientId ?? null, member.orgId))) {
      return fail('Ese cliente no pertenece a tu organización.')
    }

    const { amountCents, interestRateBps, termMonths, startDate } = parsed.data
    const installmentCents = Math.round(
      (amountCents * (1 + interestRateBps / 10000)) / termMonths,
    )

    const { data: loan, error } = await supabase
      .from('loans')
      .insert({
        org_id: member.orgId,
        client_id: parsed.data.clientId ?? null,
        amount_cents: amountCents,
        interest_rate_bps: interestRateBps,
        term_months: termMonths,
        start_date: startDate,
        status: 'activo',
        notes: parsed.data.notes,
      })
      .select('id')
      .single()

    if (error || !loan) {
      console.error('[creditos] addLoan', error)
      return fail('No se pudo crear el préstamo.')
    }

    const installments = Array.from({ length: termMonths }, (_, idx) => {
      const due = new Date(startDate)
      due.setMonth(due.getMonth() + idx + 1)
      return {
        org_id: member.orgId,
        loan_id: loan.id,
        number: idx + 1,
        due_date: due.toISOString().slice(0, 10),
        amount_cents: installmentCents,
        status: 'pendiente' as const,
      }
    })

    const { error: installmentsError } = await supabase
      .from('loan_installments')
      .insert(installments)

    if (installmentsError) {
      console.error('[creditos] addLoan installments', installmentsError)
      return fail('No se pudo crear el préstamo.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

const LOAN_STATUS = ['activo', 'pagado', 'castigado'] as const

/** Cambia el estado del préstamo: activo, pagado o castigado. */
export async function setLoanStatus(
  id: string,
  status: string,
): Promise<CreditosResult<CreditosData>> {
  try {
    const member = await requirePermission('creditos:write')
    if (!z.uuid().safeParse(id).success) return fail('Préstamo inválido.')
    const parsedStatus = z.enum(LOAN_STATUS).safeParse(status)
    if (!parsedStatus.success) return fail('Estado inválido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('loans')
      .update({ status: parsedStatus.data })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[creditos] setLoanStatus', error)
      return fail('No se pudo cambiar el estado.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/**
 * Marca una cuota como pagada y sella la fecha. Solo una cuota pendiente puede
 * pagarse: una cuota pagada no se vuelve a tocar.
 */
export async function payInstallment(id: string): Promise<CreditosResult<CreditosData>> {
  try {
    const member = await requirePermission('creditos:write')
    if (!z.uuid().safeParse(id).success) return fail('Cuota inválida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('loan_installments')
      .update({ status: 'pagada', paid_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)
      .eq('status', 'pendiente')

    if (error) {
      console.error('[creditos] payInstallment', error)
      return fail('No se pudo pagar la cuota.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteLoan(id: string): Promise<CreditosResult<CreditosData>> {
  try {
    const member = await requirePermission('creditos:write')
    if (!z.uuid().safeParse(id).success) return fail('Préstamo inválido.')

    const supabase = await createClient()
    // Borrado real, no suave: las cuotas caen en cascada desde la base.
    // `org_id` va explícito para que nadie pueda borrar por id lo que no es
    // de su empresa.
    const { error } = await supabase
      .from('loans')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[creditos] deleteLoan', error)
      return fail('No se pudo eliminar el préstamo.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
