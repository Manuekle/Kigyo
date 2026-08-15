'use client'

import { useCallback, useEffect, useState, type ComponentType } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, FileCheck2, ShieldCheck, ShieldAlert, Sparkles, ChevronRight,
  AlertCircle, PenLine, Boxes, TrendingUp, Award, Info, Ticket, Kanban,
  DollarSign, UserPlus, FileText, Package,
} from '@/lib/icons'
import type { IconProps } from '@/lib/icons'
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import ChartTip from '@/components/ui/ChartTip'
import { useApp } from '@/lib/context/AppContext'
import { useTheme } from '@/lib/context/ThemeContext'
import { useMember } from '@/lib/context/MemberContext'
import { apiFetch, errorMessage } from '@/lib/api/client'
import PopNumber from '@/components/ui/PopNumber'
import PrimerosPasos from '@/components/ui/PrimerosPasos'
import type { DashboardData } from '@/server/queries/dashboard'

/* ------------------------------------------------------------------ */
/*  AI insights                                                        */
/* ------------------------------------------------------------------ */
interface Rec { id: string; prioridad: string; cat: string; titulo: string; razon: string; tone: string }

/** Shape returned by POST /api/ai/insights. */
type InsightsResponse =
  | { unavailable: true; reason: string }
  | {
      insights: { title: string; desc: string; tone: string }[]
      recs: Omit<Rec, 'id'>[]
      generatedAt: string
      cached: boolean
    }

const INSIGHT_ICO: Record<string, ComponentType<IconProps>> = {
  red: AlertCircle, amb: PenLine, grn: Boxes, blu: TrendingUp, vio: Award,
}

const KPI_ICO: Record<string, ComponentType<IconProps>> = {
  empleados: Users, firmas: FileCheck2, riesgos: ShieldAlert,
  tickets: Ticket, proyectos: Kanban,
  ventas: DollarSign, clientes: Users, leads: UserPlus,
  cotizaciones: FileText, inventario: Package,
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

const TIME = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' })

/**
 * Recharts takes colours as props, so the chart cannot inherit the palette
 * from CSS. Brand blue works on either surface; the neutral series has to
 * flip, and dot centres are punched out in the card colour so the line reads
 * as passing behind them.
 */
const SERIES = {
  dark: { neutral: '#9ca3af', neutralFill: '#d1d5db' },
  light: { neutral: '#52525b', neutralFill: '#71717a' },
} as const

function Kpi({ ico: Ico, label, value, sub, tone: kt = 'neu' }: {
  ico: ComponentType<IconProps>
  label: string
  value: string
  sub: string
  tone?: string
}) {
  return (
    <div className="card kpi">
      <div className={`kglow ${kt}`} />
      <div className="klab">
        <span className={`kico-soft ${kt}`}><Ico size={16} /></span>
        {label}
      </div>
      <div className="kval"><PopNumber value={value} /></div>
      {/*
        The delta and the sparkline that used to sit here — "+4.2% vs. mes
        anterior" over a six-point line — were literals in the source. There is
        no month-over-month snapshot to compare against yet, so the tile says
        what the number is instead of inventing a trend for it.
      */}
      <div className="kvs" style={{ marginTop: 3 }}>{sub}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Dashboard                                                          */
/* ------------------------------------------------------------------ */
export default function DashboardPage({ data }: { data: DashboardData }) {
  const { addToast } = useApp()
  const member = useMember()
  // First name only — "Hola, Camila Restrepo" reads like a form letter.
  const firstName = member.fullName.trim().split(/\s+/)[0]
  const router = useRouter()
  const { theme } = useTheme()
  const series = SERIES[theme]
  const go = (x: string) => router.push(`/dashboard/${x}`)
  const openAI = () => router.push('/dashboard/ia')

  const [shown, setShown] = useState(false)
  const [insights, setInsights] = useState<{ title: string; desc: string; tone: string }[]>([])
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [recs, setRecs] = useState<Rec[]>([])
  const [insightsAvailable, setInsightsAvailable] = useState(true)
  const [updatedAgo, setUpdatedAgo] = useState('')

  /**
   * Insights come from /api/ai/insights, which runs the model server-side over
   * real aggregates and caches the result per organization.
   *
   * The static `FALLBACK_INSIGHTS` this used to show — "3 contratos vencen
   * este mes", "2 documentos llevan más de 8 días esperando firma" — were
   * three sentences in the source, rendered as if the assistant had produced
   * them, on every account, whether or not the assistant was configured.
   */
  const genInsights = useCallback(async (refresh = false) => {
    setLoadingInsights(true)
    try {
      const result = await apiFetch<InsightsResponse>(
        `/api/ai/insights${refresh ? '?refresh=1' : ''}`,
        { method: 'POST' },
      )

      if ('unavailable' in result) {
        setInsightsAvailable(false)
        return
      }

      setInsightsAvailable(true)
      setInsights(result.insights?.slice(0, 3) ?? [])
      setRecs((result.recs ?? []).slice(0, 3).map((r, i) => ({ ...r, id: `RC-0${i + 1}` })))
      setUpdatedAgo(result.cached ? relativeTime(result.generatedAt) : 'hace un momento')
    } catch (error) {
      addToast(errorMessage(error, 'No se pudo generar el resumen'), 'info')
    } finally {
      setLoadingInsights(false)
    }
  }, [addToast])

  useEffect(() => {
    // After first paint: an AI round trip should never delay the dashboard.
    const frame = requestAnimationFrame(() => void genInsights())
    return () => cancelAnimationFrame(frame)
  }, [genInsights])

  useEffect(() => { const t = setTimeout(() => setShown(true), 30); return () => clearTimeout(t) }, [])

  const hasChart = data.serie.some((p) => p.firmas > 0 || p.documentos > 0)

  return (
    <>
      <div className="dash-head">
        <div className={`t-stagger${shown ? ' is-shown' : ''}`}>
          <h1 className="dash-hello t-stagger-line t-stagger-line--1">Hola, {firstName}</h1>
          <p className="dash-sub t-stagger-line t-stagger-line--2">
            Esto es lo que está pasando en {data.orgName}.
          </p>
        </div>
        <button className="btn pri" onClick={openAI}><Sparkles size={15} />Preguntar a la IA</button>
      </div>

      {/* An account with nothing in it yet gets somewhere to start instead of
          five counters reading 0. Rendered from `isEmpty`, which the server
          derives from the same counters — so it withdraws by itself as soon as
          there is anything to report, with nothing to dismiss. */}
      {data.isEmpty && <PrimerosPasos />}

      {/* KPIs. Only the modules this member can actually open contribute one,
          so the row shrinks rather than showing zeros for things they cannot see. */}
      {data.kpis.length > 0 && (
        <div className="gkpi">
          {data.kpis.map((kpi, i) => (
            <div className={`rise d${Math.min(i + 1, 6)}`} key={kpi.key}>
              <Kpi
                ico={KPI_ICO[kpi.key] ?? ShieldCheck}
                tone={kpi.tone}
                label={kpi.label}
                value={kpi.value}
                sub={kpi.sub}
              />
            </div>
          ))}
        </div>
      )}

      <div className="g2" style={{ marginTop: 16 }}>
        {/*
          "Salud organizacional · 82 / 100 pts" used to sit here, over six
          factors — Clima laboral (eNPS) 75, Desempeño 79, Retención 83 —
          weighted [.2 .2 .2 .15 .15 .1] into a single score. There is no
          survey, no performance cycle and no attrition model behind any of
          those numbers; they were typed in, and the weighting made them look
          computed. It was replaced with panels that only render when their
          module is on: the document chart, pending signatures, activity feed.
        */}
        {data.show.documental && (
        <div className="card rise d3">
          <div className="chead">
            <div className="ctitle">Actividad documental</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div className="legend">
                <span className="lg"><span className="lgd" style={{ background: '#3b82f6' }} />Firmas</span>
                <span className="lg"><span className="lgd" style={{ background: series.neutral }} />Documentos</span>
              </div>
              <span className="range">Últimos 6 meses</span>
            </div>
          </div>
          <div className="cpad" style={{ height: 270 }}>
            {!hasChart ? (
              <div className="dempty" style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                Todavía no hay firmas ni documentos que graficar.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {/* Counted per month from `signed_at` and `created_at`. The old
                    six points were literals that never moved. */}
                <AreaChart data={data.serie} margin={{ top: 14, right: 6, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.22} />
                      <stop offset="40%" stopColor="#3b82f6" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gK" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={series.neutralFill} stopOpacity={0.14} />
                      <stop offset="50%" stopColor={series.neutralFill} stopOpacity={0.04} />
                      <stop offset="100%" stopColor={series.neutralFill} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--line2)" strokeDasharray="4 4" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} dy={8} tick={{ fill: 'var(--ink3)', fontSize: 12, fontWeight: 400 }} />
                  <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} tick={{ fill: 'var(--ink3)', fontSize: 11 }} />
                  <Tooltip content={<ChartTip />} cursor={{ stroke: 'var(--line)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area type="monotone" dataKey="documentos" stroke={series.neutral} strokeWidth={2} fill="url(#gK)"
                    dot={{ r: 3.5, strokeWidth: 2, fill: 'var(--bg2)', stroke: series.neutral }}
                    activeDot={{ r: 5.5, strokeWidth: 2, fill: 'var(--bg2)', stroke: series.neutral }} />
                  <Area type="monotone" dataKey="firmas" stroke="#3b82f6" strokeWidth={2.6} fill="url(#gR)"
                    dot={{ r: 4, strokeWidth: 2, fill: 'var(--bg2)', stroke: '#3b82f6' }}
                    activeDot={{ r: 6, strokeWidth: 2.5, fill: 'var(--bg2)', stroke: '#3b82f6' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        )}

        {data.show.firmas && (
        <div className="card rise d4">
          <div className="chead">
            <div className="ctitle">Firmas pendientes</div>
            <button className="clink" onClick={() => go('firmas')}>Ver todo <ChevronRight size={14} /></button>
          </div>
          {data.pendientes.length === 0 ? (
            <div className="dempty" style={{ padding: '28px 0', textAlign: 'center' }}>
              No hay documentos esperando firma.
            </div>
          ) : (
            <div className="tblwrap">
              <table className="tbl">
                <tbody>
                  {data.pendientes.map((p) => (
                    <tr className="trow" key={p.id} style={{ cursor: 'pointer' }} onClick={() => go('firmas')}>
                      <td>
                        <div className="cename">{p.title}</div>
                        <div className="ceid">{p.detail}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}><ChevronRight size={14} color="var(--ink3)" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}
      </div>

      <div className="g2b" style={{ marginTop: 16 }}>
        <div className="card ins-top rise d5">
          <div className="chead">
            <div className="ctitle">Resumen ejecutivo IA</div>
            {insightsAvailable && (
              <button className="iref" data-tip="Actualizar resumen" onClick={() => void genInsights(true)} disabled={loadingInsights} aria-busy={loadingInsights} title="Actualizar">
                {loadingInsights ? <span className="ispin" /> : <span className="kvs">{updatedAgo}</span>}
              </button>
            )}
          </div>
          {!insightsAvailable ? (
            <div className="cpad">
              {/* Says so, rather than printing three sentences from the source
                  as if a model had written them. */}
              <p className="psub">
                El asistente de IA no está configurado en esta instalación, así que no hay
                resumen automático.
              </p>
            </div>
          ) : loadingInsights ? (
            <div className="cpad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="skel" /><div className="skel" /><div className="skel" style={{ width: '70%' }} />
            </div>
          ) : insights.length === 0 ? (
            <div className="cpad"><p className="psub">Todavía no hay suficiente actividad para resumir.</p></div>
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

        {data.show.trazabilidad && (
        <div className="card rise d6">
          <div className="chead">
            <div className="ctitle">Trazabilidad reciente</div>
            <button className="clink" onClick={() => go('trazabilidad')}>Ver todo <ChevronRight size={14} /></button>
          </div>
          {/* From `audit_log` — the same table the Trazabilidad page reads.
              The eight events here used to be a fixture attributed to named
              colleagues, including one credited to "Asistente IA". */}
          {data.actividad.length === 0 ? (
            <div className="dempty" style={{ padding: '28px 0', textAlign: 'center' }}>
              Todavía no hay actividad registrada.
            </div>
          ) : (
            <div className="tl">
              {data.actividad.map((e, i, arr) => (
                <div className={`tli ${i === arr.length - 1 ? 'last' : ''}`} key={e.id}>
                  <div className="tlrail"><div className="tlnode" /></div>
                  <div className="tlbody">
                    <div className="tltop">
                      <div className="tltxt"><b>{e.who}</b> {e.what}</div>
                      <div className="tltime mono">{TIME.format(new Date(e.at))}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </div>

      {/* The "Recomendaciones" card sat here with three fixed entries whose
          reasons cited the same invented figures ("rotación 14.5%"). It now
          renders only what the model actually returned. */}
      {recs.length > 0 && (
        <div className="card rise d6" style={{ marginTop: 16 }}>
          <div className="chead">
            <div className="ctitle">Recomendaciones</div>
            {loadingInsights && <span className="ispin" />}
          </div>
          <div className="reclist">
            {recs.map((r) => (
              <button className="recrow" key={r.id} onClick={() => go('riesgos')}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span className={`badge b-${r.tone}`}><span className="bd" />{r.prioridad}</span>
                    <span className="reccat">{r.cat}</span>
                  </div>
                  <div className="recto">{r.titulo}</div>
                  <div className="recra">{r.razon}</div>
                </div>
                <ChevronRight size={16} color="var(--ink3)" style={{ flexShrink: 0, alignSelf: 'center' }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
