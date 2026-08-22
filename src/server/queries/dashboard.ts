import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can, type Permission } from '@/lib/auth/permissions'
import { cop } from '@/lib/utils'
import { todayIn } from '@/lib/domain'
import type { Member } from '@/lib/auth/session'

/**
 * The overview, counted from real rows.
 *
 * Everything on this screen used to be typed into the source: "142 empleados
 * activos · +4.2% vs. mes anterior" with a six-point sparkline, a six-month
 * activity chart, an "Índice de salud organizacional" of 82 computed by
 * weighting six invented factors, three recommendations, and an activity feed
 * of eight events attributed to named colleagues. None of it moved, and none
 * of it was about the organization looking at it.
 *
 * Every figure below is a count against a table this app now writes to, and
 * every section is gated on its own module *and* permission — the dashboard
 * must not become a way to read totals out of a module you cannot open.
 */

export interface DashboardKpi {
  key: string
  label: string
  value: string
  sub: string
  tone: 'blu' | 'grn' | 'amb' | 'red' | 'neu' | 'vio'
  /**
   * Whether this tile is reporting nothing, as a fact rather than as a string
   * comparison. Counts render as `'0'` and answer for themselves; a formatted
   * amount renders as `'$ 0'` and does not, which quietly made `isEmpty` false
   * for every company with `pos` on — precisely the shops and restaurants that
   * most needed the getting-started panel.
   */
  zero?: boolean
}

export interface DashboardPendiente {
  id: string
  title: string
  detail: string
  href: string
}

export interface ActividadPoint {
  month: string
  firmas: number
  documentos: number
}

export interface DashboardData {
  kpis: DashboardKpi[]
  /** Signature requests still waiting, newest first. */
  pendientes: DashboardPendiente[]
  /** Real audit-log entries — who did what, from `audit_log`. */
  actividad: Array<{ id: string; who: string; what: string; at: string }>
  /** Six months of signed documents vs documents created. */
  serie: ActividadPoint[]
  orgName: string
  /**
   * Which panels to render. Same gates that decide the KPIs, so a company
   * that never switched `firmas` on gets neither the six-month chart nor the
   * pending-signatures card, and one without `trazabilidad` gets no activity
   * feed — a panel explaining "there is nothing to show" is noise when the
   * module is not even part of the plan.
   */
  show: {
    documental: boolean
    firmas: boolean
    trazabilidad: boolean
  }
  /**
   * Nothing has been entered yet — every counter the caller can see is zero
   * and nothing has happened.
   *
   * Derived from the reads this function already makes rather than from a new
   * "created recently" query, because age is the wrong question: an account
   * opened in March that still has no data needs the same help as one opened
   * this morning, and one that filled its directory on day one does not need
   * it at all. A dashboard of zeros is not a report, it is a blank page with
   * decorations — this is what lets it be replaced with somewhere to start.
   *
   * `false` for a caller whose role sees no counters at all: an empty KPI list
   * means "you may not look", not "there is nothing there", and greeting an
   * employee with the administrator's setup checklist would be wrong twice.
   */
  isEmpty: boolean
}

function allows(member: Member, permission: Permission): boolean {
  return member.modules.has(permission.split(':')[0]) && can(member.permissions, permission)
}

const MONTH = new Intl.DateTimeFormat('es-CO', { month: 'short' })

/** Reads as a sentence rather than as `insert · signature_requests`. */
const ACTION_VERB: Record<string, string> = {
  insert: 'creó', update: 'actualizó', delete: 'eliminó',
}
const TABLE_NOUN: Record<string, string> = {
  employees: 'un empleado',
  projects: 'un proyecto',
  tickets: 'un ticket',
  signature_requests: 'una solicitud de firma',
  documents: 'un documento',
  risks: 'un riesgo',
  hseq_reports: 'un trámite HSEQ',
  quotes: 'una cotización',
  purchase_requests: 'una requisición',
  purchase_orders: 'una orden de compra',
  inventory_assets: 'un activo',
  products: 'un producto',
  absences: 'una ausencia',
  calendar_events: 'un evento',
  consultations: 'una consulta',
}

export async function getDashboard(): Promise<DashboardData> {
  const member = await requirePermission('dashboard:read')
  const supabase = await createClient()

  const today = todayIn(member.orgTimezone)
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  sixMonthsAgo.setDate(1)
  const since = sixMonthsAgo.toISOString()

  const wants = {
    empleados: allows(member, 'empleados:read'),
    firmas: allows(member, 'firmas:read'),
    riesgos: allows(member, 'riesgos:read'),
    tickets: allows(member, 'tickets:read'),
    proyectos: allows(member, 'proyectos:read'),
    documentos: allows(member, 'documentos:read'),
    trazabilidad: allows(member, 'trazabilidad:read'),
    ventas: allows(member, 'pos:read'),
    clientes: allows(member, 'clientes:read'),
    leads: allows(member, 'leads:read'),
    cotizaciones: allows(member, 'cotizaciones:read'),
    inventario: allows(member, 'inventario:read'),
    hoteleria: allows(member, 'hoteleria:read'),
    pacientes: allows(member, 'pacientes:read'),
  }

  const [
    empleados, firmasPend, firmasHist, riesgos, tickets, proyectos, documentos, audit,
    ventasHoy, clientesAct, leadsAct, cotizAbiertas, prodActivos,
    habVendibles, habOcupadas, pacientesAct,
  ] = await Promise.all([
    wants.empleados
      ? supabase.from('employees').select('id', { count: 'exact', head: true })
          .eq('org_id', member.orgId).is('deleted_at', null).eq('status', 'Activo')
      : Promise.resolve({ count: null }),
    wants.firmas
      ? supabase.from('signature_requests')
          .select('id, title, requested_on, due_on, employees ( full_name )')
          .eq('org_id', member.orgId).is('deleted_at', null).eq('status', 'Pendiente')
          .order('requested_on', { ascending: true }).limit(6)
      : Promise.resolve({ data: [] }),
    wants.firmas
      ? supabase.from('signature_requests').select('signed_at')
          .eq('org_id', member.orgId).is('deleted_at', null)
          .not('signed_at', 'is', null).gte('signed_at', since)
      : Promise.resolve({ data: [] }),
    wants.riesgos
      ? supabase.from('risks').select('severity')
          .eq('org_id', member.orgId).is('deleted_at', null).eq('status', 'Abierto')
      : Promise.resolve({ data: [] }),
    wants.tickets
      ? supabase.from('tickets').select('id', { count: 'exact', head: true })
          .eq('org_id', member.orgId).is('deleted_at', null).in('status', ['Abierto', 'En proceso'])
      : Promise.resolve({ count: null }),
    wants.proyectos
      ? supabase.from('projects').select('id', { count: 'exact', head: true })
          .eq('org_id', member.orgId).is('deleted_at', null).eq('status', 'En ejecución')
      : Promise.resolve({ count: null }),
    wants.documentos
      ? supabase.from('documents').select('created_at')
          .eq('org_id', member.orgId).is('deleted_at', null).gte('created_at', since)
      : Promise.resolve({ data: [] }),
    wants.trazabilidad
      ? supabase.from('audit_log')
          // `occurred_at`, not `created_at`, and the actor is denormalised to
          // `actor_email` so the entry survives the person being deleted.
          .select('id, action, table_name, record_code, occurred_at, actor_email, profiles ( full_name )')
          .eq('org_id', member.orgId)
          .order('occurred_at', { ascending: false }).limit(8)
      : Promise.resolve({ data: [] }),
    wants.ventas
      ? supabase.from('pos_sales').select('total_cents')
          .eq('org_id', member.orgId).eq('status', 'Pagada').gte('sold_at', today)
      : Promise.resolve({ data: [] }),
    wants.clientes
      ? supabase.from('clients').select('id', { count: 'exact', head: true })
          .eq('org_id', member.orgId).is('deleted_at', null).eq('status', 'Activo')
      : Promise.resolve({ count: null }),
    wants.leads
      ? supabase.from('leads').select('id', { count: 'exact', head: true })
          .eq('org_id', member.orgId).is('deleted_at', null)
          .in('stage', ['Nuevo', 'Contactado', 'Calificado'])
      : Promise.resolve({ count: null }),
    wants.cotizaciones
      ? supabase.from('quotes').select('id', { count: 'exact', head: true })
          .eq('org_id', member.orgId).is('deleted_at', null)
          .in('status', ['Borrador', 'Enviada'])
      : Promise.resolve({ count: null }),
    wants.inventario
      ? supabase.from('products').select('id', { count: 'exact', head: true })
          .eq('org_id', member.orgId).is('deleted_at', null).eq('is_active', true)
      : Promise.resolve({ count: null }),
    // Rooms sellable tonight. Out-of-service rooms leave the denominator:
    // a hotel with two rooms under repair is not running at lower occupancy,
    // it has fewer rooms.
    wants.hoteleria
      ? supabase.from('hotel_rooms').select('id', { count: 'exact', head: true })
          .eq('org_id', member.orgId).is('deleted_at', null)
          .not('status', 'in', '(Mantenimiento,Bloqueada)')
      : Promise.resolve({ count: null }),
    // Reservations spanning tonight, deduplicated by room in the KPI below.
    wants.hoteleria
      ? supabase.from('reservations').select('room_id')
          .eq('org_id', member.orgId).is('deleted_at', null)
          .lte('checkin_on', today).gt('checkout_on', today)
          .not('status', 'in', '(Cancelada,Check-out,No show)')
      : Promise.resolve({ data: [] }),
    wants.pacientes
      ? supabase.from('patients').select('id', { count: 'exact', head: true })
          .eq('org_id', member.orgId).is('deleted_at', null).eq('status', 'Activo')
      : Promise.resolve({ count: null }),
  ])

  const kpis: DashboardKpi[] = []

  const empleadoCount = (empleados as { count: number | null }).count
  if (empleadoCount !== null) {
    kpis.push({
      key: 'empleados', label: 'Empleados activos', tone: 'blu',
      value: String(empleadoCount), sub: 'en el directorio',
    })
  }

  const pendientes = ((firmasPend as { data: Array<{
    id: string; title: string; requested_on: string; due_on: string | null
    employees: { full_name: string } | null
  }> | null }).data ?? [])

  if (wants.firmas) {
    kpis.push({
      key: 'firmas', label: 'Firmas pendientes', tone: 'amb',
      value: String(pendientes.length),
      sub: pendientes.length === 0 ? 'nada por firmar' : 'esperando firma',
    })
  }

  const riesgoRows = ((riesgos as { data: Array<{ severity: string }> | null }).data ?? [])
  if (wants.riesgos) {
    const alta = riesgoRows.filter((r) => r.severity === 'Alta').length
    kpis.push({
      key: 'riesgos', label: 'Riesgos altos', tone: 'red',
      value: String(alta), sub: `${riesgoRows.length} abiertos en total`,
    })
  }

  const ticketCount = (tickets as { count: number | null }).count
  if (ticketCount !== null) {
    kpis.push({
      key: 'tickets', label: 'Tickets abiertos', tone: 'vio',
      value: String(ticketCount), sub: 'sin resolver',
    })
  }

  const proyectoCount = (proyectos as { count: number | null }).count
  if (proyectoCount !== null) {
    kpis.push({
      key: 'proyectos', label: 'Proyectos activos', tone: 'grn',
      value: String(proyectoCount), sub: 'en ejecución',
    })
  }

  // ── Sector-driven KPIs. Each one is gated on its own module, so a POS
  // company sees sales and stock, a CRM company sees pipeline, and a company
  // that never switched `pos` on sees none of the POS counters. The sector
  // decides the modules in onboarding; the dashboard then follows the modules.
  const ventasHoyRows = ((ventasHoy as { data: Array<{ total_cents: number }> | null }).data ?? [])
  if (wants.ventas) {
    // `total_cents` is cents, and every other screen divides before formatting
    // (`cop(row.totalCents / 100)`). This tile formatted the raw column, so a
    // day of $250.000 in sales read as $25.000.000 on the one screen an owner
    // looks at first.
    const hoy = ventasHoyRows.reduce((sum, s) => sum + s.total_cents, 0)
    kpis.push({
      key: 'ventas', label: 'Ventas de hoy', tone: 'grn',
      value: cop(Math.round(hoy / 100)),
      sub: ventasHoyRows.length === 0 ? 'aún sin ventas' : `${ventasHoyRows.length} ${ventasHoyRows.length === 1 ? 'venta' : 'ventas'}`,
      // The formatted value is never the string '0', so `isEmpty` cannot read
      // this tile the way it reads a count. Stated as a number instead.
      zero: hoy === 0,
    })
  }

  const clienteCount = (clientesAct as { count: number | null }).count
  if (clienteCount !== null) {
    kpis.push({
      key: 'clientes', label: 'Clientes activos', tone: 'blu',
      value: String(clienteCount), sub: 'en el directorio',
    })
  }

  const leadCount = (leadsAct as { count: number | null }).count
  if (leadCount !== null) {
    kpis.push({
      key: 'leads', label: 'Leads en embudo', tone: 'vio',
      value: String(leadCount), sub: 'sin convertir',
    })
  }

  const cotizCount = (cotizAbiertas as { count: number | null }).count
  if (cotizCount !== null) {
    kpis.push({
      key: 'cotizaciones', label: 'Cotizaciones abiertas', tone: 'amb',
      value: String(cotizCount), sub: 'borrador o enviada',
    })
  }

  const prodCount = (prodActivos as { count: number | null }).count
  if (prodCount !== null) {
    kpis.push({
      key: 'inventario', label: 'Productos activos', tone: 'neu',
      value: String(prodCount), sub: 'en catálogo',
    })
  }

  const habCount = (habVendibles as { count: number | null }).count
  if (wants.hoteleria && habCount !== null && habCount > 0) {
    const ocupadas = new Set(
      ((habOcupadas as { data: Array<{ room_id: string }> | null }).data ?? [])
        .map((r) => r.room_id),
    ).size
    kpis.push({
      key: 'ocupacion', label: 'Ocupación de hoy', tone: 'blu',
      value: `${Math.round((ocupadas / habCount) * 100)}%`,
      sub: `${ocupadas} de ${habCount} ${habCount === 1 ? 'habitación' : 'habitaciones'}`,
      zero: ocupadas === 0,
    })
  }

  const pacienteCount = (pacientesAct as { count: number | null }).count
  if (pacienteCount !== null) {
    kpis.push({
      key: 'pacientes', label: 'Pacientes activos', tone: 'vio',
      value: String(pacienteCount), sub: 'en la historia clínica',
    })
  }

  // Six buckets, oldest first, keyed by year-month so December and January of
  // different years do not collapse into the same column.
  const buckets = new Map<string, ActividadPoint>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    buckets.set(`${d.getFullYear()}-${d.getMonth()}`, {
      month: MONTH.format(d).replace('.', ''),
      firmas: 0,
      documentos: 0,
    })
  }
  const bump = (iso: string, field: 'firmas' | 'documentos') => {
    const d = new Date(iso)
    const bucket = buckets.get(`${d.getFullYear()}-${d.getMonth()}`)
    if (bucket) bucket[field] += 1
  }
  for (const row of ((firmasHist as { data: Array<{ signed_at: string }> | null }).data ?? [])) {
    bump(row.signed_at, 'firmas')
  }
  for (const row of ((documentos as { data: Array<{ created_at: string }> | null }).data ?? [])) {
    bump(row.created_at, 'documentos')
  }

  return {
    kpis,
    pendientes: wants.firmas
      ? pendientes.map((f) => ({
          id: f.id,
          title: f.title,
          detail: [
            f.employees?.full_name,
            f.due_on && f.due_on < today ? 'vencido' : null,
          ].filter(Boolean).join(' · ') || 'Sin firmante asignado',
          href: '/dashboard/firmas',
        }))
      : [],
    actividad: ((audit as { data: Array<{
      id: number; action: string; table_name: string; record_code: string | null
      occurred_at: string; actor_email: string | null
      profiles: { full_name: string } | null
    }> | null }).data ?? []).map((a) => ({
      id: String(a.id),
      who: a.profiles?.full_name ?? a.actor_email ?? 'Sistema',
      what: `${ACTION_VERB[a.action] ?? a.action} ${TABLE_NOUN[a.table_name] ?? a.table_name}${a.record_code ? ` ${a.record_code}` : ''}`,
      at: a.occurred_at,
    })),
    serie: [...buckets.values()],
    orgName: member.orgName,
    show: {
      documental: wants.firmas || wants.documentos,
      firmas: wants.firmas,
      trazabilidad: wants.trazabilidad,
    },
    // Counted off the KPI values themselves, so this cannot disagree with the
    // zeros on screen — the two would drift the moment a KPI changed shape.
    isEmpty:
      kpis.length > 0 &&
      kpis.every((k) => k.zero ?? k.value === '0') &&
      pendientes.length === 0 &&
      riesgoRows.length === 0,
  }
}
