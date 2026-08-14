'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { ABSENCE_KINDS, ABSENCE_STATUSES, dayCount } from '@/lib/domain'
import { belongsToOrg } from '@/server/queries/shared'
import { getAsistencia, type AsistenciaData } from '@/server/queries/asistencia'

export type AsistenciaResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const baseSchema = z.object({
  employeeId: z.uuid('Elige a la persona.'),
  kind: z.enum(ABSENCE_KINDS).default('Vacaciones'),
  startsOn: z.string().date(),
  endsOn: z.string().date(),
  status: z.enum(ABSENCE_STATUSES).default('Programada'),
  notes: z.string().trim().max(1000).default(''),
})

const updateSchema = baseSchema.extend({ id: z.uuid() })

/**
 * Overlap check.
 *
 * Two absences for the same person over the same days is a state the roster
 * cannot answer questions about — "who is out today" returns them twice, and
 * the vacation balance is debited twice for one holiday. The database has no
 * exclusion constraint here, so this is the rule.
 */
async function overlaps(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  employeeId: string,
  startsOn: string,
  endsOn: string,
  excludeId?: string,
): Promise<boolean> {
  let query = supabase
    .from('absences')
    .select('id')
    .eq('org_id', orgId)
    .eq('employee_id', employeeId)
    .is('deleted_at', null)
    .neq('status', 'Rechazada')
    // Two ranges overlap when each starts before the other ends.
    .lte('starts_on', endsOn)
    .gte('ends_on', startsOn)

  if (excludeId) query = query.neq('id', excludeId)

  const { data } = await query.limit(1)
  return (data ?? []).length > 0
}

export async function createAusencia(
  input: z.input<typeof baseSchema>,
): Promise<AsistenciaResult<AsistenciaData>> {
  try {
    const member = await requirePermission('asistencia:write')
    const parsed = baseSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const p = parsed.data
    if (p.endsOn < p.startsOn) return fail('La fecha de fin no puede ser anterior a la de inicio.')

    const supabase = await createClient()
    if (!(await belongsToOrg(supabase, 'employees', p.employeeId, member.orgId))) {
      return fail('Esa persona no está en el equipo de tu organización.')
    }
    if (await overlaps(supabase, member.orgId, p.employeeId, p.startsOn, p.endsOn)) {
      return fail('Esa persona ya tiene una ausencia registrada en esas fechas.')
    }

    const { error } = await supabase.from('absences').insert({
      org_id: member.orgId,
      employee_id: p.employeeId,
      kind: p.kind,
      starts_on: p.startsOn,
      ends_on: p.endsOn,
      status: p.status,
      notes: p.notes,
    })

    if (error) {
      console.error('[asistencia] createAusencia', error)
      return fail('No se pudo registrar la ausencia.')
    }

    // Vacation days come off the balance. The old page kept "disponibles" as a
    // typed-in number that no absence ever touched, so the two disagreed the
    // moment anyone took a holiday.
    if (p.kind === 'Vacaciones') {
      await adjustBalance(supabase, member.orgId, p.employeeId, dayCount(p.startsOn, p.endsOn))
    }

    revalidatePath('/dashboard/asistencia')
    return { ok: true, data: await getAsistencia() }
  } catch {
    return fail('No tienes permiso para gestionar asistencia.')
  }
}

/**
 * Move the current year's taken-days counter, creating the row on first use.
 *
 * `vacation_balances` is unique on `(employee_id, year)`, so this upserts
 * rather than assuming a row exists — an employee hired this month has none.
 */
async function adjustBalance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  employeeId: string,
  deltaDays: number,
): Promise<void> {
  const year = new Date().getFullYear()
  const { data } = await supabase
    .from('vacation_balances')
    .select('id, taken_days')
    .eq('employee_id', employeeId)
    .eq('year', year)
    .maybeSingle()

  if (data) {
    // Clamped at zero: the column has a `taken_days >= 0` check, and a delete
    // of an absence created before the balance existed would go negative.
    const next = Math.max(0, Number(data.taken_days) + deltaDays)
    await supabase.from('vacation_balances').update({ taken_days: next }).eq('id', data.id)
    return
  }

  await supabase.from('vacation_balances').insert({
    org_id: orgId,
    employee_id: employeeId,
    year,
    taken_days: Math.max(0, deltaDays),
  })
}

export async function updateAusencia(
  input: z.input<typeof updateSchema>,
): Promise<AsistenciaResult<AsistenciaData>> {
  try {
    const member = await requirePermission('asistencia:write')
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const p = parsed.data
    if (p.endsOn < p.startsOn) return fail('La fecha de fin no puede ser anterior a la de inicio.')

    const supabase = await createClient()
    if (await overlaps(supabase, member.orgId, p.employeeId, p.startsOn, p.endsOn, p.id)) {
      return fail('Esa persona ya tiene otra ausencia registrada en esas fechas.')
    }

    const { data: before } = await supabase
      .from('absences')
      .select('kind, starts_on, ends_on')
      .eq('id', p.id)
      .eq('org_id', member.orgId)
      .maybeSingle()

    const { error } = await supabase
      .from('absences')
      .update({
        employee_id: p.employeeId,
        kind: p.kind,
        starts_on: p.startsOn,
        ends_on: p.endsOn,
        status: p.status,
        notes: p.notes,
      })
      .eq('id', p.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[asistencia] updateAusencia', error)
      return fail('No se pudo actualizar la ausencia.')
    }

    // Re-balance on the difference: shortening a holiday should give the days
    // back, and switching a holiday to a sick day should give all of them back.
    if (before) {
      const wasVacation = before.kind === 'Vacaciones'
      const isVacation = p.kind === 'Vacaciones'
      const oldDays = wasVacation ? dayCount(before.starts_on, before.ends_on) : 0
      const newDays = isVacation ? dayCount(p.startsOn, p.endsOn) : 0
      if (oldDays !== newDays) {
        await adjustBalance(supabase, member.orgId, p.employeeId, newDays - oldDays)
      }
    }

    revalidatePath('/dashboard/asistencia')
    return { ok: true, data: await getAsistencia() }
  } catch {
    return fail('No tienes permiso para gestionar asistencia.')
  }
}

export async function deleteAusencia(id: string): Promise<AsistenciaResult<AsistenciaData>> {
  try {
    const member = await requirePermission('asistencia:write')
    if (!z.uuid().safeParse(id).success) return fail('Ausencia desconocida.')

    const supabase = await createClient()
    const { data: before } = await supabase
      .from('absences')
      .select('employee_id, kind, starts_on, ends_on')
      .eq('id', id)
      .eq('org_id', member.orgId)
      .maybeSingle()

    const { error } = await supabase
      .from('absences')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[asistencia] deleteAusencia', error)
      return fail('No se pudo eliminar la ausencia.')
    }

    if (before?.kind === 'Vacaciones') {
      await adjustBalance(
        supabase,
        member.orgId,
        before.employee_id,
        -dayCount(before.starts_on, before.ends_on),
      )
    }

    revalidatePath('/dashboard/asistencia')
    return { ok: true, data: await getAsistencia() }
  } catch {
    return fail('No tienes permiso para gestionar asistencia.')
  }
}

const statusSchema = z.object({ id: z.uuid(), status: z.enum(ABSENCE_STATUSES) })

export async function setAusenciaStatus(
  input: z.input<typeof statusSchema>,
): Promise<AsistenciaResult<AsistenciaData>> {
  try {
    const member = await requirePermission('asistencia:write')
    const parsed = statusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('absences')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[asistencia] setAusenciaStatus', error)
      return fail('No se pudo actualizar la ausencia.')
    }

    revalidatePath('/dashboard/asistencia')
    return { ok: true, data: await getAsistencia() }
  } catch {
    return fail('No tienes permiso para gestionar asistencia.')
  }
}

export type SalidaRow = {
  id: string
  fullName: string
  department: string
  reason: string
  departedOn: string
  employeeId: string | null
}

export type SalidaData = SalidaRow[]

const salidaSchema = z.object({
  fullName: z.string().trim().min(2, 'Escribe el nombre completo.'),
  department: z.string().trim().default(''),
  reason: z.enum([
    'Renuncia voluntaria',
    'Mutuo acuerdo',
    'Vencimiento contrato',
    'Terminación con justa causa',
    'Otro',
  ]),
  departedOn: z.string().date(),
  employeeId: z.uuid().nullable(),
})

async function getSalidas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
): Promise<SalidaData> {
  const { data } = await supabase
    .from('departures')
    .select('id, full_name, department, reason, departed_on, employee_id')
    .eq('org_id', orgId)
    .order('departed_on', { ascending: false })

  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    department: row.department,
    reason: row.reason,
    departedOn: row.departed_on,
    employeeId: row.employee_id,
  }))
}

export async function fetchSalidas(): Promise<AsistenciaResult<SalidaData>> {
  try {
    const member = await requirePermission('asistencia:read')
    const supabase = await createClient()
    return { ok: true, data: await getSalidas(supabase, member.orgId) }
  } catch {
    return fail('No tienes permiso para ver las salidas.')
  }
}

export async function registrarSalida(
  input: z.input<typeof salidaSchema>,
): Promise<AsistenciaResult<SalidaData>> {
  try {
    const member = await requirePermission('asistencia:write')
    const parsed = salidaSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('departures').insert({
      org_id: member.orgId,
      employee_id: parsed.data.employeeId,
      full_name: parsed.data.fullName,
      department: parsed.data.department,
      reason: parsed.data.reason,
      departed_on: parsed.data.departedOn,
    })

    if (error) {
      console.error('[asistencia] registrarSalida', error)
      return fail('No se pudo registrar la salida.')
    }

    revalidatePath('/dashboard/asistencia')
    return { ok: true, data: await getSalidas(supabase, member.orgId) }
  } catch {
    return fail('No tienes permiso para gestionar asistencia.')
  }
}

export async function deleteSalida(id: string): Promise<AsistenciaResult<SalidaData>> {
  try {
    const member = await requirePermission('asistencia:write')
    if (!z.uuid().safeParse(id).success) return fail('Salida desconocida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('departures')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[asistencia] deleteSalida', error)
      return fail('No se pudo eliminar la salida.')
    }

    revalidatePath('/dashboard/asistencia')
    return { ok: true, data: await getSalidas(supabase, member.orgId) }
  } catch {
    return fail('No tienes permiso para gestionar asistencia.')
  }
}
