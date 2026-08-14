'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { getDonantes, type DonantesData } from '@/server/queries/donantes'

export type DonantesResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar los donantes.'

async function refreshed(): Promise<DonantesResult<DonantesData>> {
  revalidatePath('/dashboard/donantes')
  return { ok: true, data: await getDonantes() }
}

/* ─── Donantes ────────────────────────────────────────────────────────────── */

const addDonorSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  kind: z.enum(['persona', 'empresa']).default('persona'),
  notes: z.string().trim().max(500).default(''),
})

/** Abre un donante nuevo. Nace activo: se desactiva, no se borra, salvo excepción. */
export async function addDonor(
  input: z.input<typeof addDonorSchema>,
): Promise<DonantesResult<DonantesData>> {
  try {
    const member = await requirePermission('donantes:write')
    const parsed = addDonorSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('donors').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      kind: parsed.data.kind,
      status: 'activo',
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[donantes] addDonor', error)
      return fail('No se pudo crear el donante.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/** Cambia el estado del donante: activo o inactivo. */
export async function setDonorStatus(
  id: string,
  status: string,
): Promise<DonantesResult<DonantesData>> {
  try {
    const member = await requirePermission('donantes:write')
    if (!z.uuid().safeParse(id).success) return fail('Donante inválido.')
    const parsedStatus = z.enum(['activo', 'inactivo']).safeParse(status)
    if (!parsedStatus.success) return fail('Estado inválido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('donors')
      .update({ status: parsedStatus.data })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[donantes] setDonorStatus', error)
      return fail('No se pudo cambiar el estado.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteDonor(id: string): Promise<DonantesResult<DonantesData>> {
  try {
    const member = await requirePermission('donantes:write')
    if (!z.uuid().safeParse(id).success) return fail('Donante inválido.')

    const supabase = await createClient()
    // Borrado real, no suave. Las donaciones sobreviven: `donor_id` es
    // `on delete set null` y la fila conserva el `donor_name` que tenía.
    // `org_id` va explícito para que nadie pueda borrar por id lo que no es
    // de su empresa.
    const { error } = await supabase
      .from('donors')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[donantes] deleteDonor', error)
      return fail('No se pudo eliminar el donante.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Donaciones ──────────────────────────────────────────────────────────── */

const addDonationSchema = z.object({
  donorId: z.string().uuid().nullable().optional(),
  kind: z.enum(['monetaria', 'especie', 'tiempo']).default('monetaria'),
  amountCents: z.coerce.number().int().min(0).max(1_000_000_000_00).nullable().optional(),
  description: z.string().trim().max(300).default(''),
  donatedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  campaign: z.string().trim().max(120).default(''),
  notes: z.string().trim().max(500).default(''),
})

/**
 * Registra una donación.
 *
 * Si viene `donorId`, el donante debe ser una fila viva de *esta* organización:
 * RLS sobre `donations` mira el `org_id` de la fila, no lo que la fila señala.
 * El nombre se copia al insertar: borrar el donante después no borra la
 * historia de lo que dio.
 */
export async function addDonation(
  input: z.input<typeof addDonationSchema>,
): Promise<DonantesResult<DonantesData>> {
  try {
    const member = await requirePermission('donantes:write')
    const parsed = addDonationSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    let donorName: string | null = null
    if (parsed.data.donorId) {
      const { data: donor } = await supabase
        .from('donors')
        .select('name')
        .eq('id', parsed.data.donorId)
        .eq('org_id', member.orgId)
        .maybeSingle()

      if (!donor) return fail('Ese donante no pertenece a tu organización.')
      donorName = donor.name
    }

    const { error } = await supabase.from('donations').insert({
      org_id: member.orgId,
      donor_id: parsed.data.donorId ?? null,
      donor_name: donorName,
      kind: parsed.data.kind,
      amount_cents: parsed.data.kind === 'monetaria' ? parsed.data.amountCents ?? null : null,
      description: parsed.data.description,
      donated_on: parsed.data.donatedOn,
      campaign: parsed.data.campaign,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[donantes] addDonation', error)
      return fail('No se pudo registrar la donación.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteDonation(id: string): Promise<DonantesResult<DonantesData>> {
  try {
    const member = await requirePermission('donantes:write')
    if (!z.uuid().safeParse(id).success) return fail('Donación inválida.')

    const supabase = await createClient()
    // Borrado real: `org_id` explícito para que solo la empresa dueña pueda.
    const { error } = await supabase
      .from('donations')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[donantes] deleteDonation', error)
      return fail('No se pudo eliminar la donación.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
