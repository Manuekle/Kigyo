import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { scoped } from './shared'

/**
 * PH: asambleas, cuotas y zonas comunes.
 *
 * Una asamblea es la decisión colectiva; una cuota es lo que cada unidad
 * debe y si pagó; una zona común es lo que todos comparten. Las cuotas
 * pendientes son la señal de la pantalla: lo que se debe y aún no entra.
 */

export interface AsambleaRow {
  id: string
  fecha: string
  tema: string
  tipo: string
  estado: string
  asistentes: number
  decisiones: string | null
}

export interface CuotaRow {
  id: string
  unidad: string
  periodo: string
  tipo: string
  monto: number
  estado: string
  vence: string | null
  pagadaOn: string | null
}

export interface ZonaRow {
  id: string
  name: string
  tipo: string
  estado: string
  notas: string | null
}

export interface PhData {
  asambleas: AsambleaRow[]
  cuotas: CuotaRow[]
  zonas: ZonaRow[]
  /** Cuotas con estado `pendiente`. */
  pendientesCount: number
  /** Suma de lo pendiente. */
  montoPendiente: number
}

const num = (v: string | number | null | undefined): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

interface AsambleaRecord {
  id: string
  fecha: string
  tema: string
  tipo: string
  estado: string
  asistentes: number
  decisiones: string | null
}

interface CuotaRecord {
  id: string
  unidad: string
  periodo: string
  tipo: string
  monto: string | number | null
  estado: string
  vence: string | null
  pagada_on: string | null
}

interface ZonaRecord {
  id: string
  name: string
  tipo: string
  estado: string
  notas: string | null
}

export async function getPh(): Promise<PhData> {
  const member = await requirePermission('ph:read')
  const supabase = await createClient()

  const [asambleasResult, cuotasResult, zonasResult] = await Promise.all([
    scoped(supabase, member, 'ph_asambleas')
      .select('id, fecha, tema, tipo, estado, asistentes, decisiones')
      .order('fecha', { ascending: false })
      .limit(200),
    scoped(supabase, member, 'ph_cuotas')
      .select('id, unidad, periodo, tipo, monto, estado, vence, pagada_on')
      .order('created_at', { ascending: false })
      .limit(200),
    scoped(supabase, member, 'ph_zonas')
      .select('id, name, tipo, estado, notas')
      .order('name', { ascending: true })
      .limit(200),
  ])

  const asambleas = ((asambleasResult.data ?? []) as unknown as AsambleaRecord[]).map((r) => ({
    id: r.id,
    fecha: r.fecha,
    tema: r.tema,
    tipo: r.tipo,
    estado: r.estado,
    asistentes: r.asistentes,
    decisiones: r.decisiones,
  }))

  const cuotas = ((cuotasResult.data ?? []) as unknown as CuotaRecord[]).map((r) => ({
    id: r.id,
    unidad: r.unidad,
    periodo: r.periodo,
    tipo: r.tipo,
    monto: num(r.monto),
    estado: r.estado,
    vence: r.vence,
    pagadaOn: r.pagada_on,
  }))

  const zonas = ((zonasResult.data ?? []) as unknown as ZonaRecord[]).map((r) => ({
    id: r.id,
    name: r.name,
    tipo: r.tipo,
    estado: r.estado,
    notas: r.notas,
  }))

  const pendientes = cuotas.filter((c) => c.estado === 'pendiente')

  return {
    asambleas,
    cuotas,
    zonas,
    pendientesCount: pendientes.length,
    montoPendiente: pendientes.reduce((acc, c) => acc + c.monto, 0),
  }
}
