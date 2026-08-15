'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { getContabilidad, type ContabilidadData } from '@/server/queries/contabilidad'

export type ContaResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para registrar asientos.'

async function refreshed(): Promise<ContaResult<ContabilidadData>> {
  revalidatePath('/dashboard/contabilidad')
  return { ok: true, data: await getContabilidad() }
}

const lineSchema = z.object({
  accountId: z.string().regex(/^[0-9]{1,8}$/, 'Cuenta inválida.'),
  description: z.string().trim().max(200).default(''),
  debitCents: z.number().int().min(0).default(0),
  creditCents: z.number().int().min(0).default(0),
})

const entrySchema = z.object({
  entryDate: z.string().date('La fecha debe ser válida.'),
  memo: z.string().trim().min(1, 'La descripción es obligatoria.').max(400),
  lines: z.array(lineSchema).min(2, 'Un asiento necesita al menos dos líneas.').max(40),
})

/**
 * Crea un asiento en borrador.
 *
 * El insert de asiento + líneas no es atómico por PostgREST (dos statements),
 * pero la peor consecuencia es un borrador sin líneas, y la pantalla lo
 * muestra: publicar es lo que exige cuadre, y eso sí lo valida el trigger en
 * la base. La ventana es inofensiva por diseño — un borrador no cuadra y no
 * se publica.
 */
export async function createEntry(
  input: z.input<typeof entrySchema>,
): Promise<ContaResult<ContabilidadData>> {
  try {
    const member = await requirePermission('contabilidad:write')
    const parsed = entrySchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const debits = parsed.data.lines.reduce((s, l) => s + l.debitCents, 0)
    const credits = parsed.data.lines.reduce((s, l) => s + l.creditCents, 0)
    if (debits === 0 || credits === 0 || debits !== credits) {
      return fail('El asiento debe cuadrar: suma débitos igual a suma créditos.')
    }

    const supabase = await createClient()
    const { data: entry, error } = await supabase
      .from('journal_entries')
      .insert({
        org_id: member.orgId,
        entry_date: parsed.data.entryDate,
        memo: parsed.data.memo,
        source: 'Manual',
        status: 'Borrador',
      })
      .select('id')
      .single()

    if (error || !entry) {
      console.error('[contabilidad] createEntry', error)
      return fail('No se pudo crear el asiento.')
    }

    const { error: linesError } = await supabase.from('journal_lines').insert(
      parsed.data.lines.map((l) => ({
        org_id: member.orgId,
        entry_id: entry.id,
        account_code: l.accountId,
        description: l.description,
        debit_cents: l.debitCents,
        credit_cents: l.creditCents,
      })),
    )
    if (linesError) {
      console.error('[contabilidad] createEntry lines', linesError)
      return fail('El asiento se creó pero sus líneas no se guardaron.')
    }

    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

const publishSchema = z.object({ id: z.uuid() })

/**
 * Publica un asiento. El trigger `journal_entries_guard_balanced` rechaza el
 * que no cuadra; el de inmutabilidad congela todo lo publicado.
 */
export async function publishEntry(
  input: z.input<typeof publishSchema>,
): Promise<ContaResult<ContabilidadData>> {
  try {
    const member = await requirePermission('contabilidad:write')
    const parsed = publishSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('journal_entries')
      .update({ status: 'Publicado' })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)
      .eq('status', 'Borrador')

    if (error) {
      console.error('[contabilidad] publishEntry', error)
      if (error.code === '23514') {
        return fail('El asiento no cuadra: revisa débitos y créditos.')
      }
      return fail('No se pudo publicar el asiento.')
    }

    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/** Solo borradores: un publicado es inmutable (el trigger lo rechaza). */
export async function deleteEntry(id: string): Promise<ContaResult<ContabilidadData>> {
  try {
    const member = await requirePermission('contabilidad:write')
    if (!z.uuid().safeParse(id).success) return fail('Asiento desconocido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)
      .eq('status', 'Borrador')

    if (error) {
      console.error('[contabilidad] deleteEntry', error)
      return fail('Solo se puede eliminar un asiento en borrador.')
    }

    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

const mappingSchema = z.object({
  concepto: z.enum(['venta_credito', 'cobro', 'compra', 'pago_proveedor', 'caja_diferencia']),
  accountId: z.string().regex(/^[0-9]{1,8}$/, 'Cuenta inválida.'),
})

/**
 * Ajusta el mapeo de un concepto para ESTA empresa. Upsert: el contador
 * cambia la cuenta sin deploy, y el RPC de auto-asientos la respeta desde
 * ese instante.
 */
export async function setAccountMapping(
  input: z.input<typeof mappingSchema>,
): Promise<ContaResult<ContabilidadData>> {
  try {
    const member = await requirePermission('contabilidad:write')
    const parsed = mappingSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('org_account_mappings')
      .upsert({
        org_id: member.orgId,
        concepto: parsed.data.concepto,
        account_code: parsed.data.accountId,
        auto: true,
      }, { onConflict: 'org_id,concepto' })

    if (error) {
      console.error('[contabilidad] setAccountMapping', error)
      return fail('No se pudo guardar el mapeo.')
    }

    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

