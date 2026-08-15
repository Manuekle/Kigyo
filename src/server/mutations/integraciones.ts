'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/session'
import { getIntegraciones, type IntegracionesData } from '@/server/queries/integraciones'

export type IntegracionesResult<T> = { ok: true; data: T } | { ok: false; error: string }

/** Resultado de una prueba de conexión: mensaje, no datos. */
export type TestResult = { ok: true; message: string } | { ok: false; message: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar integraciones.'

async function refreshed(): Promise<IntegracionesResult<IntegracionesData>> {
  revalidatePath('/dashboard/integraciones')
  return { ok: true, data: await getIntegraciones() }
}

/** Nombre del secreto en el vault. El namespace lo valida el RPC de puerta. */
function secretName(orgId: string, kind: 'pagos' | 'whatsapp', field: string): string {
  return `integraciones.${orgId}.${kind}.${field}`
}

/* ─── Pasarela ────────────────────────────────────────────────────────────── */

const saveGatewaySchema = z.object({
  provider: z.enum(['wompi', 'payu', 'epayco', 'stripe', 'otro']).default('wompi'),
  publicKey: z.string().trim().max(200).default(''),
  privateKey: z.string().trim().max(400).default(''),
  webhookSecret: z.string().trim().max(200).default(''),
  enabled: z.boolean().default(false),
})

export async function saveGateway(
  input: z.input<typeof saveGatewaySchema>,
): Promise<IntegracionesResult<IntegracionesData>> {
  try {
    const member = await requirePermission('integraciones:write')
    const parsed = saveGatewaySchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('integration_settings').upsert(
      {
        org_id: member.orgId,
        kind: 'pagos',
        provider: parsed.data.provider,
        enabled: parsed.data.enabled,
        config: { publicKey: parsed.data.publicKey },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,kind' },
    )

    if (error) {
      console.error('[integraciones] saveGateway settings', error)
      return fail('No se pudo guardar la configuración.')
    }

    // Los secretos van al vault, por la puerta de service_role. Solo se
    // escribe lo que vino no vacío: un campo vacío conserva el secreto previo.
    const admin = createAdminClient()
    for (const [field, value] of [
      ['private_key', parsed.data.privateKey],
      ['webhook_secret', parsed.data.webhookSecret],
    ] as const) {
      if (!value) continue
      const { error: vaultError } = await admin.rpc('integraciones_set_secret', {
        p_name: secretName(member.orgId, 'pagos', field),
        p_value: value,
      })
      if (vaultError) {
        console.error('[integraciones] saveGateway vault', vaultError)
        return fail('La configuración se guardó, pero el secreto no entró al vault.')
      }
    }

    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function testGateway(): Promise<TestResult> {
  try {
    const member = await requirePermission('integraciones:write')
    const data = await getIntegraciones()
    if (!data.pagos) return { ok: false, message: 'Configura la pasarela primero.' }

    if (data.pagos.provider !== 'wompi') {
      return {
        ok: false,
        message: 'La prueba automática está disponible para Wompi. Guarda y prueba con una transacción real.',
      }
    }
    if (!data.pagos.publicKey || !data.hasPagosPrivateKey) {
      return { ok: false, message: 'Faltan la llave pública o la privada.' }
    }

    const admin = createAdminClient()
    const { data: privateKey, error: secretError } = await admin.rpc('integraciones_get_secret', {
      p_name: secretName(member.orgId, 'pagos', 'private_key'),
    })
    if (secretError || !privateKey) {
      console.error('[integraciones] testGateway secret', secretError)
      return { ok: false, message: 'No se pudo leer la llave privada del vault.' }
    }

    const res = await fetch(`https://production.wompi.co/v1/merchants/${data.pagos.publicKey}`, {
      headers: { Authorization: `Bearer ${privateKey}` },
      cache: 'no-store',
    })

    if (!res.ok) {
      return {
        ok: false,
        message: `Wompi respondió ${res.status}. Revisa la llave pública y la privada.`,
      }
    }
    const merchant = (await res.json()) as { data?: { presigned_acceptance?: boolean } }
    if (!merchant.data?.presigned_acceptance) {
      return { ok: false, message: 'La llave responde, pero el comercio no está activo en Wompi.' }
    }
    return { ok: true, message: 'Conexión con Wompi verificada.' }
  } catch (e) {
    console.error('[integraciones] testGateway', e)
    return { ok: false, message: 'No se pudo probar la conexión.' }
  }
}

/* ─── WhatsApp ────────────────────────────────────────────────────────────── */

const saveWhatsappSchema = z.object({
  token: z.string().trim().max(500).default(''),
  phoneNumberId: z.string().trim().max(100).default(''),
  enabled: z.boolean().default(false),
})

export async function saveWhatsapp(
  input: z.input<typeof saveWhatsappSchema>,
): Promise<IntegracionesResult<IntegracionesData>> {
  try {
    const member = await requirePermission('integraciones:write')
    const parsed = saveWhatsappSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('integration_settings').upsert(
      {
        org_id: member.orgId,
        kind: 'whatsapp',
        provider: 'whatsapp',
        enabled: parsed.data.enabled,
        config: { phoneNumberId: parsed.data.phoneNumberId },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,kind' },
    )

    if (error) {
      console.error('[integraciones] saveWhatsapp settings', error)
      return fail('No se pudo guardar la configuración.')
    }

    if (parsed.data.token) {
      const admin = createAdminClient()
      const { error: vaultError } = await admin.rpc('integraciones_set_secret', {
        p_name: secretName(member.orgId, 'whatsapp', 'token'),
        p_value: parsed.data.token,
      })
      if (vaultError) {
        console.error('[integraciones] saveWhatsapp vault', vaultError)
        return fail('La configuración se guardó, pero el token no entró al vault.')
      }
    }

    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function testWhatsapp(): Promise<TestResult> {
  try {
    const member = await requirePermission('integraciones:write')
    const data = await getIntegraciones()
    if (!data.whatsapp || !data.whatsapp.phoneNumberId) {
      return { ok: false, message: 'Guarda el phone number id primero.' }
    }
    if (!data.hasWhatsappToken) {
      return { ok: false, message: 'Falta el token de acceso.' }
    }

    const admin = createAdminClient()
    const { data: token, error: secretError } = await admin.rpc('integraciones_get_secret', {
      p_name: secretName(member.orgId, 'whatsapp', 'token'),
    })
    if (secretError || !token) {
      console.error('[integraciones] testWhatsapp secret', secretError)
      return { ok: false, message: 'No se pudo leer el token del vault.' }
    }

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${data.whatsapp.phoneNumberId}` +
        '?fields=display_phone_number,verified_name,quality_rating',
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    )

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null
      const detail = body?.error?.message ?? `HTTP ${res.status}`
      return { ok: false, message: `Meta respondió: ${detail}` }
    }

    const info = (await res.json()) as { display_phone_number?: string; verified_name?: string }
    return {
      ok: true,
      message: `Conectado: ${info.verified_name ?? 'cuenta verificada'} · ${info.display_phone_number ?? ''}`.trim(),
    }
  } catch (e) {
    console.error('[integraciones] testWhatsapp', e)
    return { ok: false, message: 'No se pudo probar la conexión.' }
  }
}
