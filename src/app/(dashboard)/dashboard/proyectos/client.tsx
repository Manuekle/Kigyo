'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, FileSpreadsheet, Clock, Check, Plus, X, Users, ChevronRight, MapPin, Zap, UserPlus } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import Select from '@/components/ui/Select'
import DatePicker from '@/components/ui/DatePicker'
import FormDrawer from '@/components/ui/FormDrawer'
import { useApp } from '@/lib/context/AppContext'
import { useConfirm } from '@/lib/context/ConfirmContext'
import { useExport } from '@/lib/hooks/use-export'
import { activatable } from '@/lib/a11y'
import { cop } from '@/lib/utils'
import LoadMore from '@/components/ui/LoadMore'
import Drawer from '@/components/ui/Drawer'
import type { ProyectosData, ProyectoRow } from '@/server/queries/proyectos'
import { fetchMoreProyectos } from '@/server/actions/proyectos'
import { PROJECT_KINDS, PROJECT_STATUSES } from '@/lib/domain'
import {
  addProyectoMember,
  createProyecto,
  deleteProyecto,
  removeProyectoMember,
  updateProyecto,
} from '@/server/mutations/proyectos'

const DAY = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtDate = (iso: string | null) => (iso ? DAY.format(new Date(`${iso}T00:00:00`)) : '—')

const EMPTY_FORM = {
  name: '', client: '', location: '', kind: 'Instalación' as (typeof PROJECT_KINDS)[number],
  capacity: '', budget: '', startsOn: '', endsOn: '',
}

export default function ProyectosPage({ data }: { data: ProyectosData }) {
  const { addToast } = useApp()
  const confirm = useConfirm()
  const { runExport, exporting } = useExport()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  // Server state. This list used to be seven fixture projects in `useState`;
  // creating one appended to the array and reloading dropped it.
  const [proyectos, setProyectos] = useState<ProyectoRow[]>(data.proyectos)
  const [total, setTotal] = useState(data.proyectosTotal)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')
  const [filtro, setFiltro] = useState('Todos')
  const [addOpen, setAddOpen] = useState(false)
  const [selProy, setSelProy] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState(EMPTY_FORM)
  const [addMember, setAddMember] = useState('')

  const stats = useMemo(() => ({
    activos: proyectos.filter((p) => p.status === 'En ejecución').length,
    completados: proyectos.filter((p) => p.status === 'Finalizado').length,
    planificacion: proyectos.filter((p) => p.status === 'Planificación').length,
    // Cents, summed as cents and formatted once. Summing pesos parsed out of a
    // text input is how the old total drifted by rounding.
    presupuesto: proyectos.reduce((s, p) => s + p.budgetCents, 0),
  }), [proyectos])

  const filtered = proyectos.filter((p) => filtro === 'Todos' || p.status === filtro)
  const sel = proyectos.find((p) => p.id === selProy) ?? null

  const exportRows = () => {
    void runExport(
      filtered.map((p) => ({
        Código: p.code ?? '',
        Nombre: p.name,
        Cliente: p.client,
        Estado: p.status,
        Inicio: p.startsOn ?? '',
        Fin: p.endsOn ?? '',
      })),
      'proyectos-kigyo',
      'proyectos',
    )
  }

  /** Every mutation returns the fresh list, so nothing is patched locally. */
  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreProyectos(proyectos.length)
      if (!result.ok) {
        setLoadMoreError(result.error)
        return
      }
      setProyectos((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        return [...prev, ...result.data.rows.filter((p) => !seen.has(p.id))]
      })
      setTotal(result.data.total)
    })
  }

  function apply(next: ProyectosData, message: string) {
    setProyectos(next.proyectos)
    setTotal(next.proyectosTotal)
    addToast(message, 'ok')
    router.refresh()
  }

  function submitNew() {
    const name = nuevo.name.trim()
    if (!name) { addToast('El nombre del proyecto es obligatorio', 'err'); return }

    // Pesos in the field, cents in the column. Parsed and rounded here so the
    // bigint never receives a fraction.
    const budgetCents = Math.round((Number(nuevo.budget) || 0) * 100)
    const capacityKwp = nuevo.capacity.trim() ? Number(nuevo.capacity) : null
    if (capacityKwp !== null && Number.isNaN(capacityKwp)) {
      addToast('La capacidad debe ser un número en kWp', 'err')
      return
    }

    startTransition(async () => {
      const result = await createProyecto({
        name,
        client: nuevo.client.trim(),
        location: nuevo.location.trim(),
        kind: nuevo.kind,
        capacityKwp,
        status: 'Planificación',
        progress: 0,
        budgetCents,
        startsOn: nuevo.startsOn || null,
        endsOn: nuevo.endsOn || null,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setAddOpen(false)
      setNuevo(EMPTY_FORM)
      apply(result.data, `Proyecto "${name}" creado`)
    })
  }

  function setStatus(p: ProyectoRow, status: string) {
    startTransition(async () => {
      const result = await updateProyecto({
        id: p.id,
        name: p.name,
        client: p.client,
        location: p.location,
        kind: p.kind as (typeof PROJECT_KINDS)[number],
        capacityKwp: p.capacityKwp,
        status: status as (typeof PROJECT_STATUSES)[number],
        // Finishing a project takes the bar with it; the server rejects the
        // pair otherwise and the toast would be the only thing that moved.
        progress: status === 'Finalizado' ? 100 : p.progress,
        budgetCents: p.budgetCents,
        startsOn: p.startsOn,
        endsOn: p.endsOn,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data, `Estado actualizado a ${status}`)
    })
  }

  function setProgress(p: ProyectoRow, progress: number) {
    startTransition(async () => {
      const result = await updateProyecto({
        id: p.id,
        name: p.name,
        client: p.client,
        location: p.location,
        kind: p.kind as (typeof PROJECT_KINDS)[number],
        capacityKwp: p.capacityKwp,
        status: (progress === 100 && p.status === 'En ejecución'
          ? 'Finalizado'
          : p.status) as (typeof PROJECT_STATUSES)[number],
        progress,
        budgetCents: p.budgetCents,
        startsOn: p.startsOn,
        endsOn: p.endsOn,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setProyectos(result.data.proyectos)
      setTotal(result.data.proyectosTotal)
      router.refresh()
    })
  }

  async function archive(p: ProyectoRow) {
    if (!(await confirm({ title: `¿Archivar "${p.name}"?`, description: 'Dejará de aparecer en los listados y en los canales.' }))) return
    startTransition(async () => {
      const result = await deleteProyecto(p.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setSelProy(null)
      apply(result.data, `Proyecto "${p.name}" archivado`)
    })
  }

  function assign(employeeId: string) {
    if (!sel || !employeeId) return
    startTransition(async () => {
      const result = await addProyectoMember({ projectId: sel.id, employeeId, role: '' })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setAddMember('')
      apply(result.data, 'Persona asignada al proyecto')
    })
  }

  function unassign(employeeId: string, fullName: string) {
    if (!sel) return
    startTransition(async () => {
      const result = await removeProyectoMember({ projectId: sel.id, employeeId, role: '' })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data, `${fullName} ya no está en el proyecto`)
    })
  }

  const assignable = sel
    ? data.roster.filter((r) => !sel.team.some((m) => m.employeeId === r.employeeId))
    : []

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat icon={<BarChart3 size={16} />} tone="blu" label="Proyectos activos" value={stats.activos} sub="en ejecución" /></div>
        <div className="rise d2"><Stat icon={<Check size={16} />} tone="grn" label="Finalizados" value={stats.completados} sub="históricos" /></div>
        <div className="rise d3"><Stat icon={<Clock size={16} />} tone="amb" label="En planificación" value={stats.planificacion} sub="próximos" /></div>
        <div className="rise d4"><Stat icon={<Zap size={16} />} tone="vio" label="Presupuesto total" value={cop(stats.presupuesto / 100)} sub="todos los proyectos" /></div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <TabBar
            value={filtro}
            onChange={setFiltro}
            items={['Todos', ...PROJECT_STATUSES].map((s) => ({
              key: s,
              label: `${s}${s !== 'Todos' ? ` · ${proyectos.filter((p) => p.status === s).length}` : ''}`,
            }))}
          />
          <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportRows}><FileSpreadsheet size={15} />Exportar</button>
          {data.canWrite && (
            <button className="btn pri" onClick={() => setAddOpen(true)}><Plus size={15} />Nuevo proyecto</button>
          )}
        </div>
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th scope="col">Proyecto</th><th scope="col">Ubicación</th><th scope="col">Capacidad</th><th scope="col">Avance</th><th scope="col">Estado</th><th scope="col"></th></tr></thead>
            <tbody>
              {proyectos.length === 0 ? (
                <tr><td colSpan={6}><div className="dempty dempty-block">
                  {data.canWrite ? 'Todavía no hay proyectos. Crea el primero.' : 'Todavía no hay proyectos.'}
                </div></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6}><div className="dempty dempty-block">No hay proyectos en esta categoría.</div></td></tr>
              ) : filtered.map((p) => (
                <tr className="trow" key={p.id} style={{ cursor: 'pointer' }} {...activatable(() => setSelProy(p.id), `Abrir proyecto ${p.name}`)}>
                  <td>
                    <div className="cename">{p.name}</div>
                    <div className="ceid mono">{p.code ?? '—'}{p.client ? ` · ${p.client}` : ''}</div>
                  </td>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={13} style={{ flexShrink: 0 }} /><span className="muted">{p.location || '—'}</span></div></td>
                  <td className="muted">{p.capacityKwp !== null ? `${p.capacityKwp} kWp` : '—'}</td>
                  <td style={{ minWidth: 130 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="bartrack" style={{ flex: 1 }}><div className="barfill" style={{ width: `${p.progress}%` }} /></div>
                      <span className="elsub" style={{ fontWeight: 400, flexShrink: 0, minWidth: 32, textAlign: 'right' }}>{p.progress}%</span>
                    </div>
                  </td>
                  <td><Badge st={p.status} filled /></td>
                  <td style={{ textAlign: 'right' }}><ChevronRight size={16} color="var(--ink3)" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <LoadMore
          loaded={proyectos.length}
          total={total}
          loading={loadingMore}
          error={loadMoreError}
          onLoadMore={loadMore}
          noun="proyectos"
        />
      </div>

      {/* Drawer detalle */}
      <Drawer value={sel} onClose={() => setSelProy(null)}>
        {(proy) => (
          <>
            <div className="dhead tkhead">
              <div className="dmark" style={{ background: 'linear-gradient(145deg,#7aa2ff,#3b82f6)', boxShadow: '0 8px 18px -8px #3b82f699' }}>
                <BarChart3 size={19} color="#fff" />
              </div>
              <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                <div className="dh-t">{proy.name}</div>
                <div className="dh-s mono">{proy.code ?? '—'}</div>
              </div>
              <button className="ibtn" onClick={() => setSelProy(null)} style={{ position: 'relative', zIndex: 1 }} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div className="dbody">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {data.canWrite ? (
                  <Select
                    value={proy.status}
                    onChange={(v) => setStatus(proy, v)}
                    options={[...PROJECT_STATUSES]}
                  />
                ) : (
                  <Badge st={proy.status} filled />
                )}
              </div>

              <div className="dsect">Información general</div>
              <div className="elrow"><div className="eltxt">Cliente</div><div className="elsub">{proy.client || '—'}</div></div>
              <div className="elrow"><div className="eltxt">Ubicación</div><div className="elsub" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={13} />{proy.location || '—'}</div></div>
              <div className="elrow"><div className="eltxt">Tipo</div><div className="elsub">{proy.kind}</div></div>
              <div className="elrow"><div className="eltxt">Capacidad</div><div className="elsub">{proy.capacityKwp !== null ? `${proy.capacityKwp} kWp` : '—'}</div></div>

              <div className="dsect">Cronograma</div>
              <div className="elrow"><div className="eltxt">Inicio</div><div className="elsub">{fmtDate(proy.startsOn)}</div></div>
              <div className="elrow"><div className="eltxt">Fin previsto</div><div className="elsub">{fmtDate(proy.endsOn)}</div></div>

              <div className="dsect">Avance</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="bartrack" style={{ height: 12, borderRadius: 8, flex: 1 }}>
                  <div className="barfill" style={{ width: `${proy.progress}%`, height: 12, borderRadius: 8 }} />
                </div>
                <span style={{ fontWeight: 400, fontSize: 20, flexShrink: 0 }}>{proy.progress}%</span>
              </div>
              {data.canWrite && (
                <input
                  type="range"
                  className="simrange"
                  min={0}
                  max={100}
                  step={5}
                  value={proy.progress}
                  disabled={pending}
                  aria-label={`Avance de ${proy.name}`}
                  onChange={(e) => setProgress(proy, Number(e.target.value))}
                  style={{ marginTop: 10 }}
                />
              )}

              <div className="dsect">Presupuesto</div>
              <div className="elrow"><div className="eltxt">Asignado</div><div className="eltxt">{cop(proy.budgetCents / 100)}</div></div>

              <div className="dsect">Equipo asignado</div>
              {proy.team.length === 0 ? (
                <div className="dempty" style={{ padding: '12px 0' }}>Sin equipo asignado</div>
              ) : proy.team.map((m) => (
                <div className="elrow" key={m.employeeId}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <Users size={14} />
                    <div className="eltxt">{m.fullName}</div>
                  </div>
                  {data.canWrite && (
                    <button
                      className="ibtn"
                      style={{ width: 26, height: 26 }}
                      disabled={pending}
                      onClick={() => unassign(m.employeeId, m.fullName)}
                      aria-label={`Quitar a ${m.fullName} del proyecto`}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}

              {/* Assigning needs the directory. Without `empleados:read` the
                  roster arrives empty and there is nobody to offer. */}
              {data.canWrite && assignable.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Select
                    value={addMember}
                    onChange={(v) => { setAddMember(v); assign(v) }}
                    placeholder="Asignar a alguien"
                    options={[
                      { value: '', label: 'Asignar a alguien' },
                      ...assignable.map((r) => ({ value: r.employeeId, label: r.fullName })),
                    ]}
                  />
                  <UserPlus size={14} style={{ color: 'var(--ink3)', flexShrink: 0 }} aria-hidden="true" />
                </div>
              )}
            </div>
            {data.canWrite && (
              <div className="dacts">
                {/* The "Informe" button used to toast "Descargando informe…"
                    and download nothing — there is no report generator behind
                    it. Gone rather than left lying. */}
                <button
                  className="btn"
                  style={{ flex: 1, justifyContent: 'center', color: 'var(--redd)' }}
                  disabled={pending}
                  onClick={() => archive(proy)}
                >
                  <X size={15} />Archivar proyecto
                </button>
              </div>
            )}
          </>
        )}
      </Drawer>

      {/* Seven fields plus a chip row — long enough that the dialog scrolled
          and the Crear button sat under the fold. */}
      <FormDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Nuevo proyecto"
        footer={
          <>
            <span />
            <div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => setAddOpen(false)} disabled={pending}>Cancelar</button>
              <button className="btn dark" onClick={submitNew} disabled={pending} aria-busy={pending}>
                {pending ? 'Creando…' : 'Crear proyecto'}
              </button>
            </div>
          </>
        }
      >
              <div className="flabel" style={{ marginTop: 0 }}>Nombre del proyecto</div>
              <input className="field" placeholder="Ej. Parque Solar Bosa Fase II" value={nuevo.name} onChange={(e) => setNuevo((n) => ({ ...n, name: e.target.value }))} />
              <div className="flabel">Ubicación</div>
              <input className="field" placeholder="Ej. Bosa, Bogotá" value={nuevo.location} onChange={(e) => setNuevo((n) => ({ ...n, location: e.target.value }))} />
              <div className="flabel">Cliente</div>
              <input className="field" placeholder="Ej. Empresa de Energía" value={nuevo.client} onChange={(e) => setNuevo((n) => ({ ...n, client: e.target.value }))} />
              <div className="flabel">Tipo</div>
              <div className="chips">
                {PROJECT_KINDS.map((t) => (
                  <button key={t} className={`chip ${nuevo.kind === t ? 'on' : ''}`} onClick={() => setNuevo((n) => ({ ...n, kind: t }))}>{t}</button>
                ))}
              </div>
              <div className="fg2">
                <div>
                  <div className="flabel">Capacidad (kWp)</div>
                  <input className="field" type="number" min={0} step="0.01" placeholder="150" value={nuevo.capacity} onChange={(e) => setNuevo((n) => ({ ...n, capacity: e.target.value }))} />
                </div>
                <div>
                  <div className="flabel">Presupuesto (COP)</div>
                  <input className="field" type="number" min={0} placeholder="0" value={nuevo.budget} onChange={(e) => setNuevo((n) => ({ ...n, budget: e.target.value }))} />
                </div>
              </div>
              <div className="fg2">
                <div>
                  <div className="flabel">Inicio</div>
                  <DatePicker ariaLabel="Inicio" value={nuevo.startsOn} onChange={(v) => setNuevo((n) => ({ ...n, startsOn: v }))} />
                </div>
                <div>
                  <div className="flabel">Fin previsto</div>
                  <DatePicker ariaLabel="Fin previsto" min={nuevo.startsOn} value={nuevo.endsOn} onChange={(v) => setNuevo((n) => ({ ...n, endsOn: v }))} />
                </div>
              </div>
      </FormDrawer>
    </>
  )
}
