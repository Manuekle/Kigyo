'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { SITE_URL } from '@/lib/site'
import { getPortal, type PortalData } from '@/server/queries/portal'

export type PortalResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar enlaces públicos.'

/** Genera el token del portal de tickets y devuelve el enlace completo. */
export async function createTicketPortalToken(clientId: string): Promise<
  { ok: true; token: string; url: string } | { ok: false; error: string }
> {
  try {
    const member = await requirePermission('clientes:write')
    if (!member) return fail('No tienes permiso para gestionar clientes.')
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('create_ticket_portal_token', {
      p_client_id: clientId,
    })
    if (error || !data) {
      console.error('[portal] createTicketPortalToken', error)
      return fail(error?.message ?? 'No se pudo generar el enlace.')
    }
    return { ok: true, token: data as string, url: `${SITE_URL}/soporte/${data}` }
  } catch (err) {
    console.error('[portal] createTicketPortalToken', err)
    return fail('No se pudo generar el enlace.')
  }
}

/** Revoca todos los tokens activos de un cliente. */
export async function revokeTicketPortalTokens(clientId: string): Promise<
  { ok: true; revoked: number } | { ok: false; error: string }
> {
  try {
    const member = await requirePermission('clientes:write')
    if (!member) return fail('No tienes permiso para gestionar clientes.')
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('revoke_ticket_portal_tokens', {
      p_client_id: clientId,
    })
    if (error) {
      console.error('[portal] revokeTicketPortalTokens', error)
      return fail(error?.message ?? 'No se pudo revocar el enlace.')
    }
    return { ok: true, revoked: (data as number) ?? 0 }
  } catch (err) {
    console.error('[portal] revokeTicketPortalTokens', err)
    return fail('No se pudo revocar el enlace.')
  }
}

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

    /*
     * `SITE_URL` y no `process.env.NEXT_PUBLIC_APP_URL` a pelo.
     *
     * Estas dos funciones leían la variable directamente y con respaldos
     * distintos: una caía a `http://localhost:3000` y la otra a `''`. La segunda
     * es la que dolía — sin la variable, el enlace que la aplicación entrega
     * para *compartir con un cliente* salía como `/portal/<token>`, una ruta
     * relativa, que fuera de esta pestaña no lleva a ninguna parte. Y salía sin
     * error: un enlace roto tiene el mismo aspecto que uno bueno hasta que
     * alguien intenta abrirlo.
     *
     * `lib/site.ts` existe justo para esto y respalda con el dominio real,
     * porque un despliegue al que se le olvidó la variable debe declarar el
     * dominio bueno y no uno inventado.
     */
    const url = `${SITE_URL}/portal/${token}`
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
