'use client'

import { useCallback, useEffect, useState, type ComponentType } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, FileCheck2, ShieldCheck, ShieldAlert, ChevronRight, Sparkles,
  Info, AlertCircle, PenLine, Boxes, TrendingUp, Award, ArrowUp,
} from '@/lib/icons'
import type { IconProps } from '@/lib/icons'
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { useApp } from '@/lib/context/AppContext'
import { apiFetch, errorMessage } from '@/lib/api/client'

/* ------------------------------------------------------------------ */
/*  Page-local data (verbatim from original single-file app)           */
/* ------------------------------------------------------------------ */
const FIRMAS = [
  { id: 'DOC-3201', name: 'Contrato laboral', who: 'Sebastián Cano', type: 'Contrato', st: 'Pendiente', date: '18 jun 2026', days: 2 },
  { id: 'DOC-3195', name: 'Política de seguridad', who: 'Juan Pérez', type: 'Política', st: 'Pendiente', date: '12 jun 2026', days: 8 },
  { id: 'DOC-3190', name: 'Anexo de teletrabajo', who: 'María González', type: 'Anexo', st: 'Vencido', date: '02 jun 2026', days: 18 },
  { id: 'DOC-3198', name: 'Acuerdo de confidencialidad', who: 'Valentina Ruiz', type: 'Acuerdo', st: 'Firmado', date: '15 jun 2026' },
  { id: 'DOC-3187', name: 'Contrato laboral', who: 'Laura Jiménez', type: 'Contrato', st: 'Firmado', date: '28 may 2026' },
]

const RIESGOS_SEED = [
  { id: 'R-01', tipo: 'Contrato vence', empleado: 'Andrés Mora', area: 'Finanzas', sev: 'Alta', detalle: 'Contrato vence en 8 días (30 jun 2026)', accion: 'Renovar antes del 30 jun' },
  { id: 'R-02', tipo: 'Firma vencida', empleado: 'María González', area: 'Personas', sev: 'Alta', detalle: 'Anexo de teletrabajo vencido hace 18 días sin firma', accion: 'Reenviar con urgencia hoy' },
  { id: 'R-03', tipo: 'Bajo rendimiento', empleado: 'Valentina Ruiz', area: 'Marketing', sev: 'Alta', detalle: 'Score 3.2 / 5 · solo 2 de 5 objetivos Q2 cumplidos', accion: 'Iniciar plan de mejora de desempeño' },
  { id: 'R-04', tipo: 'Rotación alta', empleado: null, area: 'Marketing', sev: 'Alta', detalle: 'Tasa del 14.5% — mayor de toda la empresa', accion: 'Análisis de retención urgente' },
  { id: 'R-05', tipo: 'Vacaciones acumuladas', empleado: 'Juan Pérez', area: 'Ingeniería', sev: 'Media', detalle: '18 días disponibles sin tomar — riesgo de vencimiento', accion: 'Programar antes del cierre de Q3' },
  { id: 'R-06', tipo: 'Evaluación pendiente', empleado: 'Daniel Ospina', area: 'Ingeniería', sev: 'Media', detalle: 'Evaluación Q2 sin completar (21 días pendiente)', accion: 'Completar antes del viernes' },
  { id: 'R-07', tipo: 'Ausencia activa', empleado: 'Andrés Mora', area: 'Finanzas', sev: 'Media', detalle: 'Incapacidad de 7 días activa hasta el 23 jun', accion: 'Asegurar cobertura del rol' },
  { id: 'R-08', tipo: 'Vacante sin cubrir', empleado: null, area: 'Finanzas', sev: 'Media', detalle: 'Analista de Nómina sin cubrir hace 11 días', accion: 'Priorizar entrevistas esta semana' },
  { id: 'R-09', tipo: 'Ticket sin respuesta', empleado: null, area: 'Nómina', sev: 'Baja', detalle: 'TK-1284 lleva 4 días sin primera respuesta', accion: 'Escalar al líder del área' },
  { id: 'R-10', tipo: 'Capacitación atrasada', empleado: null, area: 'General', sev: 'Baja', detalle: '2 cursos con menos del 30% de avance', accion: 'Enviar recordatorio al equipo' },
]

interface HealthFactorLocal { nombre: string; score: number; tone: string }
const HEALTH_FACTORS: HealthFactorLocal[] = [
  { nombre: 'Cumplimiento documental', score: 94, tone: 'grn' },
  { nombre: 'Clima laboral (eNPS)', score: 75, tone: 'grn' },
  { nombre: 'Desempeño', score: 79, tone: 'grn' },
  { nombre: 'Retención de talento', score: 83, tone: 'grn' },
  { nombre: 'Asistencia', score: 88, tone: 'grn' },
  { nombre: 'Reclutamiento', score: 68, tone: 'amb' },
]
const HEALTH_SCORE = Math.round(
  HEALTH_FACTORS.reduce((s, f, i) => s + f.score * [0.2, 0.2, 0.2, 0.15, 0.15, 0.1][i], 0)
)

interface Rec { id: string; prioridad: string; cat: string; titulo: string; razon: string; tone: string }
const RECOMENDACIONES_SEED: Rec[] = [
  { id: 'RC-01', prioridad: 'Urgente', cat: 'Retención', titulo: 'Plan de retención en Marketing', razon: 'Tasa de rotación 14.5% y desempeño bajo detectado en el área', tone: 'red' },
  { id: 'RC-02', prioridad: 'Importante', cat: 'Cumplimiento', titulo: 'Renovar contratos antes del 30 jun', razon: '3 contratos expiran en los próximos 8 días', tone: 'amb' },
  { id: 'RC-03', prioridad: 'Pronto', cat: 'Desarrollo', titulo: 'Activar plan de formación Q3', razon: '2 cursos activos con menos del 30% de avance en el equipo', tone: 'blu' },
]

const ACTIVIDAD = [
  { m: 'Ene', firmas: 38, docs: 26 }, { m: 'Feb', firmas: 31, docs: 30 },
  { m: 'Mar', firmas: 52, docs: 41 }, { m: 'Abr', firmas: 44, docs: 37 },
  { m: 'May', firmas: 61, docs: 48 }, { m: 'Jun', firmas: 84, docs: 57 },
]

const EVENTOS = [
  { g: 'Hoy', items: [
    { who: 'María González', act: 'firmó', obj: 'Acuerdo de confidencialidad', t: '09:42', type: 'Firma', red: true },
    { who: 'Juan Pérez', act: 'abrió un ticket:', obj: 'Certificado laboral (TK-1287) · área Personas', t: '08:50', type: 'Ticket' },
    { who: 'Asistente IA', act: 'detectó', obj: '3 contratos por vencer este mes', t: '08:15', type: 'IA' },
    { who: 'Daniel Ospina', act: 'registró entrada de', obj: 'Teclado mecánico (INV-0601)', t: '07:50', type: 'Inventario' },
  ] },
  { g: 'Ayer', items: [
    { who: 'Camila Restrepo', act: 'subió', obj: 'Plan de capacitación 2026', t: '17:20', type: 'Documento' },
    { who: 'Sistema', act: 'asignó', obj: 'MacBook Pro 14" a María González', t: '11:05', type: 'Inventario' },
    { who: 'Valentina Ruiz', act: 'completó', obj: 'Onboarding documental', t: '09:30', type: 'Empleado' },
  ] },
]

const FALLBACK_INSIGHTS = [
  { title: 'Riesgo de cumplimiento', desc: '3 contratos vencen este mes. Recomiendo renovar antes del 30 de junio.', tone: 'red' },
  { title: 'Firmas estancadas', desc: '2 documentos llevan más de 8 días esperando firma.', tone: 'amb' },
  { title: 'Inventario optimizable', desc: '2 equipos sin asignar disponibles para nuevos ingresos.', tone: 'grn' },
]
const INSIGHT_ICO: Record<string, ComponentType<IconProps>> = { red: AlertCircle, amb: PenLine, grn: Boxes, blu: TrendingUp, vio: Award }

/** Shape returned by POST /api/ai/insights. */
type InsightsResponse =
  | { unavailable: true; reason: string }
  | {
      insights: { title: string; desc: string; tone: string }[]
      recs: Omit<Rec, 'id'>[]
      generatedAt: string
      cached: boolean
    }

/** "hace 12 min" / "hace 3 h" — the cached insights carry a real timestamp. */
function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'hace un momento'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  return `hace ${Math.round(hours / 24)} d`
}


/* ------------------------------------------------------------------ */
/*  Page-local helpers (inline to match original render exactly)       */
/* ------------------------------------------------------------------ */
const tone = (st: string): string => (({
  Activo: 'grn', Firmado: 'grn', Asignado: 'grn', Disponible: 'grn', Resuelta: 'grn', Vigente: 'grn',
  Pendiente: 'amb', Onboarding: 'amb', Mantenimiento: 'amb', 'En licencia': 'amb', 'En curso': 'amb',
  Agendada: 'amb', Vencido: 'red',
  Abierto: 'neu', 'En proceso': 'amb', Resuelto: 'grn',
  Solicitado: 'amb', Aprobado: 'blu', Facturado: 'grn',
  Alta: 'red', Media: 'amb', Baja: 'neu',
  Urgente: 'red', Importante: 'amb', Pronto: 'blu',
} as Record<string, string>)[st] || 'neu')

const Badge = ({ st }: { st: string }) => (
  <span className={`badge b-${tone(st)}`}><span className="bd" />{st}</span>
)

function Spark({ data, color = 'var(--red)' }: { data: number[]; color?: string }) {
  const w = 84, h = 30, max = Math.max(...data), min = Math.min(...data)
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / (max - min || 1)) * (h - 4) - 2
    return `${x},${y}`
  })
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface KpiLocalProps {
  ico: ComponentType<IconProps>
  label: string
  value: string | number
  delta: string | number
  up?: boolean
  dir?: string
  vs: string
  spark: number[]
  tone?: string
}
/* transitions.dev — number pop-in: each digit blurs + slides up on mount */
function PopNumber({ value }: { value: string | number }) {
  return (
    <span className="t-digit-group is-animating">
      {String(value).split('').map((ch, i) => (
        <span className="t-digit" key={i} data-stagger={Math.min(i, 3)}>{ch}</span>
      ))}
    </span>
  )
}

const Kpi = ({ ico: Ico, label, value, delta, up, dir, vs, spark, tone: kt = 'neu' }: KpiLocalProps) => {
  const down = (dir || (up ? 'up' : 'down')) === 'down'
  return (
    <div className="card kpi">
      <div className={`kglow ${kt}`} />
      <div className="klab">
        <span className={`kico-soft ${kt}`}><Ico size={16} /></span>
        {label}
      </div>
      <div className="kval"><PopNumber value={value} /></div>
      <div className="kfoot">
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span className={`delta ${up ? 'up' : 'dn'}`}><ArrowUp size={11} style={{ transform: down ? 'rotate(180deg)' : 'none' }} />{delta}</span>
          <span className="kvs">{vs}</span>
        </div>
        <Spark data={spark} color="#d7dadf" />
      </div>
    </div>
  )
}

interface TipPayload { dataKey: string; color: string; value: number }
function ChartTip({ active, payload, label }: { active?: boolean; payload?: TipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="tip">
      <div className="tm">{label} 2026</div>
      {payload.map((p) => (
        <div className="tr" key={p.dataKey}>
          <span style={{ width: 8, height: 8, borderRadius: 3, background: p.color, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{p.dataKey === 'firmas' ? 'Firmas' : 'Documentos'}</span>
          <b style={{ color: 'var(--ink)' }}>{p.value.toLocaleString('es-CO')}</b>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Dashboard                                                          */
/* ------------------------------------------------------------------ */
export default function DashboardPage() {
  const { addToast } = useApp()
  const router = useRouter()
  const go = (x: string) => router.push(`/dashboard/${x}`)
  const openAI = () => router.push('/dashboard/ia')

  const [shown, setShown] = useState(false)
  const [insights, setInsights] = useState(FALLBACK_INSIGHTS)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [recs, setRecs] = useState<Rec[]>(RECOMENDACIONES_SEED)
  const [updatedAgo, setUpdatedAgo] = useState('hace 2 min')

  /**
   * Insights come from /api/ai/insights, which runs the model server-side over
   * real aggregates and caches the result per organization.
   *
   * This used to call api.anthropic.com straight from the browser: no key was
   * attached, so it silently failed into the fallback copy on every load — and
   * adding one would have shipped it in the client bundle.
   */
  const genInsights = useCallback(async (refresh = false) => {
    setLoadingInsights(true)
    try {
      const data = await apiFetch<InsightsResponse>(
        `/api/ai/insights${refresh ? '?refresh=1' : ''}`,
        { method: 'POST' },
      )

      if ('unavailable' in data) {
        // Nothing is broken: the assistant simply is not configured, and the
        // static fallback copy already on screen is the right thing to show.
        return
      }

      if (data.insights?.length) setInsights(data.insights.slice(0, 3))
      if (data.recs?.length) {
        setRecs(data.recs.slice(0, 3).map((r, i) => ({ ...r, id: `RC-0${i + 1}` })))
      }
      setUpdatedAgo(
        data.cached ? relativeTime(data.generatedAt) : 'hace un momento',
      )
    } catch (error) {
      addToast(errorMessage(error, 'Usando datos del último análisis disponible'), 'info')
    } finally {
      setLoadingInsights(false)
    }
  }, [addToast])

  useEffect(() => {
    // After first paint: the panel has fallback copy to show meanwhile, and
    // an AI round trip should never delay the dashboard rendering.
    const frame = requestAnimationFrame(() => void genInsights())
    return () => cancelAnimationFrame(frame)
  }, [genInsights])
   
  useEffect(() => { const t = setTimeout(() => setShown(true), 30); return () => clearTimeout(t) }, [])

  const hixColor = HEALTH_SCORE >= 80 ? 'grn' : HEALTH_SCORE >= 60 ? 'amb' : 'red'

  return (
    <>
      {/* Editorial header — texts reveal */}
      <div className="dash-head">
        <div className={`t-stagger${shown ? ' is-shown' : ''}`}>
          <h1 className="dash-hello t-stagger-line t-stagger-line--1">Hola, Camila</h1>
          <p className="dash-sub t-stagger-line t-stagger-line--2">Esto es lo que está pasando en tu organización.</p>
        </div>
        <button className="btn pri" onClick={openAI}><Sparkles size={15} />Preguntar a la IA</button>
      </div>

      {/* KPIs */}
      <div className="gkpi">
        <div className="rise d1"><Kpi ico={Users} tone="blu" label="Empleados activos" value="142" delta="4.2%" up vs="vs. mes anterior" spark={[120, 124, 128, 131, 137, 142]} /></div>
        <div className="rise d2"><Kpi ico={FileCheck2} tone="neu" label="Documentos firmados" value="84" delta="8.1%" up vs="este mes" spark={[38, 31, 52, 44, 61, 84]} /></div>
        <div className="rise d3"><Kpi ico={ShieldCheck} tone="grn" label="Cumplimiento" value="94%" delta="1.4%" up vs="vs. mes anterior" spark={[88, 89, 90, 91, 93, 94]} /></div>
        <div className="rise d4"><Kpi ico={ShieldAlert} tone="red" label="Riesgos activos" value={RIESGOS_SEED.filter((r) => r.sev === 'Alta').length} delta={RIESGOS_SEED.length} up={false} dir="up" vs="total detectados" spark={[2, 3, 2, 4, 3, 4]} /></div>
      </div>

      {/* Actividad + Salud organizacional */}
      <div className="g2" style={{ marginTop: 16 }}>
        <div className="card rise d3">
          <div className="chead">
            <div className="ctitle">Actividad de RRHH</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div className="legend">
                <span className="lg"><span className="lgd" style={{ background: '#3b82f6' }} />Firmas</span>
                <span className="lg"><span className="lgd" style={{ background: '#1f2937' }} />Documentos</span>
              </div>
              <span className="range">Últimos 6 meses</span>
            </div>
          </div>
          <div className="cpad" style={{ height: 270 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ACTIVIDAD} margin={{ top: 14, right: 6, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.22} />
                    <stop offset="40%" stopColor="#3b82f6" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gK" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d1d5db" stopOpacity={0.14} />
                    <stop offset="50%" stopColor="#d1d5db" stopOpacity={0.04} />
                    <stop offset="100%" stopColor="#d1d5db" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--line2)" strokeDasharray="4 4" />
                <XAxis dataKey="m" tickLine={false} axisLine={false} dy={8} tick={{ fill: 'var(--ink3)', fontSize: 12, fontWeight: 600 }} />
                <YAxis tickLine={false} axisLine={false} width={40} tick={{ fill: 'var(--ink3)', fontSize: 11 }} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: 'var(--line)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="docs" stroke="#9ca3af" strokeWidth={2} fill="url(#gK)"
                  dot={{ r: 3.5, strokeWidth: 2, fill: '#1A1A1A', stroke: '#9ca3af' }}
                  activeDot={{ r: 5.5, strokeWidth: 2, fill: '#1A1A1A', stroke: '#9ca3af' }} />
                <Area type="monotone" dataKey="firmas" stroke="#3b82f6" strokeWidth={2.6} fill="url(#gR)"
                  dot={{ r: 4, strokeWidth: 2, fill: '#1A1A1A', stroke: '#3b82f6' }}
                  activeDot={{ r: 6, strokeWidth: 2.5, fill: '#1A1A1A', stroke: '#3b82f6' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card cpad rise d4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 16 }}>
            <div className="ctitle">Salud organizacional</div>
            <span className={`badge b-${hixColor}`}>{HEALTH_SCORE >= 80 ? 'Saludable' : HEALTH_SCORE >= 60 ? 'Moderado' : 'Crítico'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className={`hix-num ${hixColor}`} style={{ fontSize: 42, lineHeight: 1 }}><PopNumber value={HEALTH_SCORE} /></span>
            <span className="hix-lbl">/ 100 pts</span>
          </div>
          <div className="hix-track" style={{ width: '100%', margin: '12px 0 18px' }}><div className={`hix-fill ${hixColor}`} style={{ width: `${HEALTH_SCORE}%` }} /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {HEALTH_FACTORS.map((f) => (
              <div key={f.nombre} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.nombre}</span>
                <div className="hix-bar" style={{ flex: '0 0 84px' }}><div className={`hix-bar-fill ${f.tone}`} style={{ width: `${f.score}%` }} /></div>
                <span className="hix-bar-val">{f.score}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Resumen IA + Recomendaciones */}
      <div className="g2b" style={{ marginTop: 16 }}>
        <div className="card ins-top rise d5">
          <div className="chead">
            <div className="ctitle">Resumen ejecutivo IA</div>
            <button className="iref" data-tip="Actualizar resumen" onClick={() => void genInsights(true)} disabled={loadingInsights} aria-busy={loadingInsights} title="Actualizar">
              {loadingInsights ? <span className="ispin" /> : <span className="kvs">{updatedAgo}</span>}
            </button>
          </div>
          {loadingInsights ? (
            <div className="cpad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="skel" /><div className="skel" /><div className="skel" style={{ width: '70%' }} />
            </div>
          ) : insights.map((ins, i) => {
            const Ico = INSIGHT_ICO[ins.tone] || Info
            return (
              <div className="insight" key={i}>
                <div className={`kico-soft ${ins.tone}`} style={{ marginTop: 1 }}><Ico size={16} /></div>
                <div><div className="it">{ins.title}</div><div className="id">{ins.desc}</div></div>
              </div>
            )
          })}
          <div className="cpad" style={{ paddingTop: 14, paddingBottom: 16 }}>
            <button className="btn pri" style={{ width: '100%', justifyContent: 'center' }} onClick={openAI}>
              <Sparkles size={15} />Preguntar al asistente IA
            </button>
          </div>
        </div>

        <div className="card rise d6">
          <div className="chead">
            <div className="ctitle">Recomendaciones</div>
            {loadingInsights && <span className="ispin" />}
          </div>
          <div className="reclist">
            {recs.map((r) => (
              <button className="recrow" key={r.id} onClick={() => go('riesgos')}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <Badge st={r.prioridad} />
                    <span className="reccat">{r.cat}</span>
                  </div>
                  <div className="recto">{r.titulo}</div>
                  <div className="recra">{r.razon}</div>
                </div>
                <ChevronRight size={16} color="#c4c4cc" style={{ flexShrink: 0, alignSelf: 'center' }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Firmas + Trazabilidad */}
      <div className="g2b" style={{ marginTop: 16 }}>
        <div className="card rise d5">
          <div className="chead">
            <div className="ctitle">Firmas pendientes</div>
            <button className="clink" onClick={() => go('firmas')}>Ver todo <ChevronRight size={14} /></button>
          </div>
          <div className="tblwrap">
            <table className="tbl">
              <tbody>
                {FIRMAS.filter((f) => f.st !== 'Firmado').map((f) => (
                  <tr className="trow" key={f.id}>
                    <td>
                      <div className="cename">{f.name}</div>
                      <div className="ceid mono">{f.id} · {f.who}</div>
                    </td>
                    <td className="muted" style={{ textAlign: 'right' }}>{f.days} d</td>
                    <td style={{ textAlign: 'right' }}><Badge st={f.st} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card rise d6">
          <div className="chead">
            <div className="ctitle">Trazabilidad reciente</div>
            <button className="clink" onClick={() => go('trazabilidad')}>Ver todo <ChevronRight size={14} /></button>
          </div>
          <div className="tl">
            {EVENTOS[0].items.concat(EVENTOS[1].items.slice(0, 1)).map((e, i, arr) => (
              <div className={`tli ${i === arr.length - 1 ? 'last' : ''}`} key={i}>
                <div className="tlrail"><div className={`tlnode ${'red' in e && e.red ? 'red' : ''}`} /></div>
                <div className="tlbody">
                  <div className="tltop">
                    <div className="tltxt"><b>{e.who}</b> {e.act} {e.obj}</div>
                    <div className="tltime mono">{e.t}</div>
                  </div>
                  <span className="tltag">{e.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
