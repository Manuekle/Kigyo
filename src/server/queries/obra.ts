import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { scoped } from './shared'

/**
 * Obra: presupuestos, capítulos, APU y avance.
 *
 * El presupuesto es el contrato del costo; el capítulo es la descomposición
 * (cimentación, estructura, acabados…) y donde se mide el avance; el APU es
 * el análisis de precio unitario de una partida; el avance es el corte
 * periódico de cuánto se ha ejecutado.
 *
 * Los valores vienen de columnas `numeric` y PostgREST los serializa como
 * texto: se convierten con `Number()` en el mapper, igual que el resto de
 * las pantallas.
 */

export interface AvanceRow {
  id: string
  fecha: string
  avance: number
  valor: number
  notas: string | null
}

export interface ApuRow {
  id: string
  name: string
  unidad: string
  cantidad: number
  materiales: number
  manoObra: number
  equipo: number
  transporte: number
  /** cantidad × (materiales + mano_obra + equipo + transporte). */
  total: number
}

export interface CapituloRow {
  id: string
  name: string
  orden: number
  valorPresupuestado: number
  valorEjecutado: number
  /** Avance en %: ejecutado sobre presupuestado, 0 si no hay presupuesto. */
  avance: number
  apu: ApuRow[]
  avances: AvanceRow[]
}

export interface PresupuestoRow {
  id: string
  name: string
  client: string | null
  estado: string
  valorPresupuestado: number
  valorEjecutado: number
  fechaInicio: string | null
  fechaFin: string | null
  capitulos: CapituloRow[]
}

export interface ObraData {
  presupuestos: PresupuestoRow[]
  /** Presupuestos con estado `en_ejecucion`. */
  enEjecucionCount: number
  /** Suma de los presupuestado de todos los presupuestos. */
  totalPresupuestado: number
  /** Suma de lo ejecutado de todos los presupuestos. */
  totalEjecutado: number
}

interface AvanceRecord {
  id: string
  fecha: string
  avance: string | number | null
  valor: string | number | null
  notas: string | null
}

interface ApuRecord {
  id: string
  name: string
  unidad: string
  cantidad: string | number | null
  materiales: string | number | null
  mano_obra: string | number | null
  equipo: string | number | null
  transporte: string | number | null
}

interface CapituloRecord {
  id: string
  name: string
  orden: number
  valor_presupuestado: string | number | null
  valor_ejecutado: string | number | null
  obra_apu: ApuRecord[]
  obra_avances: AvanceRecord[]
}

interface PresupuestoRecord {
  id: string
  name: string
  client: string | null
  estado: string
  valor_presupuestado: string | number | null
  valor_ejecutado: string | number | null
  fecha_inicio: string | null
  fecha_fin: string | null
  obra_capitulos: CapituloRecord[]
}

const num = (v: string | number | null | undefined): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

function toAvance(row: AvanceRecord): AvanceRow {
  return {
    id: row.id,
    fecha: row.fecha,
    avance: num(row.avance),
    valor: num(row.valor),
    notas: row.notas,
  }
}

function toApu(row: ApuRecord): ApuRow {
  const materiales = num(row.materiales)
  const manoObra = num(row.mano_obra)
  const equipo = num(row.equipo)
  const transporte = num(row.transporte)
  const cantidad = num(row.cantidad)
  return {
    id: row.id,
    name: row.name,
    unidad: row.unidad,
    cantidad,
    materiales,
    manoObra,
    equipo,
    transporte,
    total: cantidad * (materiales + manoObra + equipo + transporte),
  }
}

function toCapitulo(row: CapituloRecord): CapituloRow {
  const presupuestado = num(row.valor_presupuestado)
  const ejecutado = num(row.valor_ejecutado)
  return {
    id: row.id,
    name: row.name,
    orden: row.orden,
    valorPresupuestado: presupuestado,
    valorEjecutado: ejecutado,
    avance: presupuestado > 0 ? Math.min(100, (ejecutado / presupuestado) * 100) : 0,
    apu: (row.obra_apu ?? [])
      .map(toApu)
      .sort((a, b) => a.name.localeCompare(b.name)),
    avances: (row.obra_avances ?? [])
      .map(toAvance)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0)),
  }
}

function toPresupuesto(row: PresupuestoRecord): PresupuestoRow {
  return {
    id: row.id,
    name: row.name,
    client: row.client,
    estado: row.estado,
    valorPresupuestado: num(row.valor_presupuestado),
    valorEjecutado: num(row.valor_ejecutado),
    fechaInicio: row.fecha_inicio,
    fechaFin: row.fecha_fin,
    capitulos: (row.obra_capitulos ?? [])
      .map(toCapitulo)
      .sort((a, b) => a.orden - b.orden || a.name.localeCompare(b.name)),
  }
}

export async function getObra(): Promise<ObraData> {
  const member = await requirePermission('obra:read')
  const supabase = await createClient()

  const result = await scoped(supabase, member, 'obra_presupuestos')
    .select(
      'id, name, client, estado, valor_presupuestado, valor_ejecutado, fecha_inicio, fecha_fin, ' +
        'obra_capitulos ( id, name, orden, valor_presupuestado, valor_ejecutado, ' +
        '  obra_apu ( id, name, unidad, cantidad, materiales, mano_obra, equipo, transporte ), ' +
        '  obra_avances ( id, fecha, avance, valor, notas ) )',
    )
    .order('created_at', { ascending: false })
    .limit(100)

  const presupuestos = ((result.data ?? []) as unknown as PresupuestoRecord[]).map(toPresupuesto)

  return {
    presupuestos,
    enEjecucionCount: presupuestos.filter((p) => p.estado === 'en_ejecucion').length,
    totalPresupuestado: presupuestos.reduce((acc, p) => acc + p.valorPresupuestado, 0),
    totalEjecutado: presupuestos.reduce((acc, p) => acc + p.valorEjecutado, 0),
  }
}
