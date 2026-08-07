'use client'

import { useState } from 'react'
import { ShieldAlert, Clock, Info, Check, AlertCircle, Plus, Trash2, X, Zap } from '@/lib/icons'
import type { IconProps } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import TabBar from '@/components/ui/TabBar'
import { useApp } from '@/lib/context/AppContext'

/* ------------------------------------------------------------------ */
/*  Page-local data (matches original nucleo-rh.jsx shapes verbatim)   */
/* ------------------------------------------------------------------ */
interface Riesgo {
  id: string
  tipo: string
  empleado: string | null
  area: string
  sev: string
  detalle: string
  accion: string
}

const RIESGOS_SEED: Riesgo[] = [
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

/* ------------------------------------------------------------------ */
/*  Page-local Stat (replicate original ico/tone gradient primitive)   */
/* ------------------------------------------------------------------ */
function Stat({ ico: Ico, tone = 'ink', label, value, sub }: {
  ico: (p: IconProps) => React.ReactElement
  tone?: string
  label: string
  value: string | number
  sub?: string
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

const SEV_ICO: Record<string, (p: IconProps) => React.ReactElement> = { Alta: AlertCircle, Media: Clock, Baja: Info }

export default function RiesgosPage() {
  const { addToast } = useApp()
  const [riesgos, setRiesgos] = useState<Riesgo[]>(RIESGOS_SEED)
  const [sevFilter, setSevFilter] = useState('Todos')
  const [tipoFilter, setTipoFilter] = useState('Todos')
  const [addOpen, setAddOpen] = useState(false)
  const [rTipo, setRTipo] = useState('Contractual')
  const [rSev, setRSev] = useState('Media')
  const [rArea, setRArea] = useState('General')
  const [rDetalle, setRDetalle] = useState('')
  const [rAccion, setRAccion] = useState('')

  const altas = riesgos.filter((r) => r.sev === 'Alta').length
  const medias = riesgos.filter((r) => r.sev === 'Media').length
  const bajas = riesgos.filter((r) => r.sev === 'Baja').length
  const gestionados = RIESGOS_SEED.length - riesgos.length
  const tipos = ['Todos', ...new Set(riesgos.map((r) => r.tipo))]
  const filtered = riesgos.filter((r) =>
    (sevFilter === 'Todos' || r.sev === sevFilter) &&
    (tipoFilter === 'Todos' || r.tipo === tipoFilter)
  )

  const resolver = (id: string) => {
    const r = riesgos.find((x) => x.id === id)!
    setRiesgos((rs) => rs.filter((x) => x.id !== id))
    addToast(`Riesgo "${r.tipo}" gestionado`, 'ok', 'Deshacer', () => setRiesgos((rs) => [r, ...rs]))
  }

  const addRiesgo = () => {
    if (!rDetalle.trim()) return
    const id = `R-${(riesgos.length + 10).toString().padStart(2, '0')}`
    setRiesgos((rs) => [{ id, tipo: rTipo, sev: rSev, area: rArea, detalle: rDetalle, accion: rAccion || 'Revisar con el equipo responsable', empleado: null }, ...rs])
    addToast('Riesgo registrado', 'ok')
    setAddOpen(false)
    setRDetalle(''); setRAccion('')
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat ico={ShieldAlert} tone="red" label="Riesgos críticos" value={altas} sub="Alta prioridad" /></div>
        <div className="rise d2"><Stat ico={Clock} tone="amb" label="Riesgos medios" value={medias} sub="Atención pronto" /></div>
        <div className="rise d3"><Stat ico={Info} tone="neu" label="Riesgos bajos" value={bajas} sub="Monitorear" /></div>
        <div className="rise d4"><Stat ico={Check} tone="grn" label="Gestionados" value={gestionados} sub="este ciclo" /></div>
      </div>
      <div className="card rise d2">
        <div className="chead" style={{ flexWrap: 'wrap', gap: 10 }}>
          <TabBar
            value={sevFilter}
            onChange={setSevFilter}
            items={['Todos', 'Alta', 'Media', 'Baja'].map((s) => ({
              key: s,
              label: s === 'Todos' ? `Todos · ${riesgos.length}` : `${s} · ${riesgos.filter((r) => r.sev === s).length}`,
            }))}
          />
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <Select value={tipoFilter} onChange={setTipoFilter} options={tipos} style={{ width: 190 }} />
            <button className="btn pri" onClick={() => setAddOpen(true)}><Plus size={14} />Nuevo riesgo</button>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="dempty" style={{ padding: '48px 0', textAlign: 'center' }}>
            <Check size={22} style={{ color: 'var(--grn)', margin: '0 auto 8px', display: 'block' }} />
            No hay riesgos en esta categoría.
          </div>
        ) : (
          <div className="riskgrid">
            {filtered.map((r) => {
              const SevIco = SEV_ICO[r.sev] || Info
              return (
                <div className={`riskcard sev-${r.sev.toLowerCase()}`} key={r.id}>
                  <div className="riskhead">
                    <Badge st={r.sev} />
                    <span className="tag">{r.tipo}</span>
                    <button className="ibtn" style={{ width: 26, height: 26, marginLeft: 'auto' }} data-tip="Eliminar" onClick={() => resolver(r.id)}><Trash2 size={13} /></button>
                  </div>
                  {r.empleado && <div className="riskname">{r.empleado}</div>}
                  <div className="riskarea"><SevIco size={13} />{r.area}</div>
                  <div className="riskdetail">{r.detalle}</div>
                  <div className="riskfooter">
                    <div className="riskaction"><Zap size={13} style={{ flexShrink: 0 }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.accion}</span></div>
                    <button className="btn ghost" style={{ fontSize: 11, height: 28, padding: '0 10px', flexShrink: 0 }} onClick={() => resolver(r.id)}>
                      Gestionar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {addOpen && (
        <div className="mwrap" onClick={() => setAddOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Nuevo riesgo</div><button className="ibtn" onClick={() => setAddOpen(false)}><X size={18} /></button></div>
            <div className="mbody">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div className="flabel" style={{ marginTop: 0 }}>Tipo</div>
                  <Select value={rTipo} onChange={setRTipo} options={['Contractual', 'Operacional', 'Cumplimiento', 'Financiero', 'Técnico', 'HSE', 'Otro']} />
                </div>
                <div>
                  <div className="flabel" style={{ marginTop: 0 }}>Severidad</div>
                  <Select value={rSev} onChange={setRSev} options={['Alta', 'Media', 'Baja']} />
                </div>
              </div>
              <div className="flabel">Área afectada</div>
              <input className="field" value={rArea} onChange={(e) => setRArea(e.target.value)} placeholder="Ej. Interventoría, Energía, Obras" />
              <div className="flabel">Descripción del riesgo</div>
              <textarea className="field" rows={3} style={{ resize: 'none' }} value={rDetalle} onChange={(e) => setRDetalle(e.target.value)} placeholder="Describe el riesgo identificado…" />
              <div className="flabel">Acción recomendada</div>
              <input className="field" value={rAccion} onChange={(e) => setRAccion(e.target.value)} placeholder="Ej. Revisar contrato con asesor legal" />
            </div>
            <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => setAddOpen(false)}>Cancelar</button>
              <button className="btn dark" onClick={addRiesgo}>Registrar riesgo</button>
            </div></div>
          </div>
        </div>
      )}
    </>
  )
}
