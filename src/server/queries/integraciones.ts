import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { scoped } from './shared'

/**
 * Integraciones: pasarela de pagos y WhatsApp.
 *
 * La consulta devuelve solo lo público (proveedor, llave pública, phone
 * number id, habilitado) y si hay secretos guardados en el vault — un
 * booleano por campo, nunca el valor. Leer un secreto solo lo hace la server
 * action que llama al proveedor, con el cliente admin.
 */

export interface PagosConfig {
  provider: string
  enabled: boolean
  publicKey: string
}

export interface WhatsappConfig {
  enabled: boolean
  phoneNumberId: string
}

export interface IntegracionesData {
  pagos: PagosConfig | null
  whatsapp: WhatsappConfig | null
  hasPagosPrivateKey: boolean
  hasPagosWebhook: boolean
  hasWhatsappToken: boolean
}

export async function getIntegraciones(): Promise<IntegracionesData> {
  const member = await requirePermission('integraciones:read')
  const supabase = await createClient()

  const [settingsResult, pkResult, whResult, waResult] = await Promise.all([
    scoped(supabase, member, 'integration_settings')
      .select('kind, provider, enabled, config')
      .limit(10),
    supabase.rpc('integraciones_has_secret', {
      p_org_id: member.orgId,
      p_kind: 'pagos',
      p_field: 'private_key',
    }),
    supabase.rpc('integraciones_has_secret', {
      p_org_id: member.orgId,
      p_kind: 'pagos',
      p_field: 'webhook_secret',
    }),
    supabase.rpc('integraciones_has_secret', {
      p_org_id: member.orgId,
      p_kind: 'whatsapp',
      p_field: 'token',
    }),
  ])

  const rows = (settingsResult.data ?? []) as unknown as {
    kind: string
    provider: string
    enabled: boolean
    config: { publicKey?: string; phoneNumberId?: string } | null
  }[]

  const pagos = rows.find((r) => r.kind === 'pagos')
  const whatsapp = rows.find((r) => r.kind === 'whatsapp')

  return {
    pagos: pagos
      ? {
          provider: pagos.provider,
          enabled: pagos.enabled,
          publicKey: pagos.config?.publicKey ?? '',
        }
      : null,
    whatsapp: whatsapp
      ? {
          enabled: whatsapp.enabled,
          phoneNumberId: whatsapp.config?.phoneNumberId ?? '',
        }
      : null,
    hasPagosPrivateKey: pkResult.data === true,
    hasPagosWebhook: whResult.data === true,
    hasWhatsappToken: waResult.data === true,
  }
}
