'use client'

import { useMemo, useState, useTransition } from 'react'
import { Factory, Check, Plus, Trash2, AlertTriangle, Layers, PenLine } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import { PRODUCTION_STATUSES } from '@/lib/domain'
import type { BomRow, ProduccionData, ProductionRow } from '@/server/queries/produccion'
import {
  addEtapa, createOrdenProduccion, deleteBom, deleteOrdenProduccion,
  saveBom, setEtapaStatus, updateOrdenProduccion,
} from '@/server/mutations/produccion'
import { fetchMoreOrdenesProduccion } from '@/server/actions/produccion'

const DATE = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' })

function formatDate(iso: string | null): string {
  return iso ? DATE.format(new Date(`${iso}T00:00:00`)) : '—'
}

function toCents(value: string): number {
  const n = Number(value.replace(/[^\d]/g, ''))
  return Number.isFinite(n) ? Math.round(n) * 100 : 0
}

function orNull(value: string): string | null {
  return value.trim() === '' ? null : value
}

function pesos(cents: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
    .format(Math.round(cents / 100))
}

const EMPTY_ORDER = {
  productId: '', productLabel: '', quantityPlanned: '', unit: 'UN', line: '',
  supervisorId: '', startsOn: '', dueOn: '', cost: '', notes: '',
}

/**
 * Good units over units started.
 *
 * Null when nothing has been produced yet: a yield of 0 % on an order that has
 * not begun is a number a plant manager would act on, and it would be wrong.
 */
function yieldOf(o: ProductionRow): number | null {
  const started = o.quantityDone + o.quantityScrap
  if (started === 0) return null
  return Math.round((o.quantityDone / started) * 100)
}

export default function ProduccionPage({ data }: { data: ProduccionData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [ordenes, setOrdenes] = useState<ProductionRow[]>(data.ordenes)
  const [total, setTotal] = useState(data.ordenesTotal)
  const [etapas, setEtapas] = useState(data.etapas)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const [statusFilter, setStatusFilter] = useState('Todas')
  const [orderOpen, setOrderOpen] = useState(false)
  const [stageOpen, setStageOpen] = useState(false)
  const [orderForm, setOrderForm] = useState(EMPTY_ORDER)
  const [stageForm, setStageForm] = useState({ orderId: '', name: '', operatorId: '', position: '0' })
  const [expanded, setExpanded] = useState<string | null>(null)
  const [boms, setBoms] = useState<BomRow[]>(data.boms ?? [])
  const [bomOpen, setBomOpen] = useState(false)
  const [bomForm, setBomForm] = useState<{
    productId: string
    version: string
    notes: string
    items: Array<{ componentId: string; quantity: string; unit: string }>
  }>({ productId: '', version: '1', notes: '', items: [{ componentId: '', quantity: '1', unit: 'UN' }] })

  function apply(next: ProduccionData) {
    setOrdenes(next.ordenes)
    setTotal(next.ordenesTotal)
    setEtapas(next.etapas)
    setBoms(next.boms)
  }

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreOrdenesProduccion(ordenes.length)
      if (!result.ok) { setLoadMoreError(result.error); return }
      setOrdenes((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        return [...prev, ...result.data.rows.filter((r) => !seen.has(r.id))]
      })
      setTotal(result.data.total)
    })
  }

  const supervisorName = useMemo(() => {
    const byId = new Map(data.roster.map((r) => [r.employeeId, r.fullName]))
    return (id: string | null) => (id ? byId.get(id) ?? '—' : 'Sin asignar')
  }, [data.roster])

  const stats = useMemo(() => {
    const running = ordenes.filter((o) => o.status === 'En proceso')
    const done = ordenes.reduce((s, o) => s + o.quantityDone, 0)
    const scrap = ordenes.reduce((s, o) => s + o.quantityScrap, 0)
    const started = done + scrap
    const today = new Date().toISOString().slice(0, 10)
    return {
      running: running.length,
      produced: done,
      yieldPct: started > 0 ? Math.round((done / started) * 100) : null,
      late: ordenes.filter(
        (o) => o.dueOn !== null && o.dueOn < today && o.status !== 'Terminada' && o.status !== 'Cancelada',
      ).length,
    }
  }, [ordenes])

  const visible = ordenes.filter((o) => statusFilter === 'Todas' || o.status === statusFilter)

  function changeStatus(o: ProductionRow, status: string) {
    startTransition(async () => {
      const result = await updateOrdenProduccion({
        id: o.id, status: status as never, quantityDone: null, quantityScrap: null,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`Orden ${status.toLowerCase()}`, 'ok')
    })
  }

  function setQuantity(o: ProductionRow, field: 'done' | 'scrap', value: string) {
    const next = Number(value)
    if (!Number.isFinite(next) || next < 0) return
    const current = field === 'done' ? o.quantityDone : o.quantityScrap
    if (next === current) return
    startTransition(async () => {
      const result = await updateOrdenProduccion({
        id: o.id,
        status: null,
        quantityDone: field === 'done' ? next : null,
        quantityScrap: field === 'scrap' ? next : null,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
    })
  }

  function changeStage(id: string, status: string) {
    startTransition(async () => {
      const result = await setEtapaStatus({ id, status: status as never, quantityDone: null })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
    })
  }

  function remove(o: ProductionRow) {
    if (!window.confirm('¿Eliminar esta orden? Se eliminan también sus etapas.')) return
    startTransition(async () => {
      const result = await deleteOrdenProduccion(o.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Orden eliminada', 'ok')
    })
  }


  function submitBom() {
    startTransition(async () => {
      const result = await saveBom({
        productId: bomForm.productId,
        version: bomForm.version || '1',
        notes: bomForm.notes,
        items: bomForm.items
          .filter((i) => i.componentId)
          .map((i) => ({ componentId: i.componentId, quantity: Number(i.quantity) || 0, unit: i.unit })),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setBomForm({ productId: '', version: '1', notes: '', items: [{ componentId: '', quantity: '1', unit: 'UN' }] })
      setBomOpen(false)
      addToast('Receta guardada', 'ok')
    })
  }

  function removeBom(id: string) {
    if (!window.confirm('¿Eliminar esta lista de materiales?')) return
    startTransition(async () => {
      const result = await deleteBom(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Receta eliminada', 'ok')
    })
  }

  function editBom(b: BomRow) {
    setBomForm({
      productId: b.productId,
      version: b.version,
      notes: b.notes,
      items: b.items.length > 0
        ? b.items.map((i) => ({ componentId: i.componentId, quantity: String(i.quantity), unit: i.unit }))
        : [{ componentId: '', quantity: '1', unit: 'UN' }],
    })
    setBomOpen(true)
  }

  function submitOrder() {
    startTransition(async () => {
      const result = await createOrdenProduccion({
        productId: orderForm.productId || null,
        productLabel: orderForm.productLabel,
        quantityPlanned: orderForm.quantityPlanned,
        unit: orderForm.unit,
        line: orderForm.line,
        supervisorId: orderForm.supervisorId || null,
        startsOn: orNull(orderForm.startsOn),
        dueOn: orNull(orderForm.dueOn),
        costCents: toCents(orderForm.cost),
        notes: orderForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setOrderForm(EMPTY_ORDER)
      setOrderOpen(false)
      addToast('Orden de producción creada', 'ok')
    })
  }

  function submitStage() {
    startTransition(async () => {
      const result = await addEtapa({
        orderId: stageForm.orderId,
        name: stageForm.name,
        operatorId: stageForm.operatorId || null,
        position: stageForm.position || 0,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setStageForm({ orderId: '', name: '', operatorId: '', position: '0' })
      setStageOpen(false)
      addToast('Etapa agregada', 'ok')
    })
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat icon={<Factory size={16} />} tone="blu" label="Órdenes en proceso"
            value={stats.running} sub={`de ${ordenes.length} registradas`} />
        </div>
        <div className="rise d2">
          <Stat icon={<Layers size={16} />} tone="grn" label="Unidades producidas"
            value={Math.round(stats.produced)} />
        </div>
        <div className="rise d3">
          <Stat icon={<Check size={16} />} tone="vio" label="Rendimiento"
            value={stats.yieldPct === null ? '—' : `${stats.yieldPct}%`}
            sub="buenas sobre iniciadas" />
        </div>
        <div className="rise d4">
          <Stat icon={<AlertTriangle size={16} />} tone="red" label="Atrasadas"
            value={stats.late} sub="pasaron la fecha de entrega" />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <div>
            <div className="ctitle">Órdenes de producción</div>
            <div className="elsub" style={{ marginTop: 2 }}>
              Toca una fila para ver y mover sus etapas.
            </div>
          </div>
          {data.canWrite && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" disabled={pending || ordenes.length === 0}
                onClick={() => {
                  setStageForm({ orderId: ordenes[0]?.id ?? '', name: '', operatorId: '', position: '0' })
                  setStageOpen(true)
                }}>
                <Plus size={15} />Etapa
              </button>
              <button className="btn dark" disabled={pending} onClick={() => setOrderOpen(true)}>
                <Plus size={15} />Orden
              </button>
            </div>
          )}
        </div>

        <div className="cpad" style={{ paddingBottom: 0 }}>
          <div style={{ maxWidth: 220 }}>
            <Select value={statusFilter} onChange={setStatusFilter}
              options={['Todas', ...PRODUCTION_STATUSES]} />
          </div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col">Planificado</th>
                <th scope="col">Producido</th>
                <th scope="col">Merma</th>
                <th scope="col">Rendimiento</th>
                <th scope="col">Entrega</th>
                <th scope="col">Estado</th>
                {data.canWrite && <th scope="col" aria-label="Acciones" />}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={data.canWrite ? 8 : 7}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      {ordenes.length === 0
                        ? 'Todavía no hay órdenes de producción.'
                        : 'No hay órdenes con ese estado.'}
                    </div>
                  </td>
                </tr>
              ) : visible.map((o) => {
                const rows = etapas.filter((e) => e.orderId === o.id)
                const y = yieldOf(o)
                return [
                  <tr key={o.id} className="trow"
                    onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                    <td>
                      <div className="cename">{o.productLabel}</div>
                      <div className="elsub mono">
                        {o.code}{o.line && ` · ${o.line}`} · {supervisorName(o.supervisorId)}
                      </div>
                    </td>
                    <td>{o.quantityPlanned} {o.unit}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {data.canWrite ? (
                        <input className="field" style={{ width: 90 }} type="number" min={0}
                          defaultValue={o.quantityDone}
                          aria-label={`Producido de ${o.productLabel}`}
                          disabled={pending}
                          onBlur={(e) => setQuantity(o, 'done', e.target.value)} />
                      ) : o.quantityDone}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {data.canWrite ? (
                        <input className="field" style={{ width: 90 }} type="number" min={0}
                          defaultValue={o.quantityScrap}
                          aria-label={`Merma de ${o.productLabel}`}
                          disabled={pending}
                          onBlur={(e) => setQuantity(o, 'scrap', e.target.value)} />
                      ) : o.quantityScrap}
                    </td>
                    <td>{y === null ? '—' : `${y}%`}</td>
                    <td>{formatDate(o.dueOn)}</td>
                    <td>
                      <Badge st={o.status}
                        tone={o.status === 'Terminada' ? 'grn'
                          : o.status === 'En proceso' ? 'blu'
                          : o.status === 'Cancelada' ? 'neu' : 'amb'} />
                    </td>
                    {data.canWrite && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <Select
                            value={o.status}
                            onChange={(next) => { if (next !== o.status) changeStatus(o, next) }}
                            options={[...PRODUCTION_STATUSES]}
                          />
                          <button className="ibtn" aria-label={`Eliminar ${o.productLabel}`}
                            disabled={pending} onClick={() => remove(o)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>,
                  expanded === o.id ? (
                    <tr key={`${o.id}-stages`}>
                      <td colSpan={data.canWrite ? 8 : 7} style={{ background: 'var(--bg2)' }}>
                        {rows.length === 0 ? (
                          <div className="dempty" style={{ padding: '12px 0' }}>
                            Esta orden no tiene etapas.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
                            {rows.map((e) => (
                              <div className="elrow" key={e.id}>
                                <div className="eltxt">
                                  <div className="cename">{e.name}</div>
                                  <div className="elsub">
                                    {e.quantityDone} {o.unit} · {supervisorName(e.operatorId)}
                                  </div>
                                </div>
                                {data.canWrite ? (
                                  <div style={{ minWidth: 170 }}>
                                    <Select
                                      value={e.status}
                                      onChange={(next) => { if (next !== e.status) changeStage(e.id, next) }}
                                      options={[...PRODUCTION_STATUSES]}
                                    />
                                  </div>
                                ) : <Badge st={e.status} />}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : null,
                ]
              })}
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

      <div className="card rise d3" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Listas de materiales</div>
          <div className="csub">
            La receta de cada producto fabricado: componentes del catálogo y cantidad por
            unidad. El costo se sugiere al crear la orden.
          </div>
          {data.canWrite && (
            <button className="btn dark" disabled={pending || data.productos.length === 0}
              onClick={() => {
                setBomForm({ productId: '', version: '1', notes: '', items: [{ componentId: '', quantity: '1', unit: 'UN' }] })
                setBomOpen(true)
              }}>
              <Plus size={15} />Nueva receta
            </button>
          )}
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col">Versión</th>
                <th scope="col">Componentes</th>
                <th scope="col">Costo de materiales</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {boms.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Sin recetas. Crea la primera para que las órdenes sugieran su costo.
                    </div>
                  </td>
                </tr>
              ) : boms.map((b) => (
                <tr key={b.id}>
                  <td><div className="cename">{b.productName}</div></td>
                  <td className="mono">{b.version}</td>
                  <td>
                    <div className="muted" style={{ fontSize: 12, maxWidth: 320 }}>
                      {b.items.map((i) => `${i.quantity} ${i.unit} de ${i.componentName}`).join(' · ') || '—'}
                    </div>
                  </td>
                  <td className="mono">{pesos(b.costCents)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {data.canWrite && (
                      <>
                        <button className="ibtn" style={{ width: 28, height: 28 }} data-tip="Editar"
                          disabled={pending} onClick={() => editBom(b)}
                          aria-label={`Editar la receta de ${b.productName}`}>
                          <PenLine size={13} />
                        </button>
                        <button className="ibtn" style={{ width: 28, height: 28, color: 'var(--redd)' }}
                          data-tip="Eliminar" disabled={pending} onClick={() => removeBom(b.id)}
                          aria-label={`Eliminar la receta de ${b.productName}`}>
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <FormDrawer
        open={bomOpen}
        onClose={() => setBomOpen(false)}
        title="Lista de materiales"
        wide
        footer={
          <button className="btn dark" disabled={pending || !bomForm.productId || bomForm.items.every((i) => !i.componentId)} onClick={submitBom}>
            <Check size={15} />Guardar receta
          </button>
        }
      >
        <div className="flabel">Producto fabricado</div>
        <Select
          value={bomForm.productId}
          onChange={(v) => setBomForm({ ...bomForm, productId: v })}
          options={data.productos.map((p) => ({ value: p.id, label: p.name }))}
        />
        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="bom-version">Versión</label>
            <input id="bom-version" className="field" value={bomForm.version}
              onChange={(e) => setBomForm({ ...bomForm, version: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="bom-notes">Notas</label>
            <input id="bom-notes" className="field" value={bomForm.notes}
              onChange={(e) => setBomForm({ ...bomForm, notes: e.target.value })} />
          </div>
        </div>

        <div className="flabel" style={{ marginTop: 8 }}>Componentes</div>
        {bomForm.items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
            <div style={{ flex: '2 1 220px', minWidth: 160 }}>
              <Select
                value={item.componentId}
                onChange={(v) => {
                  const items = [...bomForm.items]
                  items[i] = { ...items[i], componentId: v }
                  setBomForm({ ...bomForm, items })
                }}
                options={data.productos.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
            <div style={{ flex: '0 1 90px', minWidth: 70 }}>
              <input className="field" type="number" min={0} step="0.01" value={item.quantity}
                aria-label={`Cantidad del componente ${i + 1}`}
                onChange={(e) => {
                  const items = [...bomForm.items]
                  items[i] = { ...items[i], quantity: e.target.value }
                  setBomForm({ ...bomForm, items })
                }} />
            </div>
            <div style={{ flex: '0 1 70px', minWidth: 56 }}>
              <input className="field" value={item.unit} maxLength={10}
                aria-label={`Unidad del componente ${i + 1}`}
                onChange={(e) => {
                  const items = [...bomForm.items]
                  items[i] = { ...items[i], unit: e.target.value }
                  setBomForm({ ...bomForm, items })
                }} />
            </div>
            <button className="ibtn" style={{ width: 28, height: 34, color: 'var(--redd)' }}
              disabled={bomForm.items.length === 1}
              onClick={() => setBomForm({ ...bomForm, items: bomForm.items.filter((_, j) => j !== i) })}
              aria-label={`Quitar componente ${i + 1}`}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <button className="btn" disabled={bomForm.items.length >= 50}
          onClick={() => setBomForm({ ...bomForm, items: [...bomForm.items, { componentId: '', quantity: '1', unit: 'UN' }] })}>
          <Plus size={14} />Añadir componente
        </button>
      </FormDrawer>

      <FormDrawer
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        title="Nueva orden de producción"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitOrder}>
            <Check size={15} />Crear orden
          </button>
        }
      >
        {data.productos.length > 0 && (
          <>
            <div className="flabel">Producto del catálogo</div>
            <Select
              value={orderForm.productId}
              onChange={(v) => {
                const product = data.productos.find((p) => p.id === v)
                const bom = boms.find((b) => b.productId === v)
                // The label follows the pick so the order still names what it
                // made if the catalogue entry is later removed. La receta, si
                // existe, sugiere el costo de materiales.
                setOrderForm({
                  ...orderForm,
                  productId: v,
                  productLabel: product ? product.name : orderForm.productLabel,
                  cost: bom && bom.costCents > 0 ? String(Math.round(bom.costCents / 100)) : orderForm.cost,
                })
              }}
              placeholder="Sin producto del catálogo"
              options={data.productos.map((p) => ({ value: p.id, label: `${p.sku} · ${p.name}` }))}
            />
          </>
        )}

        <label className="flabel" htmlFor="po-label">Qué se produce</label>
        <input id="po-label" className="field" value={orderForm.productLabel}
          onChange={(e) => setOrderForm({ ...orderForm, productLabel: e.target.value })}
          placeholder="Panel solar 550 W" />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="po-qty">Cantidad planificada</label>
            <input id="po-qty" className="field" type="number" min={0} step="0.01"
              value={orderForm.quantityPlanned}
              onChange={(e) => setOrderForm({ ...orderForm, quantityPlanned: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="po-unit">Unidad</label>
            <input id="po-unit" className="field" value={orderForm.unit}
              onChange={(e) => setOrderForm({ ...orderForm, unit: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="po-line">Línea o planta</label>
            <input id="po-line" className="field" value={orderForm.line}
              onChange={(e) => setOrderForm({ ...orderForm, line: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="po-cost">Costo estimado (COP)</label>
            <input id="po-cost" className="field" inputMode="numeric" value={orderForm.cost}
              onChange={(e) => setOrderForm({ ...orderForm, cost: e.target.value })} />
          </div>
        </div>

        <div className="flabel">Supervisor</div>
        <Select value={orderForm.supervisorId}
          onChange={(v) => setOrderForm({ ...orderForm, supervisorId: v })}
          placeholder="Sin asignar"
          options={data.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))} />

        <div className="fg2">
          <div>
            <div className="flabel">Inicia</div>
            <DatePicker ariaLabel="Inicia" value={orderForm.startsOn}
              onChange={(v) => setOrderForm({ ...orderForm, startsOn: v })} />
          </div>
          <div>
            <div className="flabel">Entrega</div>
            <DatePicker ariaLabel="Entrega" value={orderForm.dueOn}
              onChange={(v) => setOrderForm({ ...orderForm, dueOn: v })} />
          </div>
        </div>

        <label className="flabel" htmlFor="po-notes">Notas</label>
        <textarea id="po-notes" className="field" rows={3} value={orderForm.notes}
          onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={stageOpen}
        onClose={() => setStageOpen(false)}
        title="Nueva etapa"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitStage}>
            <Check size={15} />Agregar etapa
          </button>
        }
      >
        <div className="flabel">Orden</div>
        <Select value={stageForm.orderId}
          onChange={(v) => setStageForm({ ...stageForm, orderId: v })}
          placeholder="Elige la orden"
          options={ordenes.map((o) => ({ value: o.id, label: `${o.code ?? ''} ${o.productLabel}`.trim() }))} />

        <label className="flabel" htmlFor="st-name">Etapa</label>
        <input id="st-name" className="field" value={stageForm.name}
          onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })}
          placeholder="Laminado" />

        <div className="flabel">Operario</div>
        <Select value={stageForm.operatorId}
          onChange={(v) => setStageForm({ ...stageForm, operatorId: v })}
          placeholder="Sin asignar"
          options={data.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))} />

        <label className="flabel" htmlFor="st-pos">Orden en la secuencia</label>
        <input id="st-pos" className="field" type="number" min={0} value={stageForm.position}
          onChange={(e) => setStageForm({ ...stageForm, position: e.target.value })} />
      </FormDrawer>
    </>
  )
}
