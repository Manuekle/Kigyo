'use client'

import { useMemo, useState, useTransition } from 'react'
import type { ComponentType } from 'react'
import { Wallet, Users, ShieldCheck, TrendingUp, TrendingDown, FileSpreadsheet, Plus, X } from '@/lib/icons'
import type { IconProps } from '@/lib/icons'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import ChartTip from '@/components/ui/ChartTip'
import Select from '@/components/ui/Select'
import { useExport } from '@/lib/hooks/use-export'
import { useApp } from '@/lib/context/AppContext'
import { cop } from '@/lib/utils'
import { PAYROLL_STATUSES } from '@/lib/domain'
import type { NominaData } from '@/server/queries/nomina'
import { createBeneficio, deleteBeneficio, openPeriod, setPeriodStatus } from '@/server/mutations/nomina'

const MONTH_SHORT = new Intl.DateTimeFormat('es-CO', { month: 'short' })
const MONTH_LONG = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })
const asDate = (iso: string) => new Date(`${iso}T00:00:00`)

const BENEFIT_KINDS = ['Salud', 'Alimentación', 'Seguro', 'Transporte', 'Educación', 'Otro']

function Stat({ ico: Ico, tone = 'ink', label, value, sub }: {
  ico: ComponentType<IconProps>; tone?: string; label: string; value: string | number; sub?: string
}) {
  return (
    <div className="card kpi">
      <div className={`kglow ${tone}`} />
      <div className="klab">
        <span className={`kico-soft ${tone}`}><Ico size={16} /></span>
        {label}
      </div>
      <div className="kval">{value}</div>
      {sub && <div className="kvs" style={{ marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

export default function NominaPage({ data }: { data: NominaData }) {
  const { addToast } = useApp()
  const { runExport, exporting } = useExport()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState<NominaData>(data)
  const [benefOpen, setBenefOpen] = useState(false)
  const [form, setForm] = useState({ name: '', kind: 'Otro', cost: '', coverage: '100' })

  const { periods, areas, beneficios } = state
  const current = periods[0] ?? null

  const stats = useMemo(() => {
    const total = current?.totalCents ?? 0
    const headcount = areas.reduce((s, a) => s + a.headcount, 0)
    const benefits = beneficios.reduce((s, b) => s + b.monthlyCostCents, 0)

    // Month-over-month against the *previous* period that actually exists,
    // rather than two literals from a fixture array. Null when there is
    // nothing to compare against — a single period has no variation.
    const previous = periods[1]
    const variation = previous && previous.totalCents > 0
      ? ((total - previous.totalCents) / previous.totalCents) * 100
      : null

    return {
      total,
      headcount,
      average: headcount > 0 ? Math.round(total / headcount) : 0,
      benefits,
      variation,
    }
  }, [current, areas, beneficios, periods])

  // Oldest first for the chart; the query returns newest first for the list.
  const chart = useMemo(
    () => [...periods].reverse().map((p) => ({
      m: MONTH_SHORT.format(asDate(p.period)).replace('.', ''),
      period: p.period,
      v: p.totalCents / 100,
    })),
    [periods],
  )

  const exportNomina = () => {
    void runExport(
      areas.map((a) => ({
        'Área': a.area,
        Personas: a.headcount,
        'Costo mensual': a.costCents / 100,
        'Costo por persona': a.headcount ? Math.round(a.costCents / a.headcount) / 100 : 0,
      })),
      'nomina-kigyo',
      'nomina',
    )
  }

  function addBenefit() {
    if (!form.name.trim()) { addToast('El nombre del beneficio es obligatorio', 'err'); return }
    startTransition(async () => {
      const result = await createBeneficio({
        name: form.name.trim(),
        kind: form.kind as 'Otro',
        // Pesos in the field, cents in the column.
        monthlyCostCents: Math.round((Number(form.cost) || 0) * 100),
        coveragePct: Math.min(100, Math.max(0, Number(form.coverage) || 0)),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setBenefOpen(false)
      setForm({ name: '', kind: 'Otro', cost: '', coverage: '100' })
      addToast('Beneficio añadido', 'ok')
    })
  }

  function removeBenefit(id: string, name: string) {
    startTransition(async () => {
      const result = await deleteBeneficio(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast(`"${name}" eliminado`, 'info')
    })
  }

  function openThisMonth() {
    const period = `${new Date().toISOString().slice(0, 7)}-01`
    startTransition(async () => {
      const result = await openPeriod({ period })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Periodo de nómina abierto', 'ok')
    })
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat ico={Wallet} tone="grn" label="Costo total de nómina" value={cop(stats.total / 100)} sub={current ? MONTH_LONG.format(asDate(current.period)) : 'sin periodo'} /></div>
        <div className="rise d2"><Stat ico={Users} tone="blu" label="Costo promedio" value={cop(stats.average / 100)} sub={`${stats.headcount} personas`} /></div>
        <div className="rise d3"><Stat ico={ShieldCheck} tone="vio" label="Beneficios otorgados" value={cop(stats.benefits / 100)} sub="mensual" /></div>
        <div className="rise d4">
          <Stat
            ico={(stats.variation ?? 0) >= 0 ? TrendingUp : TrendingDown}
            tone={stats.variation === null ? 'neu' : stats.variation >= 0 ? 'amb' : 'grn'}
            label="Variación mensual"
            value={stats.variation === null ? '—' : `${stats.variation > 0 ? '+' : ''}${stats.variation.toFixed(1)}%`}
            sub={stats.variation === null ? 'falta un periodo previo' : 'contra el mes anterior'}
          />
        </div>
      </div>

      <div className="g2">
        <div className="card rise d2">
          <div className="chead">
            <div className="ctitle">Evolución de nómina</div>
            <span className="range">{periods.length > 0 ? `Últimos ${periods.length} periodos` : 'Sin periodos'}</span>
          </div>
          <div className="cpad" style={{ height: 250 }}>
            {chart.length === 0 ? (
              <div className="dempty" style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                Todavía no hay periodos de nómina.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ top: 14, right: 6, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gN" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.24} />
                      <stop offset="35%" stopColor="#10b981" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--line2)" strokeDasharray="4 4" />
                  <XAxis dataKey="m" tickLine={false} axisLine={false} dy={8} tick={{ fill: 'var(--ink3)', fontSize: 12, fontWeight: 400 }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tick={{ fill: 'var(--ink3)', fontSize: 11 }}
                    tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000)} M`}
                  />
                  <Tooltip
                    content={<ChartTip valueFormatter={(v) => cop(Number(v))} />}
                    cursor={{ stroke: 'var(--line)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2.6} fill="url(#gN)"
                    dot={{ r: 4, strokeWidth: 2, fill: '#1A1A1A', stroke: '#10b981' }}
                    activeDot={{ r: 6, strokeWidth: 2.5, fill: '#1A1A1A', stroke: '#10b981' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card rise d3">
          <div className="chead">
            <div className="ctitle">Beneficios</div>
            {state.canWrite && (
              <button className="btn ghost" onClick={() => setBenefOpen(true)}><Plus size={13} />Añadir</button>
            )}
          </div>
          <div style={{ padding: '0 16px 16px' }}>
            {beneficios.length === 0 ? (
              <div className="dempty">Sin beneficios registrados</div>
            ) : beneficios.map((b) => (
              <div className="elrow" key={b.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="eltxt">{b.name}</div>
                  <div className="elsub">{b.kind} · {b.coveragePct}% del equipo</div>
                </div>
                <div className="eltxt">{cop(b.monthlyCostCents / 100)}</div>
                {state.canWrite && (
                  <button className="ibtn" style={{ width: 26, height: 26, marginLeft: 6 }} disabled={pending} onClick={() => removeBenefit(b.id, b.name)} aria-label={`Eliminar ${b.name}`}>
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card rise d4" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">
            Costo por departamento
            {current && <span className="range cap-first" style={{ marginLeft: 8, display: 'inline-block' }}>{MONTH_LONG.format(asDate(current.period))}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {current && state.canWrite && (
              <Select
                value={current.status}
                onChange={(v) => startTransition(async () => {
                  const result = await setPeriodStatus({ period: current.period, status: v as 'Borrador' })
                  if (!result.ok) { addToast(result.error, 'err'); return }
                  setState(result.data)
                  addToast(`Periodo marcado como ${v}`, 'ok')
                })}
                options={[...PAYROLL_STATUSES]}
              />
            )}
            <button disabled={exporting} aria-busy={exporting} className="btn ghost" onClick={exportNomina}><FileSpreadsheet size={15} />Exportar</button>
          </div>
        </div>
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th scope="col">Área</th><th scope="col">Personas</th><th scope="col">Costo mensual</th><th scope="col">Costo / persona</th></tr></thead>
            <tbody>
              {areas.length === 0 ? (
                <tr><td colSpan={4}>
                  <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                    {periods.length === 0 ? (
                      <>
                        Todavía no hay periodos de nómina.
                        {state.canWrite && (
                          <div style={{ marginTop: 10 }}>
                            <button className="btn pri" onClick={openThisMonth} disabled={pending}>
                              <Plus size={14} />Abrir el periodo de este mes
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      'El periodo está abierto pero sus líneas todavía están en cero.'
                    )}
                  </div>
                </td></tr>
              ) : areas.map((a) => (
                <tr className="trow" key={a.area}>
                  <td className="cename">{a.area}</td>
                  <td className="muted">{a.headcount}</td>
                  {/*
                    Read-only. The old table let you click a department's cost
                    and type a new number, which is not a thing payroll has:
                    the figure is the sum of what individual people are paid,
                    so an editable total would immediately disagree with the
                    lines underneath it.
                  */}
                  <td className="cename">{cop(a.costCents / 100)}</td>
                  <td className="muted">{cop(Math.round(a.costCents / a.headcount) / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {benefOpen && (
        <div className="mwrap" onClick={() => setBenefOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Nuevo beneficio</div><button className="ibtn" onClick={() => setBenefOpen(false)} aria-label="Cerrar"><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Nombre del beneficio</div>
              <input className="field" placeholder="Ej. Seguro de vida" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <div className="flabel">Tipo</div>
              <Select value={form.kind} onChange={(v) => setForm((f) => ({ ...f, kind: v }))} options={BENEFIT_KINDS} />
              <div className="fg2">
                <div>
                  <div className="flabel">Costo mensual (COP)</div>
                  <input className="field" type="number" min={0} placeholder="0" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} />
                </div>
                <div>
                  <div className="flabel">Cobertura (%)</div>
                  <input className="field" type="number" min={0} max={100} value={form.coverage} onChange={(e) => setForm((f) => ({ ...f, coverage: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => setBenefOpen(false)} disabled={pending}>Cancelar</button>
              <button className="btn dark" onClick={addBenefit} disabled={pending} aria-busy={pending}>
                {pending ? 'Añadiendo…' : 'Añadir beneficio'}
              </button>
            </div></div>
          </div>
        </div>
      )}
    </>
  )
}
