'use client'

import { useMemo, useState, useTransition } from 'react'
import { Wrench, AlertTriangle, Check, Clock, Plus, Trash2, DollarSign } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import {
  WORK_ORDER_KINDS, WORK_ORDER_PRIORITIES, WORK_ORDER_STATUSES,
} from '@/lib/domain'
import { cop, prioTone } from '@/lib/utils'
import type { MantenimientoData, WorkOrderRow } from '@/server/queries/mantenimiento'
import { createOrden, deleteOrden, setOrdenStatus } from '@/server/mutations/mantenimiento'
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
  laborCost: '', partsCost: '', recurrenceDays: '',
}

/** Open work is everything that has not reached a terminal state. */
function isOpen(status: string): boolean {
  return status !== 'Completada' && status !== 'Cancelada'
}

export default function MantenimientoPage({ data }: { data: MantenimientoData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [ordenes, setOrdenes] = useState<WorkOrderRow[]>(data.ordenes)
  const [total, setTotal] = useState(data.ordenesTotal)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const [statusFilter, setStatusFilter] = useState('Abiertas')
  const [kindFilter, setKindFilter] = useState('Todos')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)

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

  function remove(orden: WorkOrderRow) {
    if (!window.confirm('¿Eliminar esta orden? Úsalo solo si se creó por error; para cerrarla, complétala.')) return
    startTransition(async () => {
      const result = await deleteOrden(orden.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Orden eliminada', 'ok')
    })
  }

  function submit() {
    startTransition(async () => {
      const result = await createOrden({
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
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setForm(EMPTY)
      setOpen(false)
      addToast('Orden creada', 'ok')
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
            <button className="btn dark" disabled={pending} onClick={() => setOpen(true)}>
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
                <tr key={o.id}>
                  <td>
                    <div className="cename">{o.title}</div>
                    <div className="elsub mono">
                      {o.code} · {o.kind}
                      {o.recurrenceDays && ` · cada ${o.recurrenceDays} días`}
                    </div>
                  </td>
                  <td>
                    {o.assetLabel || '—'}
                    {o.location && <div className="elsub">{o.location}</div>}
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
                        <button className="ibtn" aria-label={`Eliminar ${o.title}`}
                          disabled={pending} onClick={() => remove(o)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
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
        title="Nueva orden de trabajo"
        footer={
          <button className="btn dark" disabled={pending} onClick={submit}>
            <Check size={15} />Crear orden
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

        <div className="flabel">Responsable</div>
        <Select value={form.assigneeId} onChange={(v) => setForm({ ...form, assigneeId: v })}
          placeholder="Sin asignar"
          options={data.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="wo-loc">Ubicación</label>
            <input id="wo-loc" className="field" value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="wo-date">Programada para</label>
            <input id="wo-date" className="field" type="date" value={form.scheduledOn}
              onChange={(e) => setForm({ ...form, scheduledOn: e.target.value })} />
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
