'use client'

import { useMemo, useState, useTransition } from 'react'
import { Wallet, Users, ShieldCheck, TrendingUp, TrendingDown, FileSpreadsheet, Plus, PenLine, X, Lock, DollarSign, Tag, Printer } from '@/lib/icons'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import ChartTip from '@/components/ui/ChartTip'
import Stat from '@/components/ui/Stat'
import Select from '@/components/ui/Select'
import { useExport } from '@/lib/hooks/use-export'
import { useApp } from '@/lib/context/AppContext'
import { cop } from '@/lib/utils'
import { PAYROLL_STATUSES } from '@/lib/domain'
import type { NominaData, BeneficioRow, ConceptRow, EmployeeLineRow, PayrollRulesRow } from '@/server/queries/nomina'
import { createBeneficio, deleteBeneficio, openPeriod, setPeriodStatus, updateBeneficio, createConcept, deleteConcept, saveRules, saveLine, deleteLine, lockPeriod, exportPila } from '@/server/mutations/nomina'

const MONTH_SHORT = new Intl.DateTimeFormat('es-CO', { month: 'short' })
const MONTH_LONG = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })
const asDate = (iso: string) => new Date(`${iso}T00:00:00`)

const BENEFIT_KINDS = ['Salud', 'Alimentación', 'Seguro', 'Transporte', 'Educación', 'Otro']

/** Editable amount (pesos) of one desglose line; commits on blur. */
function LineAmount({ line, locked, onSave }: {
  line: { id: string; amountCents: number }
  locked: boolean
  onSave: (id: string, amountCents: number) => void
}) {
  const [value, setValue] = useState(String(line.amountCents / 100))
  if (!locked && value !== String(line.amountCents / 100) && value.trim() === '') {
    // keep the empty state while typing; commit on blur
  }
  return (
    <input
      className="field"
      type="number"
      min={0}
      step={100}
      disabled={locked}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const n = Math.round((Number(value) || 0) * 100)
        if (n !== line.amountCents) onSave(line.id, n)
        // Muestra lo commitido, no la prop vieja: el refresh del server action
        // llega con la línea nueva, pero el useState ya re-syncó contra la
        // antigua y el input quedaría mostrando el valor anterior.
        setValue(String(n / 100))
      }}
      aria-label="Valor del concepto"
      style={{ width: 120, textAlign: 'right' }}
    />
  )
}

export default function NominaPage({ data }: { data: NominaData }) {
  const { addToast } = useApp()
  const { runExport, exporting } = useExport()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState<NominaData>(data)
  const [benefOpen, setBenefOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [benefSearch, setBenefSearch] = useState('')
  const [form, setForm] = useState({ name: '', kind: 'Otro', cost: '', coverage: '100' })

  // Nómina legal
  const [rulesOpen, setRulesOpen] = useState(false)
  const [conceptsOpen, setConceptsOpen] = useState(false)
  const [confirmLock, setConfirmLock] = useState(false)
  const [desprendible, setDesprendible] = useState<EmployeeLineRow | null>(null)
  const [newConcept, setNewConcept] = useState({ name: '', kind: 'Devengo' })
  const [addLine, setAddLine] = useState<{ employeeId: string; conceptId: string; amount: string } | null>(null)
  const [rulesForm, setRulesForm] = useState<Record<string, string>>({})

  const { periods, areas, beneficios, rules, concepts, breakdown, periodLocked, periodId } = state
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

  const visibleBenefits = useMemo(() => {
    const q = benefSearch.trim().toLowerCase()
    if (!q) return beneficios
    return beneficios.filter((b) => b.name.toLowerCase().includes(q) || b.kind.toLowerCase().includes(q))
  }, [beneficios, benefSearch])

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

  const exportPilaCsv = () => {
    if (!periodId) return
    startTransition(async () => {
      const rows = await exportPila(periodId)
      if (rows.length === 0) { addToast('El periodo no tiene líneas que exportar', 'err'); return }
      runExport(
        rows.map((r) => ({
          'Tipo documento': r.tipo_documento,
          Documento: r.documento,
          Nombre: r.nombre,
          'Tipo cotizante': r.tipo_cotizante,
          'Salario base': r.salario_base_cents / 100,
          Salud: r.salud_cents / 100,
          Pensión: r.pension_cents / 100,
          ARL: r.arl_cents / 100,
          Caja: r.caja_cents / 100,
          'Total aportes': r.total_aportes_cents / 100,
        })),
        `pila-${current?.period ?? 'periodo'}`,
        // 'nomina' (no 'pila'): el export route resuelve el permiso via
        // ROUTE_PERMISSIONS y 'pila' no es clave — con 'pila' siempre 403.
        'nomina',
      )
    })
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

  function startEdit(b: BeneficioRow) {
    setForm({
      name: b.name,
      kind: b.kind,
      cost: String(b.monthlyCostCents / 100),
      coverage: String(b.coveragePct),
    })
    setEditing(b.id)
    setBenefOpen(true)
  }

  function saveEdit() {
    if (!form.name.trim() || !editing) { addToast('El nombre del beneficio es obligatorio', 'err'); return }
    startTransition(async () => {
      const result = await updateBeneficio({
        id: editing,
        name: form.name.trim(),
        kind: form.kind as 'Otro',
        monthlyCostCents: Math.round((Number(form.cost) || 0) * 100),
        coveragePct: Math.min(100, Math.max(0, Number(form.coverage) || 0)),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setBenefOpen(false)
      setEditing(null)
      setForm({ name: '', kind: 'Otro', cost: '', coverage: '100' })
      addToast('Beneficio actualizado', 'ok')
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

  // ── Nómina legal ─────────────────────────────────────────────────────────

  function openRules() {
    const year = rules?.year ?? new Date().getFullYear()
    const source: PayrollRulesRow = rules ?? {
      year,
      minWageCents: 0, transportCents: 0,
      cesantiasPct: 8.33, primaPct: 8.33, interesCesantiasPct: 1, vacacionesPct: 4.17,
      saludEmployeePct: 4, saludEmployerPct: 8.5,
      pensionEmployeePct: 4, pensionEmployerPct: 12,
      arlPct: 0.52, cajaPct: 3, vacationDays: 15,
    }
    const cents = (v: number) => String(v / 100)
    setRulesForm({
      year: String(source.year),
      minWage: cents(source.minWageCents),
      transport: cents(source.transportCents),
      cesantias: String(source.cesantiasPct),
      prima: String(source.primaPct),
      intCesantias: String(source.interesCesantiasPct),
      vacaciones: String(source.vacacionesPct),
      saludEmp: String(source.saludEmployeePct),
      saludEmpl: String(source.saludEmployerPct),
      pensionEmp: String(source.pensionEmployeePct),
      pensionEmpl: String(source.pensionEmployerPct),
      arl: String(source.arlPct),
      caja: String(source.cajaPct),
      vacDays: String(source.vacationDays),
    })
    setRulesOpen(true)
  }

  function submitRules() {
    const n = (k: string) => Number(rulesForm[k] || 0)
    startTransition(async () => {
      const result = await saveRules({
        year: n('year'),
        minWageCents: Math.round(n('minWage') * 100),
        transportCents: Math.round(n('transport') * 100),
        cesantiasPct: n('cesantias'),
        primaPct: n('prima'),
        interesCesantiasPct: n('intCesantias'),
        vacacionesPct: n('vacaciones'),
        saludEmployeePct: n('saludEmp'),
        saludEmployerPct: n('saludEmpl'),
        pensionEmployeePct: n('pensionEmp'),
        pensionEmployerPct: n('pensionEmpl'),
        arlPct: n('arl'),
        cajaPct: n('caja'),
        vacationDays: n('vacDays'),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setRulesOpen(false)
      addToast('Reglas legales guardadas', 'ok')
    })
  }

  function submitConcept() {
    if (!newConcept.name.trim()) { addToast('El nombre del concepto es obligatorio', 'err'); return }
    startTransition(async () => {
      const result = await createConcept({
        name: newConcept.name.trim(),
        kind: newConcept.kind as 'Devengo',
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setNewConcept({ name: '', kind: 'Devengo' })
      addToast('Concepto añadido', 'ok')
    })
  }

  function removeConcept(id: string, name: string) {
    startTransition(async () => {
      const result = await deleteConcept(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast(`"${name}" eliminado`, 'info')
    })
  }

  function commitLine(lineId: string, amountCents: number) {
    if (!periodId) return
    // Find the line's employee to keep the desglose consistent.
    const owner = breakdown.find((b) => b.lines.some((l) => l.id === lineId))
    if (!owner) return
    startTransition(async () => {
      const result = await saveLine({
        periodId,
        employeeId: owner.employeeId,
        lineId,
        name: owner.lines.find((l) => l.id === lineId)?.name ?? '',
        kind: owner.lines.find((l) => l.id === lineId)?.kind ?? 'Devengo',
        amountCents,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
    })
  }

  function addConceptLine(employeeId: string) {
    if (!periodId || !addLine) return
    const concept = concepts.find((c) => c.id === addLine.conceptId)
    if (!concept) { addToast('Elige un concepto', 'err'); return }
    const amountCents = Math.round((Number(addLine.amount) || 0) * 100)
    if (amountCents <= 0) { addToast('El valor debe ser mayor a cero', 'err'); return }
    startTransition(async () => {
      const result = await saveLine({
        periodId,
        employeeId,
        name: concept.name,
        kind: concept.kind,
        amountCents,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setAddLine(null)
    })
  }

  function removeLine(lineId: string, name: string) {
    startTransition(async () => {
      const result = await deleteLine(lineId)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast(`"${name}" eliminado`, 'info')
    })
  }

  function doLock() {
    if (!periodId) return
    startTransition(async () => {
      const result = await lockPeriod(periodId)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setConfirmLock(false)
      addToast('Periodo cerrado: líneas inmutables', 'ok')
    })
  }

  function printDesprendible(e: EmployeeLineRow) {
    const lines = [...e.lines].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'Devengo' ? -1 : 1))
    const dev = lines.filter((l) => l.kind === 'Devengo').reduce((s, l) => s + l.amountCents, 0)
    const ded = lines.filter((l) => l.kind === 'Deducción').reduce((s, l) => s + l.amountCents, 0)
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Desprendible ${e.fullName}</title>
<style>
  body { font-family: Arial, sans-serif; color: #111; margin: 40px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border-bottom: 1px solid #ddd; padding: 7px 8px; text-align: left; }
  th { border-bottom: 2px solid #999; }
  .dev { color: #0a7a3d; } .ded { color: #a02424; }
  .tot { font-weight: bold; border-top: 2px solid #999; }
  .net { font-size: 15px; margin-top: 18px; }
  .firm { margin-top: 60px; font-size: 12px; color: #555; }
</style></head><body>
<h1>Kigyo — Desprendible de nómina</h1>
<div class="meta">${e.fullName} · ${e.department ?? 'Sin área'} · ${e.taxId ? `CC ${e.taxId}` : ''}<br>Periodo: ${current ? MONTH_LONG.format(asDate(current.period)) : '—'}</div>
<table>
  <thead><tr><th>Concepto</th><th>Tipo</th><th style="text-align:right">Valor</th></tr></thead>
  <tbody>
    ${lines.map((l) => `<tr><td>${l.name}</td><td class="${l.kind === 'Devengo' ? 'dev' : 'ded'}">${l.kind}</td><td style="text-align:right">${cop(l.amountCents / 100)}</td></tr>`).join('')}
    <tr class="tot"><td>Total devengos</td><td></td><td style="text-align:right">${cop(dev / 100)}</td></tr>
    <tr class="tot"><td>Total deducciones</td><td></td><td style="text-align:right">${cop(ded / 100)}</td></tr>
  </tbody>
</table>
<div class="net"><strong>Neto a pagar: ${cop(e.netCents / 100)}</strong></div>
<div class="firm">Este desprendible es informativo. Los parámetros legales los parametriza el contador de la empresa.</div>
<script>window.print()</script>
</body></html>`
    const win = window.open('', '_blank', 'width=720,height=900')
    if (win) { win.document.write(html); win.document.close() }
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat icon={<Wallet size={16} />} tone="grn" label="Costo total de nómina" value={cop(stats.total / 100)} sub={current ? MONTH_LONG.format(asDate(current.period)) : 'sin periodo'} /></div>
        <div className="rise d2"><Stat icon={<Users size={16} />} tone="blu" label="Costo promedio" value={cop(stats.average / 100)} sub={`${stats.headcount} personas`} /></div>
        <div className="rise d3"><Stat icon={<ShieldCheck size={16} />} tone="vio" label="Beneficios otorgados" value={cop(stats.benefits / 100)} sub="mensual" /></div>
        <div className="rise d4">
          <Stat
            icon={(stats.variation ?? 0) >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
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
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="field" placeholder="Buscar beneficio…" value={benefSearch} onChange={(e) => setBenefSearch(e.target.value)} aria-label="Buscar beneficio" style={{ width: 150 }} />
              {state.canWrite && (
                <button className="btn ghost" onClick={() => { setEditing(null); setBenefOpen(true) }}><Plus size={13} />Añadir</button>
              )}
            </div>
          </div>
          <div style={{ padding: '0 16px 16px' }}>
            {beneficios.length === 0 ? (
              <div className="dempty">Sin beneficios registrados</div>
            ) : visibleBenefits.length === 0 ? (
              <div className="dempty">Sin resultados para la búsqueda</div>
            ) : visibleBenefits.map((b) => (
              <div className="elrow" key={b.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="eltxt">{b.name}</div>
                  <div className="elsub">{b.kind} · {b.coveragePct}% del equipo</div>
                </div>
                <div className="eltxt">{cop(b.monthlyCostCents / 100)}</div>
                {state.canWrite && (
                  <button className="ibtn" style={{ width: 26, height: 26, marginLeft: 6 }} disabled={pending} onClick={() => startEdit(b)} aria-label={`Editar ${b.name}`}>
                    <PenLine size={13} />
                  </button>
                )}
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

      <div className="card rise d3" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">
            Desglose por empleado
            {current && <span className="range cap-first" style={{ marginLeft: 8, display: 'inline-block' }}>{MONTH_LONG.format(asDate(current.period))}</span>}
            {periodLocked && <span className="range" style={{ marginLeft: 8 }}>🔒 cerrado</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {state.canWrite && (
              <button className="btn ghost" onClick={() => setConceptsOpen(true)}><Tag size={14} />Conceptos</button>
            )}
            {current && !periodLocked && state.canWrite && (
              <button className="btn ghost" onClick={() => setConfirmLock(true)}><Lock size={14} />Cerrar periodo</button>
            )}
            {current && (
              <button disabled={exporting} aria-busy={exporting} className="btn ghost" onClick={exportPilaCsv}><FileSpreadsheet size={15} />PILA</button>
            )}
          </div>
        </div>
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th scope="col">Empleado</th><th scope="col">Concepto</th><th scope="col">Tipo</th><th scope="col" style={{ textAlign: 'right' }}>Valor</th><th scope="col"></th></tr></thead>
            <tbody>
              {breakdown.length === 0 ? (
                <tr><td colSpan={5}>
                  <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                    {periods.length === 0 ? 'Abre un periodo para ver el desglose.' : 'El periodo está abierto pero sin líneas.'}
                  </div>
                </td></tr>
              ) : breakdown.map((e) => {
                const dev = e.lines.filter((l) => l.kind === 'Devengo').reduce((s, l) => s + l.amountCents, 0)
                const ded = e.lines.filter((l) => l.kind === 'Deducción').reduce((s, l) => s + l.amountCents, 0)
                return (
                  <FragmentRow
                    key={e.employeeId}
                    e={e}
                    dev={dev}
                    ded={ded}
                    concepts={concepts}
                    locked={periodLocked || !state.canWrite}
                    pending={pending}
                    addLine={addLine}
                    setAddLine={setAddLine}
                    onAddLine={() => addConceptLine(e.employeeId)}
                    onCommit={commitLine}
                    onRemoveLine={removeLine}
                    onPrint={() => printDesprendible(e)}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card rise d2" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">
            <DollarSign size={15} /> Reglas legales {rules ? rules.year : new Date().getFullYear()}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {state.canWrite && <button className="btn ghost" onClick={openRules}><PenLine size={13} />Editar</button>}
          </div>
        </div>
        <div className="cpad">
          {rules && rules.minWageCents === 0 ? (
            <div className="muted" style={{ marginBottom: 12, padding: '10px 12px', background: 'var(--panel2)', borderRadius: 10, fontSize: 12 }}>
              Parámetros en cero: un contador laboral debe fijar salario mínimo, auxilio y porcentajes antes de producir.
            </div>
          ) : null}
          {!rules ? (
            <div className="dempty">Aún no hay reglas para este año. Edita para crear las del año en curso.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
              {([
                ['Salario mínimo', cop(rules.minWageCents / 100)],
                ['Auxilio transporte', cop(rules.transportCents / 100)],
                ['Cesantías', `${rules.cesantiasPct}%`],
                ['Prima', `${rules.primaPct}%`],
                ['Int. cesantías', `${rules.interesCesantiasPct}%`],
                ['Vacaciones', `${rules.vacacionesPct}%`],
                ['Salud (empleado)', `${rules.saludEmployeePct}%`],
                ['Salud (empleador)', `${rules.saludEmployerPct}%`],
                ['Pensión (empleado)', `${rules.pensionEmployeePct}%`],
                ['Pensión (empleador)', `${rules.pensionEmployerPct}%`],
                ['ARL', `${rules.arlPct}%`],
                ['Caja compensación', `${rules.cajaPct}%`],
                ['Días de vacaciones', String(rules.vacationDays)],
              ] as const).map(([k, v]) => (
                <div className="elrow" key={k}>
                  <span className="elsub">{k}</span>
                  <span className="eltxt">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {benefOpen && (
        <div className="mwrap" onClick={() => setBenefOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">{editing ? 'Editar beneficio' : 'Nuevo beneficio'}</div><button className="ibtn" onClick={() => setBenefOpen(false)} aria-label="Cerrar"><X size={18} /></button></div>
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
              <button className="btn dark" onClick={editing ? saveEdit : addBenefit} disabled={pending} aria-busy={pending}>
                {pending ? (editing ? 'Guardando…' : 'Añadiendo…') : (editing ? 'Guardar cambios' : 'Añadir beneficio')}
              </button>
            </div></div>
          </div>
        </div>
      )}

      {rulesOpen && (
        <div className="mwrap" onClick={() => setRulesOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Reglas legales {rulesForm.year || new Date().getFullYear()}</div><button className="ibtn" onClick={() => setRulesOpen(false)} aria-label="Cerrar"><X size={18} /></button></div>
            <div className="mbody">
              <div className="muted" style={{ marginTop: 0, padding: '10px 12px', background: 'var(--panel2)', borderRadius: 10, fontSize: 12 }}>
                Parámetros anuales de la nómina colombiana. Los fija el contador laboral de la empresa; Kigyo no inventa cifras regulatorias.
              </div>
              <div className="fg2">
                <div>
                  <div className="flabel">Año</div>
                  <input className="field" type="number" min={2000} max={2100} value={rulesForm.year ?? ''} onChange={(e) => setRulesForm((f) => ({ ...f, year: e.target.value }))} />
                </div>
                <div>
                  <div className="flabel">Salario mínimo (COP/mes)</div>
                  <input className="field" type="number" min={0} step={1000} value={rulesForm.minWage ?? ''} onChange={(e) => setRulesForm((f) => ({ ...f, minWage: e.target.value }))} />
                </div>
              </div>
              <div className="fg2">
                <div>
                  <div className="flabel">Auxilio de transporte (COP/mes)</div>
                  <input className="field" type="number" min={0} step={100} value={rulesForm.transport ?? ''} onChange={(e) => setRulesForm((f) => ({ ...f, transport: e.target.value }))} />
                </div>
                <div>
                  <div className="flabel">Días de vacaciones por año</div>
                  <input className="field" type="number" min={0} max={60} value={rulesForm.vacDays ?? ''} onChange={(e) => setRulesForm((f) => ({ ...f, vacDays: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                {([
                  ['cesantias', 'Cesantías %'], ['prima', 'Prima %'], ['intCesantias', 'Int. cesantías %'],
                  ['vacaciones', 'Vacaciones %'], ['saludEmp', 'Salud empleado %'], ['saludEmpl', 'Salud empleador %'],
                  ['pensionEmp', 'Pensión empleado %'], ['pensionEmpl', 'Pensión empleador %'], ['arl', 'ARL %'], ['caja', 'Caja %'],
                ] as const).map(([k, label]) => (
                  <div key={k}>
                    <div className="flabel">{label}</div>
                    <input className="field" type="number" min={0} max={100} step={0.01} value={rulesForm[k] ?? ''} onChange={(e) => setRulesForm((f) => ({ ...f, [k]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </div>
            <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => setRulesOpen(false)} disabled={pending}>Cancelar</button>
              <button className="btn dark" onClick={submitRules} disabled={pending} aria-busy={pending}>
                {pending ? 'Guardando…' : 'Guardar reglas'}
              </button>
            </div></div>
          </div>
        </div>
      )}

      {conceptsOpen && (
        <div className="mwrap" onClick={() => setConceptsOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Conceptos de nómina</div><button className="ibtn" onClick={() => setConceptsOpen(false)} aria-label="Cerrar"><X size={18} /></button></div>
            <div className="mbody">
              <div className="muted" style={{ marginTop: 0, padding: '10px 12px', background: 'var(--panel2)', borderRadius: 10, fontSize: 12 }}>
                Catálogo de la empresa: salario, auxilio, horas extras, novedades, préstamos… Cada línea copia el nombre, así que borrar un concepto no reescribe la historia.
              </div>
              <div className="elrow">
                <input className="field" placeholder="Nombre (ej. Horas extras)" value={newConcept.name} onChange={(e) => setNewConcept((c) => ({ ...c, name: e.target.value }))} style={{ flex: 1 }} />
                <Select value={newConcept.kind} onChange={(v) => setNewConcept((c) => ({ ...c, kind: v }))} options={['Devengo', 'Deducción']} />
                <button className="btn ghost" onClick={submitConcept} disabled={pending} aria-label="Añadir concepto"><Plus size={14} /></button>
              </div>
              {concepts.length === 0 ? (
                <div className="dempty">Sin conceptos todavía.</div>
              ) : (
                <div style={{ maxHeight: 320, overflowY: 'auto', marginTop: 8 }}>
                  {concepts.map((c: ConceptRow) => (
                    <div className="elrow" key={c.id}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="eltxt">{c.name}</div>
                        <div className="elsub">{c.kind}</div>
                      </div>
                      {state.canWrite && (
                        <button className="ibtn" style={{ width: 26, height: 26 }} disabled={pending} onClick={() => removeConcept(c.id, c.name)} aria-label={`Eliminar ${c.name}`}><X size={13} /></button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmLock && (
        <div className="mwrap" onClick={() => setConfirmLock(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Cerrar periodo</div><button className="ibtn" onClick={() => setConfirmLock(false)} aria-label="Cerrar"><X size={18} /></button></div>
            <div className="mbody">
              <div className="muted" style={{ marginTop: 0, padding: '10px 12px', background: 'var(--panel2)', borderRadius: 10, fontSize: 12 }}>
                El cierre recalcula el neto desde el desglose y congela líneas y periodo para siempre: nadie podrá editarlas después. Solo un administrador puede cerrar.
              </div>
            </div>
            <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => setConfirmLock(false)} disabled={pending}>Cancelar</button>
              <button className="btn dark" onClick={doLock} disabled={pending} aria-busy={pending}>
                {pending ? 'Cerrando…' : 'Cerrar periodo'}
              </button>
            </div></div>
          </div>
        </div>
      )}

      {desprendible && (
        <div className="mwrap" onClick={() => setDesprendible(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Desprendible de {desprendible.fullName}</div><button className="ibtn" onClick={() => setDesprendible(null)} aria-label="Cerrar"><X size={18} /></button></div>
            <div className="mbody">
              <p className="muted" style={{ margin: 0 }}>{desprendible.department ?? 'Sin área'}{desprendible.taxId ? ` · CC ${desprendible.taxId}` : ''} · {current ? MONTH_LONG.format(asDate(current.period)) : '—'}</p>
              {desprendible.lines.length === 0 ? (
                <div className="dempty">Sin líneas de desglose.</div>
              ) : (
                <div style={{ marginTop: 10 }}>
                  {desprendible.lines.map((l) => (
                    <div className="elrow" key={l.id}>
                      <div style={{ flex: 1 }}><span className="eltxt">{l.name}</span></div>
                      <span className="elsub">{l.kind === 'Devengo' ? 'Devengo' : 'Deducción'}</span>
                      <span className="eltxt" style={{ marginLeft: 12 }}>{l.kind === 'Devengo' ? '+' : '−'}{cop(l.amountCents / 100)}</span>
                    </div>
                  ))}
                  <div className="elrow" style={{ borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 8 }}>
                    <div style={{ flex: 1 }}><span className="eltxt">Neto a pagar</span></div>
                    <span className="eltxt" style={{ fontWeight: 700 }}>{cop(desprendible.netCents / 100)}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="mfoot"><span />
              <div style={{ display: 'flex', gap: 9 }}>
                <button className="btn" onClick={() => setDesprendible(null)}>Cerrar</button>
                <button className="btn dark" onClick={() => printDesprendible(desprendible)}><Printer size={14} />Imprimir</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function FragmentRow({ e, dev, ded, concepts, locked, pending, addLine, setAddLine, onAddLine, onCommit, onRemoveLine, onPrint }: {
  e: EmployeeLineRow
  dev: number
  ded: number
  concepts: ConceptRow[]
  locked: boolean
  pending: boolean
  addLine: { employeeId: string; conceptId: string; amount: string } | null
  setAddLine: (v: { employeeId: string; conceptId: string; amount: string } | null) => void
  onAddLine: () => void
  onCommit: (lineId: string, amountCents: number) => void
  onRemoveLine: (lineId: string, name: string) => void
  onPrint: () => void
}) {
  const adding = addLine?.employeeId === e.employeeId
  const [amount, setAmount] = useState('')
  return (
    <>
      <tr className="trow" style={{ background: 'var(--panel2)' }}>
        <td className="cename">{e.fullName}<div className="muted" style={{ fontWeight: 400 }}>{e.department ?? 'Sin área'}{e.taxId ? ` · ${e.taxId}` : ''}</div></td>
        <td colSpan={2} className="muted">{dev > 0 || ded > 0 ? `${cop(dev / 100)} devengos · ${cop(ded / 100)} deducciones` : 'Sin líneas'}</td>
        <td className="cename" style={{ textAlign: 'right' }}>{cop(e.netCents / 100)}</td>
        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
          <button className="ibtn" style={{ width: 26, height: 26 }} onClick={onPrint} aria-label={`Desprendible de ${e.fullName}`}><Printer size={13} /></button>
        </td>
      </tr>
      {e.lines.map((l) => (
        <tr key={l.id}>
          <td />
          <td className="cename">{l.name}</td>
          <td className="muted" style={l.kind === 'Devengo' ? { color: '#0a7a3d' } : { color: '#a02424' }}>{l.kind}</td>
          <td style={{ textAlign: 'right' }}>
            <LineAmount line={l} locked={locked || pending} onSave={onCommit} />
          </td>
          <td style={{ textAlign: 'right' }}>
            {!locked && (
              <button className="ibtn" style={{ width: 26, height: 26 }} disabled={pending} onClick={() => onRemoveLine(l.id, l.name)} aria-label={`Eliminar ${l.name}`}><X size={13} /></button>
            )}
          </td>
        </tr>
      ))}
      {!locked && (
        <tr>
          <td />
          <td colSpan={4}>
            {adding ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0' }}>
                <Select
                  value={addLine?.conceptId ?? ''}
                  onChange={(v) => setAddLine({ employeeId: e.employeeId, conceptId: v, amount: addLine?.amount ?? '' })}
                  options={concepts.length > 0 ? concepts.map((c) => ({ value: c.id, label: `${c.name} (${c.kind})` })) : [{ value: '', label: 'Sin conceptos' }]}
                />
                <input className="field" type="number" min={0} step={100} placeholder="Valor (COP)" value={amount} onChange={(ev) => { setAmount(ev.target.value); setAddLine({ employeeId: e.employeeId, conceptId: addLine?.conceptId ?? '', amount: ev.target.value }) }} style={{ width: 140 }} />
                <button className="btn ghost" onClick={onAddLine} disabled={pending} aria-label="Añadir línea"><Plus size={13} />Añadir</button>
                <button className="ibtn" style={{ width: 26, height: 26 }} onClick={() => { setAddLine(null); setAmount('') }} aria-label="Cancelar"><X size={13} /></button>
              </div>
            ) : (
              <button className="btn ghost" onClick={() => { setAddLine({ employeeId: e.employeeId, conceptId: concepts[0]?.id ?? '', amount: '' }); setAmount('') }} disabled={pending}>
                <Plus size={13} />Añadir concepto
              </button>
            )}
          </td>
        </tr>
      )}
    </>
  )
}