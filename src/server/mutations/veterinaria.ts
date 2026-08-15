'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { getVeterinaria, type VeterinariaData } from '@/server/queries/veterinaria'

export type VeterinariaResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar pacientes.'

async function refreshed(): Promise<VeterinariaResult<VeterinariaData>> {
  revalidatePath('/dashboard/pacientes')
  return { ok: true, data: await getVeterinaria() }
}

/* ─── Mascotas ────────────────────────────────────────────────────────────── */

const dateOrEmpty = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')])
  .transform((v) => (v === '' ? undefined : v))

const addPetSchema = z.object({
  ownerId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  species: z.enum(['Perro', 'Gato', 'Ave', 'Equino', 'Bovino', 'Exótico', 'Otro']).default('Perro'),
  breed: z.string().trim().max(120).default(''),
  sex: z.enum(['Macho', 'Hembra', 'Desconocido']).default('Desconocido'),
  birthDate: dateOrEmpty.optional(),
  weightKg: z.string().default(''),
  microchip: z.string().trim().max(80).default(''),
  notes: z.string().trim().max(500).default(''),
})

export async function addPet(
  input: z.input<typeof addPetSchema>,
): Promise<VeterinariaResult<VeterinariaData>> {
  try {
    const member = await requirePermission('pacientes:write')
    const parsed = addPetSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    // El propietario debe ser un paciente de *esta* organización.
    const { data: owner } = await supabase
      .from('patients')
      .select('id')
      .eq('id', parsed.data.ownerId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!owner) return fail('Ese propietario no pertenece a tu organización.')

    const { error } = await supabase.from('vet_pets').insert({
      org_id: member.orgId,
      patient_id: parsed.data.ownerId,
      name: parsed.data.name,
      species: parsed.data.species,
      breed: parsed.data.breed,
      sex: parsed.data.sex,
      birth_date: parsed.data.birthDate || null,
      weight_kg: parsed.data.weightKg ? Number(parsed.data.weightKg) : null,
      microchip: parsed.data.microchip,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[veterinaria] addPet', error)
      return fail(error.code === '23505' ? 'Ya existe una mascota con ese nombre para ese propietario.' : 'No se pudo crear la mascota.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function setPetStatus(id: string, status: string): Promise<VeterinariaResult<VeterinariaData>> {
  try {
    const member = await requirePermission('pacientes:write')
    if (!z.uuid().safeParse(id).success) return fail('Mascota inválida.')
    const parsed = z.enum(['Activo', 'Fallecido', 'Adoptado', 'Perdido']).safeParse(status)
    if (!parsed.success) return fail('Estado inválido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('vet_pets')
      .update({ status: parsed.data })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[veterinaria] setPetStatus', error)
      return fail('No se pudo cambiar el estado.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deletePet(id: string): Promise<VeterinariaResult<VeterinariaData>> {
  try {
    const member = await requirePermission('pacientes:write')
    if (!z.uuid().safeParse(id).success) return fail('Mascota inválida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('vet_pets')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[veterinaria] deletePet', error)
      return fail('No se pudo eliminar la mascota.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Vacunas ─────────────────────────────────────────────────────────────── */

const addVaccineSchema = z.object({
  petId: z.string().uuid(),
  vaccine: z.string().trim().min(1).max(120),
  administeredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nextDueOn: dateOrEmpty.optional(),
  batch: z.string().trim().max(80).default(''),
  notes: z.string().trim().max(500).default(''),
})

export async function addVaccine(
  input: z.input<typeof addVaccineSchema>,
): Promise<VeterinariaResult<VeterinariaData>> {
  try {
    const member = await requirePermission('pacientes:write')
    const parsed = addVaccineSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { data: pet } = await supabase
      .from('vet_pets')
      .select('id')
      .eq('id', parsed.data.petId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!pet) return fail('Esa mascota no pertenece a tu organización.')

    const { error } = await supabase.from('vet_vaccines').insert({
      pet_id: parsed.data.petId,
      vaccine: parsed.data.vaccine,
      administered_on: parsed.data.administeredOn,
      next_due_on: parsed.data.nextDueOn || null,
      batch: parsed.data.batch,
    })

    if (error) {
      console.error('[veterinaria] addVaccine', error)
      return fail('No se pudo registrar la vacuna.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteVaccine(id: string): Promise<VeterinariaResult<VeterinariaData>> {
  try {
    await requirePermission('pacientes:write')
    if (!z.uuid().safeParse(id).success) return fail('Vacuna inválida.')

    const supabase = await createClient()
    const { error } = await supabase.from('vet_vaccines').delete().eq('id', id)

    if (error) {
      console.error('[veterinaria] deleteVaccine', error)
      return fail('No se pudo eliminar la vacuna.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Hospitalización ─────────────────────────────────────────────────────── */

const addHospitalizationSchema = z.object({
  petId: z.string().uuid(),
  reason: z.string().trim().min(2).max(300),
  kennel: z.string().trim().max(60).default(''),
  notes: z.string().trim().max(500).default(''),
})

export async function addHospitalization(
  input: z.input<typeof addHospitalizationSchema>,
): Promise<VeterinariaResult<VeterinariaData>> {
  try {
    const member = await requirePermission('pacientes:write')
    const parsed = addHospitalizationSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { data: pet } = await supabase
      .from('vet_pets')
      .select('id')
      .eq('id', parsed.data.petId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!pet) return fail('Esa mascota no pertenece a tu organización.')

    const { data: hosp, error } = await supabase
      .from('vet_hospitalizations')
      .insert({
        org_id: member.orgId,
        pet_id: parsed.data.petId,
        reason: parsed.data.reason,
        kennel: parsed.data.kennel,
      })
      .select('id')
      .single()

    if (error || !hosp) {
      console.error('[veterinaria] addHospitalization', error)
      return fail('No se pudo ingresar la mascota.')
    }

    if (parsed.data.notes) {
      await supabase.from('vet_hospitalization_notes').insert({
        hospitalization_id: hosp.id,
        note: parsed.data.notes,
      })
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

const DISCHARGE = ['Alta', 'Fallecido'] as const

export async function dischargeHospitalization(
  id: string,
  status: string,
): Promise<VeterinariaResult<VeterinariaData>> {
  try {
    const member = await requirePermission('pacientes:write')
    if (!z.uuid().safeParse(id).success) return fail('Hospitalización inválida.')
    const parsed = z.enum(DISCHARGE).safeParse(status)
    if (!parsed.success) return fail('Estado inválido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('vet_hospitalizations')
      .update({ status: parsed.data, discharge_on: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)
      .eq('status', 'Hospitalizado')

    if (error) {
      console.error('[veterinaria] dischargeHospitalization', error)
      return fail('No se pudo dar de alta.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function addHospNote(id: string, note: string): Promise<VeterinariaResult<VeterinariaData>> {
  try {
    const member = await requirePermission('pacientes:write')
    if (!z.uuid().safeParse(id).success) return fail('Hospitalización inválida.')
    const parsed = z.string().trim().min(1).max(500).safeParse(note)
    if (!parsed.success) return fail('Nota inválida.')

    const supabase = await createClient()
    const { data: hosp } = await supabase
      .from('vet_hospitalizations')
      .select('id')
      .eq('id', id)
      .eq('org_id', member.orgId)
      .eq('status', 'Hospitalizado')
      .maybeSingle()

    if (!hosp) return fail('Esa hospitalización no está abierta.')

    const { error } = await supabase.from('vet_hospitalization_notes').insert({
      hospitalization_id: id,
      note: parsed.data,
    })

    if (error) {
      console.error('[veterinaria] addHospNote', error)
      return fail('No se pudo guardar la nota.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
