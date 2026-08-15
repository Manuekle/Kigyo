import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { scoped } from './shared'

/**
 * Veterinaria: mascotas, vacunas y hospitalización.
 *
 * Vive bajo `pacientes:read` / `pacientes:write` y no tiene permisos propios:
 * es profundidad del módulo sectorial, no un módulo. Ver la migración 65.
 *
 * `patients` es el propietario; la mascota es el paciente clínico. La pantalla
 * de pacientes ya trae el directorio de propietarios, así que aquí solo se lee
 * lo veterinario.
 */

export interface PetRow {
  id: string
  ownerId: string
  ownerName: string
  name: string
  species: string
  breed: string
  sex: string
  birthDate: string | null
  weightKg: number | null
  microchip: string
  status: string
  notes: string
  /** Refuerzos vencidos o por vencer en los próximos 30 días. */
  dueVaccines: number
}

export interface VaccineRow {
  id: string
  petId: string
  petName: string
  vaccine: string
  administeredOn: string
  nextDueOn: string | null
  batch: string
  professionalName: string | null
  notes: string
}

export interface HospitalizationRow {
  id: string
  petId: string
  petName: string
  ownerName: string
  admissionOn: string
  dischargeOn: string | null
  reason: string
  status: string
  kennel: string
  notes: string[]
}

export interface VeterinariaData {
  pets: PetRow[]
  vaccines: VaccineRow[]
  hospitalizations: HospitalizationRow[]
  /** Vacunas vencidas o por vencer este mes. La lista de recuerdo. */
  vaccinesDue: number
  /** Animales adentro ahora. */
  openBeds: number
  canWrite: boolean
}

export async function getVeterinaria(): Promise<VeterinariaData> {
  const member = await requirePermission('pacientes:read')
  const supabase = await createClient()

  const [petsResult, vaccinesResult, hospResult, ownersResult, staffResult] = await Promise.all([
    scoped(supabase, member, 'vet_pets')
      .select('id, patient_id, name, species, breed, sex, birth_date, weight_kg, microchip, status, notes')
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .limit(500),
    supabase
      .from('vet_vaccines')
      .select('id, pet_id, vaccine, administered_on, next_due_on, batch, professional_id, notes')
      .order('administered_on', { ascending: false })
      .limit(1000),
    scoped(supabase, member, 'vet_hospitalizations')
      .select('id, pet_id, admission_on, discharge_on, reason, status, kennel')
      .order('admission_on', { ascending: false })
      .limit(200),
    // Los nombres de propietario, una vez.
    scoped(supabase, member, 'patients')
      .select('id, full_name')
      .is('deleted_at', null)
      .limit(2000),
    scoped(supabase, member, 'employees')
      .select('id, full_name')
      .is('deleted_at', null)
      .limit(500),
  ])

  const ownerName = new Map(
    ((ownersResult.data ?? []) as unknown as Array<{ id: string; full_name: string }>)
      .map((p) => [p.id, p.full_name]),
  )

  const staffName = new Map(
    ((staffResult.data ?? []) as unknown as Array<{ id: string; full_name: string }>)
      .map((e) => [e.id, e.full_name]),
  )

  const petRows = (petsResult.data ?? []) as unknown as Array<{
    id: string; patient_id: string; name: string; species: string; breed: string
    sex: string; birth_date: string | null; weight_kg: number | null
    microchip: string; status: string; notes: string
  }>

  const vaccineRows = (vaccinesResult.data ?? []) as unknown as Array<{
    id: string; pet_id: string; vaccine: string; administered_on: string
    next_due_on: string | null; batch: string; professional_id: string | null; notes: string
  }>

  const hospRows = (hospResult.data ?? []) as unknown as Array<{
    id: string; pet_id: string; admission_on: string; discharge_on: string | null
    reason: string; status: string; kennel: string
  }>

  const petName = new Map(petRows.map((p) => [p.id, p.name]))
  const petOwner = new Map(petRows.map((p) => [p.id, p.patient_id]))

  // Las notas de evolución de los internos, en una consulta y no en 2N.
  const notesResult = hospRows.length > 0
    ? await supabase
        .from('vet_hospitalization_notes')
        .select('hospitalization_id, note')
        .in('hospitalization_id', hospRows.map((h) => h.id))
        .order('noted_at', { ascending: true })
    : { data: [] as Array<{ hospitalization_id: string; note: string }> }

  const notesByHosp = new Map<string, string[]>()
  for (const n of notesResult.data ?? []) {
    const list = notesByHosp.get(n.hospitalization_id)
    if (list) list.push(n.note)
    else notesByHosp.set(n.hospitalization_id, [n.note])
  }

  const pets: PetRow[] = petRows.map((row) => ({
    id: row.id,
    ownerId: row.patient_id,
    ownerName: ownerName.get(row.patient_id) ?? '—',
    name: row.name,
    species: row.species,
    breed: row.breed,
    sex: row.sex,
    birthDate: row.birth_date,
    weightKg: row.weight_kg,
    microchip: row.microchip,
    status: row.status,
    notes: row.notes,
    dueVaccines: 0,
  }))

  // El conteo de refuerzos por mascota: vencidos o por vencer en 30 días.
  const in30 = new Date()
  in30.setDate(in30.getDate() + 30)
  const in30Iso = in30.toISOString().slice(0, 10)
  for (const v of vaccineRows) {
    if (!v.next_due_on) continue
    const pet = pets.find((p) => p.id === v.pet_id)
    if (pet && v.next_due_on <= in30Iso) pet.dueVaccines += 1
  }

  const vaccines: VaccineRow[] = vaccineRows.map((row) => ({
    id: row.id,
    petId: row.pet_id,
    petName: petName.get(row.pet_id) ?? '—',
    vaccine: row.vaccine,
    administeredOn: row.administered_on,
    nextDueOn: row.next_due_on,
    batch: row.batch,
    professionalName: row.professional_id ? staffName.get(row.professional_id) ?? null : null,
    notes: row.notes,
  }))

  const hospitalizations: HospitalizationRow[] = hospRows.map((row) => ({
    id: row.id,
    petId: row.pet_id,
    petName: petName.get(row.pet_id) ?? '—',
    ownerName: petOwner.has(row.pet_id) ? ownerName.get(petOwner.get(row.pet_id)!) ?? '—' : '—',
    admissionOn: row.admission_on,
    dischargeOn: row.discharge_on,
    reason: row.reason,
    status: row.status,
    kennel: row.kennel,
    notes: notesByHosp.get(row.id) ?? [],
  }))

  return {
    pets,
    vaccines,
    hospitalizations,
    vaccinesDue: vaccineRows.filter((v) => v.next_due_on && v.next_due_on <= in30Iso).length,
    openBeds: hospitalizations.filter((h) => h.status === 'Hospitalizado').length,
    canWrite: can(member.permissions, 'pacientes:write'),
  }
}
