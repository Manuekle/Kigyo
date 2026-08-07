'use client'

import { useMemo, useState } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  Check,
  Calendar,
  Plus,
  Users,
  ChevronRight,
  Send,
} from '@/lib/icons'
import Stat from '@/components/ui/Stat'
import Badge from '@/components/ui/Badge'
import TabBar from '@/components/ui/TabBar'
import Select from '@/components/ui/Select'
import { useApp } from '@/lib/context/AppContext'

/* ------------------------------------------------------------------ */
interface ChecklistItem {
  label: string
  done: boolean
}

interface UpdateEntry {
  who: string
  when: string
  note: string
}

interface HseqReport {
  id: string
  categoria: 'Seguridad' | 'Calidad' | 'Ambiente'
  tipo: 'Incidente' | 'Permiso'
  status: 'Pendiente' | 'En curso' | 'Cerrado'
  prioridad: 'Alta' | 'Media' | 'Baja'
  area: string
  proyecto: string
  ubicacion: string
  monto: string
  responsable: string
  fecha: string
  vencimiento: string
  severity: 'Crítica' | 'Alta' | 'Media' | 'Baja'
  checklist: ChecklistItem[]
  updates: UpdateEntry[]
  notas: string
  proyectoId: string
  overdue: boolean
}

const REPORTS_SEED: HseqReport[] = [
  {
    id: 'HSEQ-041',
    categoria: 'Seguridad',
    tipo: 'Permiso',
    status: 'Pendiente',
    prioridad: 'Alta',
    area: 'Proyectos',
    proyecto: 'P-001 · Instalación Torre Sur',
    ubicacion: 'Av. Siempre Viva 123',
    monto: '$4,200',
    responsable: 'Carlos Ríos',
    fecha: '18 jun 2026',
    vencimiento: '21 jun 2026',
    severity: 'Alta',
    checklist: [
      { label: 'Permiso trabajo en alturas', done: false },
      { label: 'Checklist eléctrico', done: true },
      { label: 'Autorización de cliente', done: false },
    ],
    updates: [
      { who: 'Patricia A.', when: '09:15', note: 'Se detectó falta de permiso de alturas.' },
      { who: 'Carlos R.', when: '09:44', note: 'Coordinó unidad HSEQ para generar permiso.' },
    ],
    notas: 'Necesita firma de clientes y verificación de arnés antes de la orden de montaje.',
    proyectoId: 'P-001',
    overdue: false,
  },
  {
    id: 'HSEQ-039',
    categoria: 'Calidad',
    tipo: 'Incidente',
    status: 'En curso',
    prioridad: 'Media',
    area: 'Montajes',
    proyecto: 'P-003 · Planta Industrias XYZ',
    ubicacion: 'Km 5 Vía al Mar',
    monto: '$3,500',
    responsable: 'Valentina Ruiz',
    fecha: '17 jun 2026',
    vencimiento: '24 jun 2026',
    severity: 'Media',
    checklist: [
      { label: 'Informe inicial', done: true },
      { label: 'Fotografías del daño', done: true },
      { label: 'Plan de acción correctiva', done: false },
    ],
    updates: [
      { who: 'Juan P.', when: '08:20', note: 'Se registró pérdida del aislante en el módulo 4.' },
      { who: 'Valentina R.', when: '11:02', note: 'Plan de acción en elaboración; pendiente aprobación del cliente.' },
    ],
    notas: 'Entregar informe final al cliente y a supervisión de calidad antes del viernes.',
    proyectoId: 'P-003',
    overdue: false,
  },
  {
    id: 'HSEQ-032',
    categoria: 'Ambiente',
    tipo: 'Permiso',
    status: 'Cerrado',
    prioridad: 'Baja',
    area: 'Logística',
    proyecto: 'P-002 · Comercial Centro',
    ubicacion: 'Cra 45 #67-89',
    monto: '$12,800',
    responsable: 'Ana Torres',
    fecha: '10 jun 2026',
    vencimiento: '10 jun 2026',
    severity: 'Baja',
    checklist: [
      { label: 'Plan de manejo ambiental', done: true },
      { label: 'Monitoreo de emisiones', done: true },
      { label: 'Puntos de mitigación', done: true },
    ],
    updates: [
      { who: 'Ana T.', when: '08:02', note: 'Permiso aprobado y compartido con contratistas.' },
      { who: 'Auditor HSEQ', when: '12:40', note: 'Se registró cierre sin hallazgos.' },
    ],
    notas: 'Requiere renovación en 6 meses. Archivo en carpeta HSEQ > Permisos.',
    proyectoId: 'P-002',
    overdue: false,
  },
  {
    id: 'HSEQ-028',
    categoria: 'Seguridad',
    tipo: 'Incidente',
    status: 'Pendiente',
    prioridad: 'Alta',
    area: 'Inventario',
    proyecto: 'P-004 · Bodega Central',
    ubicacion: 'Zona Franca',
    monto: '$18,000',
    responsable: 'Daniel Ospina',
    fecha: '04 jun 2026',
    vencimiento: '12 jun 2026',
    severity: 'Crítica',
    checklist: [
      { label: 'Video del incidente', done: true },
      { label: 'Acta de investigación', done: false },
      { label: 'Plan de capacitación', done: false },
    ],
    updates: [
      { who: 'Daniel O.', when: '10:10', note: 'Caída de pallet durante recepción de paneles.' },
      { who: 'HSEQ', when: '10:42', note: 'Se abrió investigación formal y se aisló la zona.' },
    ],
    notas: 'Pendiente Comité HSEQ para firmar el plan preventivo.',
    proyectoId: 'P-004',
    overdue: true,
  },
]

const STATUS_TABS = ['Todos', 'Pendiente', 'En curso', 'Cerrado']
const CATEGORIES = ['Seguridad', 'Calidad', 'Ambiente']
const PRIORITY_TONE: Record<string, 'red' | 'amb' | 'grn'> = { Alta: 'red', Media: 'amb', Baja: 'grn' }
const STATUS_TONE: Record<string, 'amb' | 'vio' | 'grn'> = { Pendiente: 'amb', 'En curso': 'vio', Cerrado: 'grn' }

const CHECK_TPL: ChecklistItem[] = [
  { label: 'Permiso trabajo en alturas', done: false },
  { label: 'Revisión eléctrica', done: false },
  { label: 'Ficha ambiental', done: false },
]

/* ------------------------------------------------------------------ */

export default function HseqPage() {
  const { addToast } = useApp()
  const [reports, setReports] = useState(REPORTS_SEED)
  const [filter, setFilter] = useState<typeof STATUS_TABS[number]>('Todos')
  const [selectedId, setSelectedId] = useState<string>(REPORTS_SEED[0].id)
  const [form, setForm] = useState({
    tipo: 'Incidente',
    categoria: 'Seguridad',
    area: 'Operaciones',
    proyecto: 'P-005 · Nuevo parque',
    ubicacion: 'Cra 99 #12-20',
    monto: '$8,500',
    responsable: 'Sara López',
    fecha: '20 jun 2026',
    vencimiento: '25 jun 2026',
    prioridad: 'Alta',
    notas: '',
  })
  const [formChecklist, setFormChecklist] = useState(CHECK_TPL)
  const filtered = reports.filter((report) => filter === 'Todos' || report.status === filter)
  const selected = reports.find((report) => report.id === selectedId) ?? filtered[0] ?? null

  const stats = useMemo(() => {
    const total = reports.length
    const pending = reports.filter((r) => r.status === 'Pendiente').length
    const overdue = reports.filter((r) => r.overdue).length
    const closed = reports.filter((r) => r.status === 'Cerrado').length
    const compliance = Math.round((closed / Math.max(1, total)) * 100)
    return { total, pending, overdue, compliance }
  }, [reports])

  const statusFlow: Record<HseqReport['status'], { next?: HseqReport['status']; action: string }> = {
    Pendiente: { next: 'En curso', action: 'Iniciar seguimiento' },
    'En curso': { next: 'Cerrado', action: 'Cerrar trámite' },
    Cerrado: { action: 'Reabrir' },
  }

  const changeStatus = (id: string, next: 'Pendiente' | 'En curso' | 'Cerrado') => {
    setReports((prev) => prev.map((report) => (report.id === id ? { ...report, status: next } : report)))
    addToast(`Trámite ${next === 'Cerrado' ? 'cerrado' : next === 'En curso' ? 'en seguimiento' : 'reabierto'}.`, next === 'Cerrado' ? 'ok' : 'info')
  }

  const toggleChecklist = (label: string) => {
    setFormChecklist((prev) => prev.map((item) => (item.label === label ? { ...item, done: !item.done } : item)))
  }

  const registerReport = () => {
    const id = `HSEQ-${Math.floor(Math.random() * 900) + 100}`
    const newReport: HseqReport = {
      id,
      categoria: form.categoria as HseqReport['categoria'],
      tipo: form.tipo as HseqReport['tipo'],
      status: 'Pendiente',
      prioridad: form.prioridad as HseqReport['prioridad'],
      area: form.area,
      proyecto: form.proyecto,
      ubicacion: form.ubicacion,
      monto: form.monto,
      responsable: form.responsable,
      fecha: form.fecha,
      vencimiento: form.vencimiento,
      severity: form.prioridad === 'Alta' ? 'Alta' : form.prioridad === 'Media' ? 'Media' : 'Baja',
      checklist: formChecklist,
      updates: [{ who: form.responsable, when: `${new Date().getHours()}:${new Date().getMinutes()}`, note: 'Trámite registrado' }],
      notas: form.notas || 'Detalle en elaboración',
      proyectoId: 'P-001',
      overdue: false,
    }
    setReports((prev) => [newReport, ...prev])
    setSelectedId(id)
    addToast('Nuevo trámite registrado', 'ok')
  }

  const checklistStatus = selected?.checklist?.filter((item) => item.done).length ?? 0

  return (
    <div>
      {/* ---- Stats ---- */}
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat icon={<ShieldCheck size={16} />} tone="blu" label="Trámites activos" value={stats.total} /></div>
        <div className="rise d2"><Stat icon={<ShieldAlert size={16} />} tone="amb" label="Pendientes" value={stats.pending} /></div>
        <div className="rise d3"><Stat icon={<Check size={16} />} tone="grn" label="Cumplimiento" value={`${stats.compliance}%`} sub="Trámites cerrados" /></div>
        <div className="rise d4"><Stat icon={<Calendar size={16} />} tone="vio" label="Permisos vencidos" value={stats.overdue} /></div>
      </div>

      {/* ---- Coordinadores ---- */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18, fontSize: 12, color: 'var(--ink3)' }}>
        <Users size={14} />
        <span>Coordinadores: Carlos Ríos · Valentina Ruiz</span>
      </div>

      {/* ---- Table ---- */}
      <div className="card rise d1" style={{ marginBottom: 18 }}>
        <div className="chead">
          <div>
            <div className="ctitle">Trámites registrados</div>
            <div className="elsub" style={{ marginTop: 2 }}>Filtra por estado para priorizar acciones.</div>
          </div>
          <TabBar
            value={filter}
            onChange={(status) => setFilter(status as typeof STATUS_TABS[number])}
            items={STATUS_TABS.map((s) => ({ key: s, label: s }))}
          />
        </div>
        <div style={{ maxHeight: 320, overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Tipo · Categoría</th>
                <th scope="col">Proyecto · Área</th>
                <th scope="col">Responsable</th>
                <th scope="col">Prioridad</th>
                <th scope="col">Estado</th>
                <th scope="col">Vence</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((report) => (
                <tr
                  key={report.id}
                  className="trow"
                  onClick={() => setSelectedId(report.id)}
                  style={report.id === selected?.id ? { background: 'var(--blus)' } : undefined}
                >
                  <td>
                    <div className="cename">{report.id}</div>
                    <div className="elsub">{report.fecha}</div>
                  </td>
                  <td>
                    <div className="cename">{report.tipo}</div>
                    <div className="elsub">{report.categoria}</div>
                  </td>
                  <td>
                    <div className="cename">{report.proyecto}</div>
                    <div className="elsub">{report.area}</div>
                  </td>
                  <td>{report.responsable}</td>
                  <td><Badge st={report.prioridad} tone={PRIORITY_TONE[report.prioridad]} /></td>
                  <td><Badge st={report.status} tone={STATUS_TONE[report.status]} /></td>
                  <td className="muted">{report.vencimiento}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Detail + Form ---- */}
      <div className="g2" style={{ marginBottom: 20 }}>
        {/* ---- Detail Panel ---- */}
        <div className="card rise d1">
          <div className="chead">
            <div className="ctitle">Detalle del trámite</div>
            {selected && (
              <div style={{ display: 'flex', gap: 8 }}>
                {selected.status !== 'Cerrado' && statusFlow[selected.status].next && (
                  <button className="btn pri" onClick={() => changeStatus(selected.id, statusFlow[selected.status].next!)}>
                    {statusFlow[selected.status].action}
                  </button>
                )}
                {selected.status === 'Cerrado' && (
                  <button className="btn" onClick={() => changeStatus(selected.id, 'Pendiente')}>Reabrir</button>
                )}
              </div>
            )}
          </div>
          <div className="cpad">
            {selected ? (
              <>
                <div className="elrow">
                  <div>
                    <div className="eltxt">ID</div>
                    <div className="elsub">{selected.id}</div>
                  </div>
                  <div>
                    <div className="eltxt">Estado</div>
                    <Badge st={selected.status} tone={STATUS_TONE[selected.status]} />
                  </div>
                  <div>
                    <div className="eltxt">Prioridad</div>
                    <Badge st={selected.prioridad} tone={PRIORITY_TONE[selected.prioridad]} />
                  </div>
                </div>

                <div className="elrow">
                  <div>
                    <div className="eltxt">Categoría</div>
                    <div className="elsub">{selected.categoria}</div>
                  </div>
                  <div>
                    <div className="eltxt">Tipo</div>
                    <div className="elsub">{selected.tipo}</div>
                  </div>
                  <div>
                    <div className="eltxt">Ubicación</div>
                    <div className="elsub">{selected.ubicacion}</div>
                  </div>
                </div>

                <div className="elrow">
                  <div>
                    <div className="eltxt">Monto relacionado</div>
                    <div className="elsub">{selected.monto}</div>
                  </div>
                  <div>
                    <div className="eltxt">Responsable</div>
                    <div className="elsub">{selected.responsable}</div>
                  </div>
                  <div>
                    <div className="eltxt">Vencimiento</div>
                    <div className="elsub">{selected.vencimiento}</div>
                  </div>
                </div>

                {/* Checklist */}
                <div style={{ marginTop: 14 }}>
                  <div className="elsub" style={{ marginBottom: 8 }}>Checklist · {checklistStatus} de {selected.checklist.length}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selected.checklist.map((item) => (
                      <span key={item.label} className={`badge${item.done ? ' filled-grn' : ' filled-amb'}`}>
                        <span className="bd" />
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Notas */}
                <div style={{ marginTop: 14 }}>
                  <div className="elsub" style={{ marginBottom: 4 }}>Notas</div>
                  <p className="psub" style={{ margin: 0 }}>{selected.notas}</p>
                </div>

                {/* Historial */}
                <div style={{ marginTop: 14 }}>
                  <div className="elsub" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink3)', marginBottom: 6 }}>Historial</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selected.updates.map((update) => (
                      <div key={`${selected.id}-${update.when}-${update.who}`} className="elrow" style={{ padding: '6px 0' }}>
                        <div>
                          <div className="eltxt">{update.note}</div>
                          <div className="elsub">{update.who} · {update.when}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Proyecto relacionado */}
                <div style={{ marginTop: 16 }}>
                  <div className="elsub" style={{ marginBottom: 6 }}>Proyecto relacionado</div>
                  <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="cename">{selected.proyecto}</div>
                      <div className="muted">{selected.ubicacion}</div>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--ink3)' }} />
                  </div>
                </div>
              </>
            ) : (
              <div className="dempty">Selecciona un trámite para ver su detalle.</div>
            )}
          </div>
        </div>

        {/* ---- Register Form ---- */}
        <div className="card rise d1">
          <div className="chead">
            <div className="ctitle">Registrar nuevo trámite</div>
            <Badge st="Nuevo" tone="amb" />
          </div>
          <div className="cpad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Datos generales */}
            <div className="elsub" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink3)' }}>Datos generales</div>

            {/* Category selector */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={form.categoria === cat ? 'btn pri' : 'btn'}
                  style={{ padding: '5px 12px', fontSize: 12 }}
                  onClick={() => setForm((prev) => ({ ...prev, categoria: cat }))}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="elsub">Tipo</label>
                <Select
                  options={[
                    { value: 'Incidente', label: 'Incidente' },
                    { value: 'Permiso', label: 'Permiso' },
                  ]}
                  value={form.tipo}
                  onChange={(v) => setForm((prev) => ({ ...prev, tipo: v }))}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="elsub">Prioridad</label>
                <Select
                  options={[
                    { value: 'Alta', label: 'Prioridad Alta' },
                    { value: 'Media', label: 'Prioridad Media' },
                    { value: 'Baja', label: 'Prioridad Baja' },
                  ]}
                  value={form.prioridad}
                  onChange={(v) => setForm((prev) => ({ ...prev, prioridad: v }))}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="elsub">Área responsable</label>
                <input className="field" value={form.area} onChange={(e) => setForm((prev) => ({ ...prev, area: e.target.value }))} placeholder="Área responsable" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="elsub">Proyecto</label>
                <input className="field" value={form.proyecto} onChange={(e) => setForm((prev) => ({ ...prev, proyecto: e.target.value }))} placeholder="Proyecto" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="elsub">Ubicación</label>
                <input className="field" value={form.ubicacion} onChange={(e) => setForm((prev) => ({ ...prev, ubicacion: e.target.value }))} placeholder="Ubicación" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="elsub">Monto relacionado</label>
                <input className="field" value={form.monto} onChange={(e) => setForm((prev) => ({ ...prev, monto: e.target.value }))} placeholder="Monto" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="elsub">Responsable</label>
                <input className="field" value={form.responsable} onChange={(e) => setForm((prev) => ({ ...prev, responsable: e.target.value }))} placeholder="Nombre" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="elsub">Fecha</label>
                <input className="field" value={form.fecha} onChange={(e) => setForm((prev) => ({ ...prev, fecha: e.target.value }))} placeholder="dd mes aaaa" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="elsub">Vencimiento</label>
                <input className="field" value={form.vencimiento} onChange={(e) => setForm((prev) => ({ ...prev, vencimiento: e.target.value }))} placeholder="dd mes aaaa" />
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className="elsub" style={{ display: 'block', marginBottom: 6 }}>Descripción</label>
              <textarea className="field" rows={3} value={form.notas} onChange={(e) => setForm((prev) => ({ ...prev, notas: e.target.value }))} placeholder="Hallazgos, acciones correctivas o información relevante" />
            </div>

            {/* Checklist del formulario */}
            <div className="elsub" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink3)' }}>Checklist</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {formChecklist.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="btn"
                  style={{
                    padding: '5px 12px',
                    fontSize: 12,
                    borderColor: item.done ? 'var(--grn)' : 'var(--line)',
                    opacity: item.done ? 1 : 0.6,
                  }}
                  onClick={() => toggleChecklist(item.label)}
                >
                  {item.done ? <Check size={14} style={{ color: 'var(--grn)' }} /> : <Send size={14} />}
                  <span style={{ marginLeft: 6, color: item.done ? 'var(--ink)' : 'var(--ink2)' }}>{item.label}</span>
                </button>
              ))}
            </div>

            {/* Submit row */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              <button className="btn dark" onClick={registerReport}><Plus size={14} />Registrar trámite</button>
              <button className="btn ghost" onClick={() => addToast('Plantilla enviada a HSEQ', 'info')}><Send size={14} />Compartir con HSEQ</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
