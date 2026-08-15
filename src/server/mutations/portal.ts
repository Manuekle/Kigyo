'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { getPortal, type PortalData } from '@/server/queries/portal'

export type PortalResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar enlaces públicos.'

async function refreshed(): Promise<PortalResult<PortalData>> {
  revalidatePath('/dashboard/portal')
  return { ok: true, data: await getPortal() }
}

const createLinkSchema = z.object({
  kind: z.enum(['factura', 'cita', 'avance']),
  targetId: z.string().uuid(),
  label: z.string().trim().min(2).max(120),
  days: z.coerce.number().int().min(1).max(30),
  maxViews: z
    .union([z.coerce.number().int().min(1).max(1000), z.null(), z.literal('')])
    .transform((v) => (v === '' || v === null ? null : v)),
})

export type CreateLinkInput = z.input<typeof createLinkSchema>

export interface CreateLinkResult {
  token: string
  url: string
  data: PortalData
}

export async function createLink(
  input: CreateLinkInput,
): Promise<{ ok: true; token: string; url: string; data: PortalData } | { ok: false; error: string }> {
  try {
    await requirePermission('portal:write')
    const parsed = createLinkSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { data: token, error } = await supabase.rpc('portal_create', {
      p_kind: parsed.data.kind,
      p_target_id: parsed.data.targetId,
      p_label: parsed.data.label,
      p_days: parsed.data.days,
      p_max_views: parsed.data.maxViews ?? null,
    })

    if (error) {
      console.error('[portal] createLink', error)
      return fail(
        error.message.includes('no existe')
          ? 'No puedes compartir algo que no ves. Elige otra entidad.'
          : 'No se pudo crear el enlace.',
      )
    }

    const url = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/portal/${token}`
    revalidatePath('/dashboard/portal')
    return { ok: true, token, url, data: await getPortal() }
  } catch {
    return fail(DENIED)
  }
}

export async function revokeLink(id: string): Promise<PortalResult<PortalData>> {
  try {
    const member = await requirePermission('portal:write')
    if (!z.uuid().safeParse(id).success) return fail('Enlace inválido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('portal_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[portal] revokeLink', error)
      return fail('No se pudo revocar el enlace.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteLink(id: string): Promise<PortalResult<PortalData>> {
  try {
    const member = await requirePermission('portal:write')
    if (!z.uuid().safeParse(id).success) return fail('Enlace inválido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('portal_links')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[portal] deleteLink', error)
      return fail('No se pudo eliminar el enlace.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
