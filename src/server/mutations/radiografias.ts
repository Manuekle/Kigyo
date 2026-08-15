'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { getRadiografias, type RadiografiasData } from '@/server/queries/radiografias'

export type RadiografiasResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar pacientes.'

async function refreshed(): Promise<RadiografiasResult<RadiografiasData>> {
  revalidatePath('/dashboard/pacientes')
  return { ok: true, data: await getRadiografias() }
}

/**
 * La clave del objeto debe empezar por `{org}/`: las políticas de storage
 * fijan el primer segmento a una organización del llamante, así que un key
 * válido para el storage pero de otra organización no debe poder colgarse de
 * un paciente de esta.
 */
function keyBelongsToOrg(storagePath: string, orgId: string): boolean {
  return storagePath.startsWith(`${orgId}/`)
}

const addImageSchema = z.object({
  patientId: z.string().uuid(),
  kind: z.enum(['Radiografía', 'Ultrasonido', 'Tomografía', 'Fotografía', 'Otro']).default('Radiografía'),
  study: z.string().trim().min(2).max(200),
  takenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)),
  storagePath: z.string().trim().min(1).max(400),
  mimeType: z.string().trim().max(100).nullable().default(null),
  sizeBytes: z.coerce.number().int().min(0).max(30_000_000),
  notes: z.string().trim().max(500).default(''),
})

export async function addImagen(
  input: z.input<typeof addImageSchema>,
): Promise<RadiografiasResult<RadiografiasData>> {
  try {
    const member = await requirePermission('pacientes:write')
    const parsed = addImageSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    if (!keyBelongsToOrg(parsed.data.storagePath, member.orgId)) {
      return fail('El archivo no pertenece a tu organización.')
    }

    const supabase = await createClient()
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('id', parsed.data.patientId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!patient) return fail('Ese paciente no pertenece a tu organización.')

    const { error } = await supabase.from('patient_images').insert({
      org_id: member.orgId,
      patient_id: parsed.data.patientId,
      kind: parsed.data.kind,
      study: parsed.data.study,
      taken_on: parsed.data.takenOn,
      storage_path: parsed.data.storagePath,
      mime_type: parsed.data.mimeType,
      size_bytes: parsed.data.sizeBytes,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[radiografias] addImagen', error)
      return fail('No se pudo registrar la imagen.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteImagen(id: string): Promise<RadiografiasResult<RadiografiasData>> {
  try {
    const member = await requirePermission('pacientes:write')
    if (!z.uuid().safeParse(id).success) return fail('Imagen inválida.')

    const supabase = await createClient()
    const { data: row } = await supabase
      .from('patient_images')
      .select('id, storage_path')
      .eq('id', id)
      .eq('org_id', member.orgId)
      .maybeSingle()

    if (!row) return fail('Esa imagen no pertenece a tu organización.')

    const { error } = await supabase
      .from('patient_images')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[radiografias] deleteImagen', error)
      return fail('No se pudo eliminar la imagen.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
