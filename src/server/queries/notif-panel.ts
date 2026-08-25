import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { scoped } from './shared'
import { todayIn } from '@/lib/domain'

/**
 * Panel de notificaciones: reglas, bitácora y próximos recordatorios.
 *
 * Separado de `queries/notificaciones.ts` a propósito. Aquel archivo alimenta
 * la campana del Topbar con eventos derivados (firmas pendientes, riesgos
 * abiertos, HSEQ vencido, próxima reunión) y no debe tocarse: la campana no
 * puede volverse una forma de enterarse de lo que hay en módulos que el
 * miembro no puede abrir, y sus fuentes son otras.
 *
 * Este módulo es el panel completo de `/dashboard/notificaciones`: las reglas
 * de recordatorio que el cliente configura (`notification_rules`), la bitácora
 * de envíos (`notification_log`) y los próximos recordatorios reales que
 * dispararán las reglas — citas, vencimientos de factura y renovaciones de
 * suscripción, cada uno desde su propia tabla.
 */

export interface RuleRow {
  id: string
  name: string
  kind: string
  daysBefore: number
  channel: string
  enabled: boolean
}

export interface LogRow {
  id: string
  kind: string
  recipient: string
  channel: string
  status: string
  sentAt: string
  error: string | null
}

export interface UpcomingRow {
  kind: string
  subject: string
  when: string
  daysLeft: number
}

export interface NotifPanelData {
  rules: RuleRow[]
  log: LogRow[]
  upcoming: UpcomingRow[]
}

interface UpcomingRecord {
  when: string
  subject: string | null
  kind: string
}

const DAY_MS = 86_400_000

/**
 * Días hasta la fecha, nunca negativo. **No** es `daysUntil` de lib/domain.ts.
 *
 * Se dejó aparte a propósito, y conviene decir por qué para que nadie las
 * fusione: aquella resta dos fechas y devuelve el signo; esta acota en cero y
 * recibe una columna que mezcla dos tipos — `patient_appointments.scheduled_for`
 * es `timestamptz`, mientras que `contracts.due_on` y
 * `subscriptions.next_charge_on` son `date`.
 *
 * La mezcla se resuelve aquí, no en la pantalla: para `timestamptz` se convierte
 * a la zona horaria de la empresa antes de extraer la fecha (una cita a las
 * 22:00 de Bogotá es 03:00 UTC del día siguiente — sin conversión diría «en 1
 * día» de algo que es hoy); para `date` se usa la fecha directamente, porque
 * `new Date('2026-08-21')` interpreta UTC medianoche y al convertir a la zona
 * puede saltar al día anterior.
 *
 * Comparar fecha contra fecha a medianoche, no fracciones de día: una cita de
 * hoy a las 15:00 dice «hoy» (0), no «en 1 día».
 */
function daysUntil(when: string, hoy: string, timezone: string): number {
  const whenDate = when.includes('T')
    ? new Date(when).toLocaleDateString('sv-SE', { timeZone: timezone })
    : when.slice(0, 10)
  const today = new Date(`${hoy}T00:00:00`)
  const target = new Date(`${whenDate}T00:00:00`)
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / DAY_MS))
}

export async function getNotifPanel(): Promise<NotifPanelData> {
  const member = await requirePermission('notificaciones:read')
  const supabase = await createClient()

  const nowIso = new Date().toISOString()
  const todayYmd = nowIso.slice(0, 10)

  const [rulesResult, logResult, patientsResult, invoicesResult, subsResult] =
    await Promise.all([
      scoped(supabase, member, 'notification_rules')
        .select('id, name, kind, days_before, channel, enabled')
        .order('kind')
        .order('name'),
      scoped(supabase, member, 'notification_log')
        .select('id, kind, recipient, channel, status, sent_at, error')
        .order('sent_at', { ascending: false })
        .limit(100),
      // `patient_appointments` no lleva `org_id`: es hija de `patients` y su
      // aislamiento se hereda. Igual que en `pacientes.ts`, primero se piden
      // los pacientes vivos de esta organización y luego los turnos que les
      // pertenecen — nunca un `.from('patient_appointments')` suelto.
      scoped(supabase, member, 'patients')
        .select('id')
        .is('deleted_at', null)
        .limit(200),
      scoped(supabase, member, 'invoices')
        .select('due_on, code')
        .is('deleted_at', null)
        .gte('due_on', todayYmd)
        .order('due_on', { ascending: true })
        .limit(30),
      scoped(supabase, member, 'subscriptions')
        .select('next_charge_on, clients ( name )')
        .gte('next_charge_on', todayYmd)
        .order('next_charge_on', { ascending: true })
        .limit(30),
    ])

  if (rulesResult.error) console.error('[notif-panel] rules', rulesResult.error)
  if (logResult.error) console.error('[notif-panel] log', logResult.error)
  if (patientsResult.error) console.error('[notif-panel] patients', patientsResult.error)
  if (invoicesResult.error) console.error('[notif-panel] invoices', invoicesResult.error)
  if (subsResult.error) console.error('[notif-panel] subscriptions', subsResult.error)

  const raw = supabase as unknown as SupabaseClient
  const patientIds = ((patientsResult.data ?? []) as Array<{ id: string }>).map((p) => p.id)

  const citaResult = patientIds.length
    ? await raw
        .from('patient_appointments')
        .select('scheduled_for, patients ( full_name )')
        .in('patient_id', patientIds)
        .gte('scheduled_for', nowIso)
        .order('scheduled_for', { ascending: true })
        .limit(30)
    : { data: [], error: null }

  if (citaResult.error) console.error('[notif-panel] citas', citaResult.error)

  const citas = ((citaResult.data ?? []) as unknown as Array<{
    scheduled_for: string
    patients: { full_name: string } | null
  }>).map((r) => ({
    kind: 'cita',
    subject: r.patients?.full_name ?? 'Paciente',
    when: r.scheduled_for,
  }))

  const vencimientos = ((invoicesResult.data ?? []) as Array<{
    due_on: string
    code: string | null
  }>).map((r) => ({
    kind: 'vencimiento',
    subject: r.code ?? 'Factura',
    when: r.due_on,
  }))

  const renovaciones = ((subsResult.data ?? []) as Array<{
    next_charge_on: string
    clients: { name: string } | null
  }>).map((r) => ({
    kind: 'renovacion',
    subject: r.clients?.name ?? 'Suscripción',
    when: r.next_charge_on,
  }))

  const upcoming: UpcomingRow[] = (citas as UpcomingRecord[])
    .concat(vencimientos, renovaciones)
    .map((r) => ({ kind: r.kind, subject: r.subject ?? '', when: r.when, daysLeft: daysUntil(r.when, todayIn(member.orgTimezone), member.orgTimezone) }))
    .sort((a, b) => a.when.localeCompare(b.when))
    .slice(0, 30)

  return {
    rules: ((rulesResult.data ?? []) as Array<{
      id: string
      name: string
      kind: string
      days_before: number
      channel: string
      enabled: boolean
    }>).map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      daysBefore: r.days_before,
      channel: r.channel,
      enabled: r.enabled,
    })),
    log: ((logResult.data ?? []) as Array<{
      id: string
      kind: string
      recipient: string
      channel: string
      status: string
      sent_at: string
      error: string | null
    }>).map((r) => ({
      id: r.id,
      kind: r.kind,
      recipient: r.recipient,
      channel: r.channel,
      status: r.status,
      sentAt: r.sent_at,
      error: r.error,
    })),
    upcoming,
  }
}
