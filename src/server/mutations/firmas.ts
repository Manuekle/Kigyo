'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { SIGNATURE_KINDS } from '@/lib/domain'
import { belongsToOrg, currentEmployeeId } from '@/server/queries/shared'
import { getFirmas, type FirmasData } from '@/server/queries/firmas'

export type FirmaResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const requestSchema = z.object({
  title: z.string().trim().min(3, 'El nombre del documento es obligatorio.').max(200),
  kind: z.enum(SIGNATURE_KINDS).default('Otro'),
  signerId: z.uuid().nullable().default(null),
  signerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('Correo inválido.')
    .nullable()
    .or(z.literal('').transform(() => null)),
  dueOn: z.string().date().nullable().default(null),
})

export async function requestFirma(
  input: z.input<typeof requestSchema>,
): Promise<FirmaResult<FirmasData>> {
  try {
    const member = await requirePermission('firmas:write')
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    // A request nobody can act on is a row that will sit "Pendiente" forever.
    if (!parsed.data.signerId && !parsed.data.signerEmail) {
      return fail('Indica quién debe firmar: una persona del equipo o un correo.')
    }

    const supabase = await createClient()
    if (!(await belongsToOrg(supabase, 'employees', parsed.data.signerId, member.orgId))) {
      return fail('Esa persona no está en el equipo de tu organización.')
    }

    const { error } = await supabase.from('signature_requests').insert({
      org_id: member.orgId,
      title: parsed.data.title,
      kind: parsed.data.kind,
      signer_id: parsed.data.signerId,
      signer_email: parsed.data.signerEmail,
      due_on: parsed.data.dueOn,
      status: 'Pendiente',
    })

    if (error) {
      console.error('[firmas] requestFirma', error)
      return fail('No se pudo solicitar la firma.')
    }

    revalidatePath('/dashboard/firmas')
    return { ok: true, data: await getFirmas() }
  } catch {
    return fail('No tienes permiso para gestionar firmas.')
  }
}

/**
 * Sign a document.
 *
 * What is recorded is the act and its instant: `status = 'Firmado'` and
 * `signed_at = now()`, which the `signature_requests_signed_consistent` check
 * keeps in step. The drawn stroke is not stored — there is no column and no
 * bucket for it, and pretending otherwise would be worse than saying so.
 *
 * The signer is taken from the session, never from the request: signing is the
 * one action in this module that must not be performable on someone's behalf.
 */
export async function signFirma(id: string): Promise<FirmaResult<FirmasData>> {
  try {
    const member = await requirePermission('firmas:write')
    if (!z.uuid().safeParse(id).success) return fail('Documento desconocido.')

    const supabase = await createClient()
    const meId = await currentEmployeeId(supabase, member.orgId, member.userId)

    const { data: request } = await supabase
      .from('signature_requests')
      .select('id, status, signer_id')
      .eq('id', id)
      .eq('org_id', member.orgId)
      .maybeSingle()

    if (!request) return fail('Documento desconocido.')
    if (request.status === 'Firmado') return fail('Ese documento ya está firmado.')
    if (request.status === 'Cancelado') return fail('Esa solicitud fue cancelada.')

    // A request addressed to a specific person can only be signed by them.
    // Unassigned requests (external signer by email) are left to that flow.
    if (request.signer_id && request.signer_id !== meId) {
      return fail('Este documento está dirigido a otra persona.')
    }
    if (!request.signer_id) {
      return fail('Esta solicitud está dirigida a un correo externo, no a tu cuenta.')
    }

    const { error } = await supabase
      .from('signature_requests')
      .update({ status: 'Firmado', signed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[firmas] signFirma', error)
      return fail('No se pudo registrar la firma.')
    }

    revalidatePath('/dashboard/firmas')
    return { ok: true, data: await getFirmas() }
  } catch {
    return fail('No tienes permiso para firmar.')
  }
}

export async function cancelFirma(id: string): Promise<FirmaResult<FirmasData>> {
  try {
    const member = await requirePermission('firmas:write')
    if (!z.uuid().safeParse(id).success) return fail('Documento desconocido.')

    const supabase = await createClient()
    // Cancelled, not deleted: a signature request that was withdrawn is part
    // of the paper trail, and a signed one must never disappear.
    const { error } = await supabase
      .from('signature_requests')
      .update({ status: 'Cancelado' })
      .eq('id', id)
      .eq('org_id', member.orgId)
      .neq('status', 'Firmado')

    if (error) {
      console.error('[firmas] cancelFirma', error)
      return fail('No se pudo cancelar la solicitud.')
    }

    revalidatePath('/dashboard/firmas')
    return { ok: true, data: await getFirmas() }
  } catch {
    return fail('No tienes permiso para gestionar firmas.')
  }
}
