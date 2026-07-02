'use client'

import { useState } from 'react'
import type { ComponentType } from 'react'
import { Wallet, Users, ShieldCheck, TrendingUp, TrendingDown, FileSpreadsheet, Plus, X, Check } from '@/lib/icons'
import type { IconProps } from '@/lib/icons'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import ChartTip from '@/components/ui/ChartTip'
import { exportExcel } from '@/lib/utils'
import { useApp } from '@/lib/context/AppContext'

interface AreaItem { area: string; costo: number; personas: number }
interface BeneficioItem { nombre: string; cobertura: string; costoMes: number }

const INIT_AREAS: AreaItem[] = [
  { area: 'Ingeniería', costo: 84000000, personas: 2 },
  { area: 'Comercial', costo: 24000000, personas: 1 },
  { area: 'Finanzas', costo: 22000000, personas: 1 },
  { area: 'Recursos Humanos', costo: 36000000, personas: 2 },
  { area: 'Obras', costo: 18000000, personas: 1 },
  { area: 'Legal', costo: 15000000, personas: 1 },
]
const NOMINA_HIST = [178, 182, 184, 188, 191, 184]
const INIT_BENEFICIOS: BeneficioItem[] = [
  { nombre: 'Medicina prepagada', cobertura: '100% del equipo', costoMes: 9200000 },
  { nombre: 'Auxilio de conectividad', cobertura: '100% del equipo', costoMes: 2400000 },
  { nombre: 'Bonos de bienestar', cobertura: '82% del equipo', costoMes: 5100000 },
]

const cop = (n: number) => '$' + n.toLocaleString('es-CO')

const TONE: Record<string, [string, string]> = {
  red: ['#ff8a8d', '#e5484d'], grn: ['#3ed694', '#10b981'], amb: ['#f0bd5a', '#bf8410'],
  blu: ['#7aa2ff', '#3b82f6'], vio: ['#b298f2', '#7c5cd6'], ink: ['#a6a6b2', '#6b6b76'],
  neu: ['#a6a6b2', '#6b6b76'],
}

function Stat({ ico: Ico, tone = 'ink', label, value, sub }: { ico: ComponentType<IconProps>; tone?: string; label: string; value: string | number; sub?: string }) {
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

export default function NominaPage() {
  const { addToast } = useApp()
  const [areas, setAreas] = useState<AreaItem[]>(INIT_AREAS)
  const [beneficios, setBeneficios] = useState<BeneficioItem[]>(INIT_BENEFICIOS)
  const [editArea, setEditArea] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const [benefOpen, setBenefOpen] = useState(false)
  const [newBenef, setNewBenef] = useState({ nombre: '', cobertura: '', costoMes: '' })

  const total = areas.reduce((s, a) => s + a.costo, 0)
  const personas = areas.reduce((s, a) => s + a.personas, 0)
  const promedio = Math.round(total / personas)
  const variacion = (((NOMINA_HIST[5] - NOMINA_HIST[4]) / NOMINA_HIST[4]) * 100).toFixed(1)
  const beneficiosTotal = beneficios.reduce((s, b) => s + b.costoMes, 0)

  const exportNomina = () => {
    exportExcel(areas.map((a) => ({ 'Área': a.area, Personas: a.personas, 'Costo mensual': a.costo })), 'nomina-whitebox')
    addToast('Excel exportado', 'ok')
  }

  const updateCosto = (area: string) => {
    const v = parseInt(editVal)
    if (isNaN(v) || v < 0) return
    setAreas(as => as.map(a => a.area === area ? { ...a, costo: v } : a))
    setEditArea(null)
    addToast(`Costo de ${area} actualizado`, 'ok')
  }

  const addBeneficio = () => {
    if (!newBenef.nombre.trim()) return
    setBeneficios(bs => [...bs, { nombre: newBenef.nombre, cobertura: newBenef.cobertura || 'Pendiente', costoMes: parseInt(newBenef.costoMes) || 0 }])
    addToast('Beneficio añadido', 'ok')
    setBenefOpen(false)
    setNewBenef({ nombre: '', cobertura: '', costoMes: '' })
  }

  const deleteBeneficio = (nombre: string) => {
    const b = beneficios.find(x => x.nombre === nombre)
    setBeneficios(bs => bs.filter(x => x.nombre !== nombre))
    if (b) addToast(`"${b.nombre}" eliminado`, 'info', 'Deshacer', () => setBeneficios(bs => [b, ...bs]))
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat ico={Wallet} tone="grn" label="Costo total de nómina" value={cop(total)} sub="mensual" /></div>
        <div className="rise d2"><Stat ico={Users} tone="blu" label="Costo promedio" value={cop(promedio)} sub="por persona" /></div>
        <div className="rise d3"><Stat ico={ShieldCheck} tone="vio" label="Beneficios otorgados" value={cop(beneficiosTotal)} sub="mensual" /></div>
        <div className="rise d4"><Stat ico={Number(variacion) >= 0 ? TrendingUp : TrendingDown} tone={Number(variacion) >= 0 ? 'amb' : 'grn'} label="Variación mensual" value={`${Number(variacion) > 0 ? '+' : ''}${variacion}%`} /></div>
      </div>
      <div className="g2">
        <div className="card rise d2">
          <div className="chead"><div className="ctitle">Evolución de nómina</div><span className="range">Últimos 6 meses</span></div>
          <div className="cpad" style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={NOMINA_HIST.map((v, i) => ({ m: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'][i], v }))} margin={{ top: 14, right: 6, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="gN" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.24} />
                    <stop offset="35%" stopColor="#10b981" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--line2)" strokeDasharray="4 4" />
                <XAxis dataKey="m" tickLine={false} axisLine={false} dy={8} tick={{ fill: 'var(--ink3)', fontSize: 12, fontWeight: 600 }} />
                <YAxis tickLine={false} axisLine={false} width={48} tick={{ fill: 'var(--ink3)', fontSize: 11 }} tickFormatter={(v) => `${v} M`} />
                <Tooltip
                  content={<ChartTip valueFormatter={(v) => `${cop(v * 1_000_000)}`} labelFormatter={(l) => `${l} 2026`} />}
                  cursor={{ stroke: 'var(--line)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2.6} fill="url(#gN)"
                  dot={{ r: 4, strokeWidth: 2, fill: '#1A1A1A', stroke: '#10b981' }}
                  activeDot={{ r: 6, strokeWidth: 2.5, fill: '#1A1A1A', stroke: '#10b981' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card rise d3">
          <div className="chead">
            <div className="ctitle">Beneficios</div>
            <button className="btn ghost" onClick={() => setBenefOpen(true)}><Plus size={13} />Añadir</button>
          </div>
          <div style={{ padding: '0 16px 16px' }}>
            {beneficios.length === 0 ? (
              <div className="dempty">Sin beneficios registrados</div>
            ) : (
              beneficios.map((b) => (
                <div className="elrow" key={b.nombre}>
                  <div style={{ flex: 1 }}><div className="eltxt">{b.nombre}</div><div className="elsub">{b.cobertura}</div></div>
                  <div className="eltxt">{cop(b.costoMes)}</div>
                  <button className="ibtn" style={{ width: 26, height: 26, marginLeft: 6 }} onClick={() => deleteBeneficio(b.nombre)}><X size={13} /></button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <div className="card rise d4" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Costo por departamento</div>
          <button className="btn ghost" onClick={exportNomina}><FileSpreadsheet size={15} />Exportar</button>
        </div>
        <table className="tbl">
          <thead><tr><th>Área</th><th>Personas</th><th>Costo mensual</th><th>Costo / persona</th></tr></thead>
          <tbody>
            {areas.map((a) => (
              <tr className="trow" key={a.area}>
                <td className="cename">{a.area}</td>
                <td className="muted">{a.personas}</td>
                <td className="cename" style={{ cursor: 'pointer' }} onClick={() => { setEditArea(a.area); setEditVal(String(a.costo)) }}>
                  {editArea === a.area ? (
                    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                      <input style={{ width: 110, height: 28, padding: '0 10px', fontSize: 12, borderRadius: 'var(--r-sm)', background: 'var(--bg2)', border: '1px solid var(--line)', outline: 'none', color: 'var(--ink)', fontFamily: 'inherit' }} type="number" value={editVal} onChange={e => setEditVal(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && updateCosto(a.area)} />
                      <button className="ibtn" style={{ width: 24, height: 24 }} onClick={() => updateCosto(a.area)}><Check size={12} /></button>
                    </span>
                  ) : cop(a.costo)}
                </td>
                <td className="muted">{cop(Math.round(a.costo / a.personas))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {benefOpen && (
        <div className="mwrap" onClick={() => setBenefOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Nuevo beneficio</div><button className="ibtn" onClick={() => setBenefOpen(false)}><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Nombre del beneficio</div>
              <input className="field" placeholder="Ej. Seguro de vida" value={newBenef.nombre} onChange={e => setNewBenef(n => ({ ...n, nombre: e.target.value }))} />
              <div className="flabel">Cobertura</div>
              <input className="field" placeholder="Ej. 100% del equipo" value={newBenef.cobertura} onChange={e => setNewBenef(n => ({ ...n, cobertura: e.target.value }))} />
              <div className="flabel">Costo mensual</div>
              <input className="field" type="number" placeholder="0" value={newBenef.costoMes} onChange={e => setNewBenef(n => ({ ...n, costoMes: e.target.value }))} />
            </div>
            <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => setBenefOpen(false)}>Cancelar</button>
              <button className="btn dark" onClick={addBeneficio}>Añadir beneficio</button>
            </div></div>
          </div>
        </div>
      )}
    </>
  )
}
