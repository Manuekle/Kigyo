import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { serverEnv } from '@/lib/env'
import { requirePermission } from '@/lib/auth/session'
import { allows, scoped } from './shared'

/**
 * Portal: enlaces públicos firmados a una entidad de solo lectura.
 *
 * La pantalla administra enlaces (crear, copiar, revocar, eliminar) y ofrece
 * como candidatos las entidades que el miembro puede ver por sus propios
 * permisos: facturas si ve `facturacion`, citas si ve `pacientes`, avances si
 * ve `obra`. Compartir algo que no puedes abrir no debería ser posible ni en
 * la interfaz.
 */

export type PortalKind = 'factura' | 'cita' | 'avance'

export type PortalLinkStatus = 'Activo' | 'Vencido' | 'Revocado' | 'Agotado'

export interface PortalLinkRow {
  id: string
  kind: PortalKind
  label: string
  targetId: string
  token: string
  expiresAt: string
  maxViews: number | null
  viewCount: number
  lastViewedAt: string | null
  revokedAt: string | null
  createdAt: string
  status: PortalLinkStatus
}

export interface FacturaTarget {
  id: string
  code: string | null
  client: string
  totalCents: number
  status: string
}

export interface CitaTarget {
  id: string
  scheduledFor: string
  status: string
  patient: string
}

export interface AvanceTarget {
  id: string
  name: string
  estado: string
}

export interface PortalData {
  links: PortalLinkRow[]
  baseUrl: string
  facturas: FacturaTarget[]
  citas: CitaTarget[]
  avances: AvanceTarget[]
  vistasCount: number
}

const num = (v: string | number | null | undefined): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

function statusOf(
  revokedAt: string | null,
  expiresAt: string,
  maxViews: number | null,
  viewCount: number,
): PortalLinkStatus {
  if (revokedAt) return 'Revocado'
  if (new Date(expiresAt).getTime() <= Date.now()) return 'Vencido'
  if (maxViews !== null && viewCount >= maxViews) return 'Agotado'
  return 'Activo'
}

interface LinkRecord {
  id: string
  kind: PortalKind
  label: string
  target_id: string
  token: string
  expires_at: string
  max_views: number | null
  view_count: number
  last_viewed_at: string | null
  revoked_at: string | null
  created_at: string
}

export async function getPortal(): Promise<PortalData> {
  const member = await requirePermission('portal:read')
  const supabase = await createClient()

  const [linksResult, facturasResult, citasResult, avancesResult] = await Promise.all([
    scoped(supabase, member, 'portal_links')
      .select(
        'id, kind, label, target_id, token, expires_at, max_views, view_count, ' +
          'last_viewed_at, revoked_at, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(200),
    allows(member, 'facturacion:read')
      ? scoped(supabase, member, 'invoices')
          .select('id, code, client_name, total_cents, status')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
    allows(member, 'pacientes:read')
      ? supabase
          .from('patient_appointments')
          .select('id, scheduled_for, status, patients ( full_name )')
          .eq('patients.org_id', member.orgId)
          .order('scheduled_for', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
    allows(member, 'obra:read')
      ? scoped(supabase, member, 'obra_presupuestos')
          .select('id, name, estado')
          .order('created_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
  ])

  const links = ((linksResult.data ?? []) as unknown as LinkRecord[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    label: r.label,
    targetId: r.target_id,
    token: r.token,
    expiresAt: r.expires_at,
    maxViews: r.max_views,
    viewCount: r.view_count,
    lastViewedAt: r.last_viewed_at,
    revokedAt: r.revoked_at,
    createdAt: r.created_at,
    status: statusOf(r.revoked_at, r.expires_at, r.max_views, r.view_count),
  }))

  return {
    links,
    baseUrl: serverEnv().NEXT_PUBLIC_APP_URL,
    facturas: ((facturasResult.data ?? []) as unknown as {
      id: string
      code: string | null
      client_name: string
      total_cents: string | number | null
      status: string
    }[]).map((r) => ({
      id: r.id,
      code: r.code,
      client: r.client_name,
      totalCents: num(r.total_cents),
      status: r.status,
    })),
    citas: ((citasResult.data ?? []) as unknown as {
      id: string
      scheduled_for: string
      status: string
      patients: { full_name: string } | null
    }[]).map((r) => ({
      id: r.id,
      scheduledFor: r.scheduled_for,
      status: r.status,
      patient: r.patients?.full_name ?? '—',
    })),
    avances: ((avancesResult.data ?? []) as unknown as {
      id: string
      name: string
      estado: string
    }[]).map((r) => ({
      id: r.id,
      name: r.name,
      estado: r.estado,
    })),
    vistasCount: links.reduce((acc, l) => acc + l.viewCount, 0),
  }
}
