import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getMember } from '@/lib/auth/session'
import { can, type Permission } from '@/lib/auth/permissions'
import { todayIn } from '@/lib/domain'

/**
 * The bell, derived from real rows.
 *
 * The panel used to render four fixed entries from `lib/data/dashboard.ts` —
 * including "Riesgo alto: Mateo Herrera · rotación 82%", an invented attrition
 * score about a named employee, and "Nómina julio procesada · COP $191M",
 * a figure from the payroll fixture. The count on the badge was the length of
 * that array, so it read "4" forever and clicking through changed nothing.
 *
 * There is no `notifications` table and nothing produces events, so rather
 * than inventing one, this counts things that are actually true right now:
 * signatures waiting, risks left open, HSEQ past due, meetings about to start.
 * Every source is gated on its own module *and* permission — the bell must not
 * become a way to learn what is in a module you cannot open.
 */

export interface Notificacion {
  id: string
  tone: 'amb' | 'red' | 'blu' | 'grn'
  title: string
  body: string
  href: string
}

/** Both gates, same order the route guards apply them. */
function allows(
  modules: Set<string>,
  permissions: Set<Permission>,
  permission: Permission,
): boolean {
  return modules.has(permission.split(':')[0]) && can(permissions, permission)
}

export async function getNotificaciones(): Promise<Notificacion[]> {
  const member = await getMember()
  if (!member) return []

  const supabase = await createClient()
  const today = todayIn(member.orgTimezone)
  const out: Notificacion[] = []

  const wants = {
    firmas: allows(member.modules, member.permissions, 'firmas:read'),
    riesgos: allows(member.modules, member.permissions, 'riesgos:read'),
    hseq: allows(member.modules, member.permissions, 'hseq:read'),
    calendario: allows(member.modules, member.permissions, 'calendario:read'),
  }

  const [firmas, riesgos, hseq, eventos] = await Promise.all([
    wants.firmas
      ? supabase
          .from('signature_requests')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', member.orgId)
          .is('deleted_at', null)
          .eq('status', 'Pendiente')
      : Promise.resolve({ count: 0 }),
    wants.riesgos
      ? supabase
          .from('risks')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', member.orgId)
          .is('deleted_at', null)
          .eq('status', 'Abierto')
          .eq('severity', 'Alta')
      : Promise.resolve({ count: 0 }),
    wants.hseq
      ? supabase
          .from('hseq_reports')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', member.orgId)
          .is('deleted_at', null)
          .is('closed_at', null)
          .lt('due_on', today)
      : Promise.resolve({ count: 0 }),
    wants.calendario
      ? supabase
          .from('calendar_events')
          .select('id, title, starts_at')
          .eq('org_id', member.orgId)
          .is('deleted_at', null)
          .gte('starts_at', new Date().toISOString())
          // Next 24 hours: "en 30 minutos" needs a window, and a meeting next
          // month is not a notification.
          .lt('starts_at', new Date(Date.now() + 86_400_000).toISOString())
          .order('starts_at', { ascending: true })
          .limit(1)
      : Promise.resolve({ data: [] }),
  ])

  const firmaCount = (firmas as { count: number | null }).count ?? 0
  if (firmaCount > 0) {
    out.push({
      id: 'firmas',
      tone: 'amb',
      title: firmaCount === 1 ? '1 documento pendiente de firma' : `${firmaCount} documentos pendientes de firma`,
      body: 'Revisa las solicitudes abiertas',
      href: '/dashboard/firmas',
    })
  }

  const riesgoCount = (riesgos as { count: number | null }).count ?? 0
  if (riesgoCount > 0) {
    out.push({
      id: 'riesgos',
      tone: 'red',
      title: riesgoCount === 1 ? '1 riesgo alto abierto' : `${riesgoCount} riesgos altos abiertos`,
      body: 'Sin mitigar todavía',
      href: '/dashboard/riesgos',
    })
  }

  const hseqCount = (hseq as { count: number | null }).count ?? 0
  if (hseqCount > 0) {
    out.push({
      id: 'hseq',
      tone: 'red',
      title: hseqCount === 1 ? '1 trámite HSEQ vencido' : `${hseqCount} trámites HSEQ vencidos`,
      body: 'Pasaron su fecha límite sin cerrarse',
      href: '/dashboard/hseq',
    })
  }

  const nextEvent = ((eventos as { data: Array<{ title: string; starts_at: string }> | null }).data ?? [])[0]
  if (nextEvent) {
    const minutes = Math.round((new Date(nextEvent.starts_at).getTime() - Date.now()) / 60_000)
    out.push({
      id: 'calendario',
      tone: 'blu',
      title: minutes <= 60 ? `Reunión en ${Math.max(1, minutes)} minutos` : 'Próxima reunión',
      body: nextEvent.title,
      href: '/dashboard/calendario',
    })
  }

  return out
}
