'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import {
  HSEQ_CATEGORIES, HSEQ_KINDS, HSEQ_PRIORITIES, HSEQ_SEVERITIES, HSEQ_STATUSES,
} from '@/lib/domain'
import { belongsToOrg, currentEmployeeId } from '@/server/queries/shared'
import { getHseq, type HseqData } from '@/server/queries/hseq'

export type HseqResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const createSchema = z.object({
  category: z.enum(HSEQ_CATEGORIES).default('Seguridad'),
  kind: z.enum(HSEQ_KINDS).default('Incidente'),
  priority: z.enum(HSEQ_PRIORITIES).default('Media'),
  severity: z.enum(HSEQ_SEVERITIES).default('Media'),
  area: z.string().trim().max(120).default(''),
  projectId: z.uuid().nullable().default(null),
  location: z.string().trim().max(160).default(''),
  amountCents: z.number().int().min(0, 'El monto no puede ser negativo.').default(0),
  ownerId: z.uuid().nullable().default(null),
  notes: z.string().trim().max(4000).default(''),
  dueOn: z.string().date().nullable().default(null),
  checklist: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
})

export async function createHseqReport(
  input: z.input<typeof createSchema>,
): Promise<HseqResult<HseqData>> {
  try {
    const member = await requirePermission('hseq:write')
    const parsed = createSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    // Both foreign keys are validated against *this* organization: RLS on
    // `hseq_reports` checks the report's own org, not what it points at.
    if (!(await belongsToOrg(supabase, 'employees', parsed.data.ownerId, member.orgId))) {
      return fail('Ese responsable no está en el equipo de tu organización.')
    }
    if (!(await belongsToOrg(supabase, 'projects', parsed.data.projectId, member.orgId))) {
      return fail('Ese proyecto no pertenece a tu organización.')
    }

    const { data: report, error } = await supabase
      .from('hseq_reports')
      .insert({
        org_id: member.orgId,
        category: parsed.data.category,
        kind: parsed.data.kind,
        status: 'Pendiente',
        priority: parsed.data.priority,
        severity: parsed.data.severity,
        area: parsed.data.area,
        project_id: parsed.data.projectId,
        location: parsed.data.location,
        amount_cents: parsed.data.amountCents,
        owner_id: parsed.data.ownerId,
        notes: parsed.data.notes,
        due_on: parsed.data.dueOn,
      })
      .select('id')
      .single()

    if (error || !report) {
      console.error('[hseq] createHseqReport', error)
      return fail('No se pudo registrar el trámite.')
    }

    if (parsed.data.checklist.length > 0) {
      await supabase.from('hseq_checklist_items').insert(
        parsed.data.checklist.map((label, position) => ({
          hseq_report_id: report.id,
          label,
          position,
        })),
      )
    }

    revalidatePath('/dashboard/hseq')
    return { ok: true, data: await getHseq() }
  } catch {
    return fail('No tienes permiso para gestionar HSEQ.')
  }
}

const statusSchema = z.object({
  id: z.uuid(),
  status: z.enum(HSEQ_STATUSES),
})

export async function setHseqStatus(
  input: z.input<typeof statusSchema>,
): Promise<HseqResult<HseqData>> {
  try {
    const member = await requirePermission('hseq:write')
    const parsed = statusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('hseq_reports')
      .update({
        status: parsed.data.status,
        // Cleared on reopen. A closing date on an open report would make the
        // derived `overdue` flag disagree with the badge next to it.
        closed_at: parsed.data.status === 'Cerrado' ? new Date().toISOString() : null,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[hseq] setHseqStatus', error)
      return fail('No se pudo actualizar el trámite.')
    }

    revalidatePath('/dashboard/hseq')
    return { ok: true, data: await getHseq() }
  } catch {
    return fail('No tienes permiso para gestionar HSEQ.')
  }
}

const checkSchema = z.object({ itemId: z.uuid(), isDone: z.boolean() })

export async function toggleHseqChecklistItem(
  input: z.input<typeof checkSchema>,
): Promise<HseqResult<HseqData>> {
  try {
    await requirePermission('hseq:write')
    const parsed = checkSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    // RLS on `hseq_checklist_items` inherits from the parent report, so an id
    // from another organization matches no row and updates nothing.
    const supabase = await createClient()
    const { error } = await supabase
      .from('hseq_checklist_items')
      .update({ is_done: parsed.data.isDone })
      .eq('id', parsed.data.itemId)

    if (error) {
      console.error('[hseq] toggleHseqChecklistItem', error)
      return fail('No se pudo actualizar el checklist.')
    }

    revalidatePath('/dashboard/hseq')
    return { ok: true, data: await getHseq() }
  } catch {
    return fail('No tienes permiso para gestionar HSEQ.')
  }
}

const updateSchema = z.object({
  reportId: z.uuid(),
  note: z.string().trim().min(2, 'Escribe la novedad.').max(2000),
})

/**
 * Append a follow-up note.
 *
 * The seed carried an `updates` array per report and there was no way to add
 * one — the timeline was decoration. The author comes from the session, not
 * from the form.
 */
export async function addHseqUpdate(
  input: z.input<typeof updateSchema>,
): Promise<HseqResult<HseqData>> {
  try {
    const member = await requirePermission('hseq:write')
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const actorId = await currentEmployeeId(supabase, member.orgId, member.userId)

    const { error } = await supabase.from('hseq_updates').insert({
      hseq_report_id: parsed.data.reportId,
      actor_id: actorId,
      note: parsed.data.note,
    })

    if (error) {
      console.error('[hseq] addHseqUpdate', error)
      return fail('No se pudo registrar la novedad.')
    }

    revalidatePath('/dashboard/hseq')
    return { ok: true, data: await getHseq() }
  } catch {
    return fail('No tienes permiso para gestionar HSEQ.')
  }
}
