'use client'

import { Fragment, useMemo, useState, useTransition } from 'react'
import { Wrench, AlertTriangle, Check, Clock, Plus, Trash2, DollarSign, PenLine, ChevronDown } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import { useConfirm } from '@/lib/context/ConfirmContext'
import {
  WORK_ORDER_KINDS, WORK_ORDER_PRIORITIES, WORK_ORDER_STATUSES,
} from '@/lib/domain'
import { cop, prioTone } from '@/lib/utils'
import type { MantenimientoData, WorkOrderRow } from '@/server/queries/mantenimiento'
import { createOrden, deleteOrden, setOrdenStatus, updateOrden, fetchWorkOrderTasks, createWorkOrderTask, toggleWorkOrderTask, deleteWorkOrderTask } from '@/server/mutations/mantenimiento'
import type { WorkOrderTask } from '@/server/mutations/mantenimiento'
import { fetchMoreOrdenes } from '@/server/actions/mantenimiento'

const DATE = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' })

function formatDate(iso: string | null): string {
  return iso ? DATE.format(new Date(`${iso}T00:00:00`)) : '—'
}

function toCents(value: string): number {
  const n = Number(value.replace(/[^\d]/g, ''))
  return Number.isFinite(n) ? Math.round(n) * 100 : 0
}

function pesos(cents: number): string {
  return cop(Math.round(cents / 100))
}

function orNull(value: string): string | null {
  return value.trim() === '' ? null : value
}

const EMPTY = {
  title: '', kind: 'Correctivo', priority: 'Media', assetId: '', assetLabel: '',
  assigneeId: '', location: '', detail: '', scheduledOn: '',
  laborCost: '', partsCost: '', recurrenceDays: '', siteId: '',
}

/** Open work is everything that has not reached a terminal state. */
function isOpen(status: string): boolean {
  return status !== 'Completada' && status !== 'Cancelada'
}

export default function MantenimientoPage({ data }: { data: MantenimientoData }) {
  const { addToast } = useApp()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()

  const [ordenes, setOrdenes] = useState<WorkOrderRow[]>(data.ordenes)
  const [total, setTotal] = useState(data.ordenesTotal)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const [statusFilter, setStatusFilter] = useState('Abiertas')
  const [kindFilter, setKindFilter] = useState('Todos')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)

  function apply(next: MantenimientoData) {
    setOrdenes(next.ordenes)
    setTotal(next.ordenesTotal)
  }

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreOrdenes(ordenes.length)
      if (!result.ok) { setLoadMoreError(result.error); return }
      setOrdenes((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        return [...prev, ...result.data.rows.filter((r) => !seen.has(r.id))]
      })
      setTotal(result.data.total)
    })
  }

  const assigneeName = useMemo(() => {
    const byId = new Map(data.roster.map((r) => [r.employeeId, r.fullName]))
    return (id: string | null) => (id ? byId.get(id) ?? '—' : 'Sin asignar')
  }, [data.roster])

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [taskLists, setTaskLists] = useState<Record<string, WorkOrderTask[] | null>>({})
  const [loadingTasks, setLoadingTasks] = useState<string | null>(null)
  const [taskDrafts, setTaskDrafts] = useState<Record<string, string>>({})
  const [taskBusy, startTaskBusy] = useTransition()

  function setTasks(orderId: string, tasks: WorkOrderTask[]) {
    setTaskLists((prev) => ({ ...prev, [orderId]: tasks }))
  }

  function expand(orderId: string) {
    setExpanded((prev) => ({ ...prev, [orderId]: !prev[orderId] }))
    if (!taskLists[orderId] && !loadingTasks) {
      setLoadingTasks(orderId)
      startTaskBusy(async () => {
        const result = await fetchWorkOrderTasks(orderId)
        setLoadingTasks(null)
        if (!result.ok) { addToast(result.error, 'err'); return }
        setTaskLists((prev) => ({ ...prev, [orderId]: result.data }))
      })
    }
  }

  function addTask(orderId: string) {
    const description = (taskDrafts[orderId] ?? '').trim()
    if (!description) return
    setTaskDrafts((prev) => ({ ...prev, [orderId]: '' }))
    startTaskBusy(async () => {
      const result = await createWorkOrderTask({ workOrderId: orderId, description })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setTasks(orderId, result.data)
      addToast('Tarea agregada', 'ok')
    })
  }

  function toggleTask(orderId: string, task: WorkOrderTask) {
    startTaskBusy(async () => {
      const result = await toggleWorkOrderTask({ id: task.id, done: !task.done })
      if (!result.ok) { addToast(result.error, 'err'); return }
      const tasks = taskLists[orderId]
      if (tasks) setTasks(orderId, tasks.map((t) => t.id === task.id ? { ...t, done: !t.done } : t))
    })
  }

  async function removeTask(orderId: string, taskId: string) {
    if (!(await confirm({ title: '¿Eliminar esta tarea de la lista?', tone: 'danger' }))) return
    startTaskBusy(async () => {
      const result = await deleteWorkOrderTask(taskId)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setTasks(orderId, result.data)
      addToast('Tarea eliminada', 'ok')
    })
  }

  const stats = useMemo(() => {
    const live = ordenes.filter((o) => isOpen(o.status))
    const today = new Date().toISOString().slice(0, 10)
    return {
      open: live.length,
      // Scheduled for a date already past and still not done. This is the list
      // a maintenance lead works from every morning.
      overdue: live.filter((o) => o.scheduledOn !== null && o.scheduledOn < today).length,
      downtime: ordenes.reduce((s, o) => s + o.downtimeHours, 0),
      cost: ordenes.reduce((s, o) => s + o.laborCostCents + o.partsCostCents, 0),
    }
  }, [ordenes])

  const visible = ordenes.filter((o) => {
    const byStatus = statusFilter === 'Abiertas' ? isOpen(o.status)
      : statusFilter === 'Todas' ? true
      : o.status === statusFilter
    return byStatus && (kindFilter === 'Todos' || o.kind === kindFilter)
  })

  function changeStatus(orden: WorkOrderRow, status: string) {
    startTransition(async () => {
      const result = await setOrdenStatus({ id: orden.id, status: status as never, downtimeHours: null })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(
        status === 'Completada' && orden.recurrenceDays
          ? `Orden completada · próxima programada en ${orden.recurrenceDays} días`
          : `Orden ${status.toLowerCase()}`,
        'ok',
      )
    })
  }

  async function remove(orden: WorkOrderRow) {
    if (!(await confirm({ title: '¿Eliminar esta orden?', description: 'Úsalo solo si se creó por error; para cerrarla, complétala.', tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deleteOrden(orden.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Orden eliminada', 'ok')
    })
  }

  function startEdit(orden: WorkOrderRow) {
    setForm({
      title: orden.title,
      kind: orden.kind,
      priority: orden.priority,
      assetId: orden.assetId ?? '',
      assetLabel: orden.assetLabel,
      assigneeId: orden.assigneeId ?? '',
      location: orden.location,
      detail: orden.detail,
      scheduledOn: orden.scheduledOn ?? '',
      laborCost: String(orden.laborCostCents / 100),
      partsCost: String(orden.partsCostCents / 100),
      recurrenceDays: orden.recurrenceDays ? String(orden.recurrenceDays) : '',
      siteId: orden.siteId ?? '',
    })
    setEditingId(orden.id)
    setOpen(true)
  }

  function submit() {
    startTransition(async () => {
      const input = {
        title: form.title,
        kind: form.kind as never,
        priority: form.priority as never,
        assetId: form.assetId || null,
        assetLabel: form.assetLabel,
        assigneeId: form.assigneeId || null,
        location: form.location,
        detail: form.detail,
        scheduledOn: orNull(form.scheduledOn),
        laborCostCents: toCents(form.laborCost),
        partsCostCents: toCents(form.partsCost),
        recurrenceDays: orNull(form.recurrenceDays),
        siteId: form.siteId || null,
      }
      const result = editingId
        ? await updateOrden({ ...input, id: editingId })
        : await createOrden(input)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setForm(EMPTY)
      setEditingId(null)
      setOpen(false)
      addToast(editingId ? 'Orden actualizada' : 'Orden creada', 'ok')
    })
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat icon={<Wrench size={16} />} tone="blu" label="Órdenes abiertas" value={stats.open} />
        </div>
        <div className="rise d2">
          <Stat icon={<AlertTriangle size={16} />} tone="red" label="Vencidas"
            value={stats.overdue} sub="programadas y sin cerrar" />
        </div>
        <div className="rise d3">
          <Stat icon={<Clock size={16} />} tone="amb" label="Horas de parada"
            value={Math.round(stats.downtime)} />
        </div>
        <div className="rise d4">
          <Stat icon={<DollarSign size={16} />} tone="vio" label="Costo acumulado"
            value={pesos(stats.cost)} sub="mano de obra y repuestos" />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <div>
            <div className="ctitle">Órdenes de trabajo</div>
            <div className="elsub" style={{ marginTop: 2 }}>
              Preventivo, correctivo y mejoras sobre equipos y activos.
            </div>
          </div>
          {data.canWrite && (
            <button className="btn dark" disabled={pending} onClick={() => { setForm(EMPTY); setEditingId(null); setOpen(true) }}>
              <Plus size={15} />Nueva orden
            </button>
          )}
        </div>

        <div className="cpad" style={{ paddingBottom: 0, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 190 }}>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={['Abiertas', 'Todas', ...WORK_ORDER_STATUSES]}
            />
          </div>
          <div style={{ minWidth: 170 }}>
            <Select value={kindFilter} onChange={setKindFilter}
              options={['Todos', ...WORK_ORDER_KINDS]} />
          </div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Trabajo</th>
                <th scope="col">Activo</th>
                <th scope="col">Responsable</th>
                <th scope="col">Programada</th>
                <th scope="col">Prioridad</th>
                <th scope="col">Estado</th>
                {data.canWrite && <th scope="col" aria-label="Acciones" />}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={data.canWrite ? 7 : 6}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      {ordenes.length === 0
                        ? 'Todavía no hay órdenes de trabajo.'
                        : 'No hay órdenes con esos filtros.'}
                    </div>
                  </td>
                </tr>
              ) : visible.map((o) => (
                <Fragment key={o.id}>
                <tr>
                  <td>
                    <div className="cename" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button className="ibtn" aria-label={`Lista de tareas de ${o.title}`}
                        style={{ transform: expanded[o.id] ? 'rotate(180deg)' : 'none', transition: 'transform var(--acc-chevron) var(--acc-ease)' }}
                        onClick={() => expand(o.id)}>
                        <ChevronDown size={14} />
                      </button>
                      {o.title}
                    </div>
                    <div className="elsub mono">
                      {o.code} · {o.kind}
                      {o.recurrenceDays && ` · cada ${o.recurrenceDays} días`}
                    </div>
                  </td>
                  <td>
                    {o.assetLabel || '—'}
                    {o.location && <div className="elsub">{o.location}</div>}
                    {o.siteName && <div className="elsub">{o.siteName}</div>}
                  </td>
                  <td>{assigneeName(o.assigneeId)}</td>
                  <td>{formatDate(o.scheduledOn)}</td>
                  <td><Badge st={o.priority} tone={prioTone(o.priority)} /></td>
                  <td>
                    <Badge st={o.status}
                      tone={o.status === 'Completada' ? 'grn'
                        : o.status === 'En ejecución' ? 'blu'
                        : o.status === 'Cancelada' ? 'neu' : 'amb'} />
                  </td>
                  {data.canWrite && (
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Select
                          value={o.status}
                          onChange={(next) => { if (next !== o.status) changeStatus(o, next) }}
                          options={[...WORK_ORDER_STATUSES]}
                        />
                        <button className="ibtn" aria-label={`Editar ${o.title}`}
                          disabled={pending} onClick={() => startEdit(o)}>
                          <PenLine size={14} />
                        </button>
                        <button className="ibtn" aria-label={`Eliminar ${o.title}`}
                          disabled={pending} onClick={() => remove(o)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
                {expanded[o.id] && (
                  <tr>
                    <td colSpan={data.canWrite ? 7 : 6} style={{ background: 'var(--bg2)', padding: '10px 18px 14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div className="elsub" style={{ marginBottom: 4 }}>
                            Lista de tareas
                            {taskLists[o.id] && ` · ${taskLists[o.id]?.filter((t) => t.done).length ?? 0}/${taskLists[o.id]?.length ?? 0}`}
                          </div>
                          {loadingTasks === o.id ? (
                            <div className="elsub">Cargando tareas…</div>
                          ) : (taskLists[o.id]?.length ?? 0) === 0 ? (
                            <div className="elsub">Sin tareas</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {taskLists[o.id]?.map((t) => (
                                <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: data.canWrite ? 'pointer' : 'default' }}>
                                  <input
                                    type="checkbox"
                                    checked={t.done}
                                    disabled={!data.canWrite || taskBusy}
                                    onChange={() => toggleTask(o.id, t)}
                                  />
                                  <span style={{ flex: 1, color: t.done ? 'var(--ink3)' : 'var(--ink)', textDecoration: t.done ? 'line-through' : 'none' }}>
                                    {t.description}
                                  </span>
                                  {data.canWrite && (
                                    <button className="ibtn" aria-label={`Eliminar tarea ${t.description}`}
                                      disabled={taskBusy} onClick={() => removeTask(o.id, t.id)}>
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </label>
                              ))}
                            </div>
                          )}
                          {data.canWrite && (
                            <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                              <input
                                className="field"
                                value={taskDrafts[o.id] ?? ''}
                                disabled={taskBusy}
                                onChange={(e) => setTaskDrafts((prev) => ({ ...prev, [o.id]: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === 'Enter') addTask(o.id) }}
                                placeholder="Nueva tarea…"
                              />
                              <button className="ibtn" aria-label="Agregar tarea"
                                disabled={taskBusy} onClick={() => addTask(o.id)}>
                                <Plus size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <LoadMore
          loaded={ordenes.length}
          total={total}
          loading={loadingMore}
          error={loadMoreError}
          onLoadMore={loadMore}
          noun="órdenes"
        />
      </div>

      <FormDrawer
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? 'Editar orden de trabajo' : 'Nueva orden de trabajo'}
        footer={
          <button className="btn dark" disabled={pending} onClick={submit}>
            <Check size={15} />{editingId ? 'Guardar cambios' : 'Crear orden'}
          </button>
        }
      >
        <label className="flabel" htmlFor="wo-title">Trabajo</label>
        <input id="wo-title" className="field" value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Cambio de aceite del generador" />

        <div className="fg2">
          <div>
            <div className="flabel">Tipo</div>
            <Select value={form.kind} onChange={(v) => setForm({ ...form, kind: v })}
              options={[...WORK_ORDER_KINDS]} />
          </div>
          <div>
            <div className="flabel">Prioridad</div>
            <Select value={form.priority} onChange={(v) => setForm({ ...form, priority: v })}
              options={[...WORK_ORDER_PRIORITIES]} />
          </div>
        </div>

        {data.assets.length > 0 && (
          <>
            <div className="flabel">Activo del inventario</div>
            <Select
              value={form.assetId}
              onChange={(v) => {
                const asset = data.assets.find((a) => a.id === v)
                // The label follows the picked asset so the row still prints a
                // name if the asset is later removed from the register.
                setForm({ ...form, assetId: v, assetLabel: asset ? asset.name : form.assetLabel })
              }}
              placeholder="Sin activo asociado"
              options={data.assets.map((a) => ({
                value: a.id,
                label: a.code ? `${a.code} · ${a.name}` : a.name,
              }))}
            />
          </>
        )}

        <label className="flabel" htmlFor="wo-asset">Equipo o activo (texto)</label>
        <input id="wo-asset" className="field" value={form.assetLabel}
          onChange={(e) => setForm({ ...form, assetLabel: e.target.value })}
          placeholder="Generador Cummins 60 kVA" />

        <div className="fg2">
          <div>
            <div className="flabel">Responsable</div>
            <Select value={form.assigneeId} onChange={(v) => setForm({ ...form, assigneeId: v })}
              placeholder="Sin asignar"
              options={data.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))} />
          </div>
          {data.sites.length > 1 && (
            <div>
              <div className="flabel">Sucursal</div>
              <Select
                value={form.siteId}
                onChange={(v) => setForm({ ...form, siteId: v })}
                placeholder="Sin sucursal"
                options={[
                  { value: '', label: 'Sin sucursal' },
                  ...data.sites.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </div>
          )}
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="wo-loc">Ubicación</label>
            <input id="wo-loc" className="field" value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <div className="flabel">Programada para</div>
            <DatePicker ariaLabel="Programada para" value={form.scheduledOn}
              onChange={(v) => setForm({ ...form, scheduledOn: v })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="wo-labor">Mano de obra (COP)</label>
            <input id="wo-labor" className="field" inputMode="numeric" value={form.laborCost}
              onChange={(e) => setForm({ ...form, laborCost: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="wo-parts">Repuestos (COP)</label>
            <input id="wo-parts" className="field" inputMode="numeric" value={form.partsCost}
              onChange={(e) => setForm({ ...form, partsCost: e.target.value })} />
          </div>
        </div>

        <label className="flabel" htmlFor="wo-rec">Repetir cada (días)</label>
        <input id="wo-rec" className="field" type="number" min={1} value={form.recurrenceDays}
          onChange={(e) => setForm({ ...form, recurrenceDays: e.target.value })}
          placeholder="Solo una vez" />

        <label className="flabel" htmlFor="wo-detail">Detalle</label>
        <textarea id="wo-detail" className="field" rows={4} value={form.detail}
          onChange={(e) => setForm({ ...form, detail: e.target.value })} />
      </FormDrawer>
    </>
  )
}
