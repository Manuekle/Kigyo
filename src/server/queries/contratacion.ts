import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { scoped } from './shared'

/**
 * Contratación: procesos, pliegos y oferentes.
 *
 * Un proceso es la selección en curso; el pliego es lo que pide; el oferente
 * es quién compite. Los procesos publicados y en evaluación son la señal de
 * la pantalla: dónde hay trabajo por ganar.
 */

export interface ProcesoRow {
  id: string
  numero: string
  objeto: string
  modalidad: string
  estado: string
  valor: number
  publicadoOn: string | null
  cierreOn: string | null
}

export interface PliegoRow {
  id: string
  procesoId: string
  procesoNumero: string
  name: string
  description: string
  obligatorio: boolean
}

export interface OferenteRow {
  id: string
  procesoId: string
  procesoNumero: string
  name: string
  contacto: string | null
  estado: string
  valorOferta: number
  notas: string | null
}

export interface ContratacionData {
  procesos: ProcesoRow[]
  pliegos: PliegoRow[]
  oferentes: OferenteRow[]
  /** Procesos con estado `publicado` o `en_evaluacion`. */
  activosCount: number
  /** Suma del valor de los procesos adjudicados. */
  valorAdjudicado: number
}

const num = (v: string | number | null | undefined): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

interface ProcesoRecord {
  id: string
  numero: string
  objeto: string
  modalidad: string
  estado: string
  valor: string | number | null
  publicado_on: string | null
  cierre_on: string | null
}

interface PliegoRecord {
  id: string
  proceso_id: string
  name: string
  description: string
  obligatorio: boolean
  contratacion_procesos: { numero: string } | null
}

interface OferenteRecord {
  id: string
  proceso_id: string
  name: string
  contacto: string | null
  estado: string
  valor_oferta: string | number | null
  notas: string | null
  contratacion_procesos: { numero: string } | null
}

export async function getContratacion(): Promise<ContratacionData> {
  const member = await requirePermission('contratacion:read')
  const supabase = await createClient()

  const [procesosResult, pliegosResult, oferentesResult] = await Promise.all([
    scoped(supabase, member, 'contratacion_procesos')
      .select('id, numero, objeto, modalidad, estado, valor, publicado_on, cierre_on')
      .order('created_at', { ascending: false })
      .limit(200),
    scoped(supabase, member, 'contratacion_pliegos')
      .select('id, proceso_id, name, description, obligatorio, contratacion_procesos ( numero )')
      .order('created_at', { ascending: false })
      .limit(200),
    scoped(supabase, member, 'contratacion_oferentes')
      .select(
        'id, proceso_id, name, contacto, estado, valor_oferta, notas, ' +
          'contratacion_procesos ( numero )',
      )
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const procesos = ((procesosResult.data ?? []) as unknown as ProcesoRecord[]).map((r) => ({
    id: r.id,
    numero: r.numero,
    objeto: r.objeto,
    modalidad: r.modalidad,
    estado: r.estado,
    valor: num(r.valor),
    publicadoOn: r.publicado_on,
    cierreOn: r.cierre_on,
  }))

  const pliegos = ((pliegosResult.data ?? []) as unknown as PliegoRecord[]).map((r) => ({
    id: r.id,
    procesoId: r.proceso_id,
    procesoNumero: r.contratacion_procesos?.numero ?? '—',
    name: r.name,
    description: r.description,
    obligatorio: r.obligatorio,
  }))

  const oferentes = ((oferentesResult.data ?? []) as unknown as OferenteRecord[]).map((r) => ({
    id: r.id,
    procesoId: r.proceso_id,
    procesoNumero: r.contratacion_procesos?.numero ?? '—',
    name: r.name,
    contacto: r.contacto,
    estado: r.estado,
    valorOferta: num(r.valor_oferta),
    notas: r.notas,
  }))

  return {
    procesos,
    pliegos,
    oferentes,
    activosCount: procesos.filter((p) => p.estado === 'publicado' || p.estado === 'en_evaluacion').length,
    valorAdjudicado: procesos
      .filter((p) => p.estado === 'adjudicado')
      .reduce((acc, p) => acc + p.valor, 0),
  }
}
