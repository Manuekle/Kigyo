'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Boxes, Users, Package, AlertCircle, ShoppingCart,
  FileSpreadsheet, Plus, PenLine, Trash2, X, Check,
} from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Stat from '@/components/ui/Stat'
import Select from '@/components/ui/Select'
import DatePicker from '@/components/ui/DatePicker'
import TabBar from '@/components/ui/TabBar'
import { useApp } from '@/lib/context/AppContext'
import { cop } from '@/lib/utils'
import { useExport } from '@/lib/hooks/use-export'
import { ASSET_CATEGORIES, ASSET_STATUSES, INVENTORY_ORDER_STATUSES } from '@/lib/domain'
import LoadMore from '@/components/ui/LoadMore'
import type { InventarioData, ActivoRow } from '@/server/queries/inventario'
import { fetchMoreActivos, fetchMorePedidos } from '@/server/actions/inventario'
import {
  assignActivo, createActivo, createPedido, deleteActivo, setPedidoStatus, updateActivo,
} from '@/server/mutations/inventario'

const DAY = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
const fmt = (iso: string | null) => (iso ? DAY.format(new Date(`${iso}T00:00:00`)) : '—')

const EMPTY_ASSET = {
  name: '', category: 'Cómputo', serial: '', employeeId: '', acquiredOn: '', siteId: '',
  status: 'Disponible' as (typeof ASSET_STATUSES)[number],
}
const EMPTY_ORDER = { item: '', supplier: '', quantity: '1', price: '' }

export default function InventarioPage({ data }: { data: InventarioData }) {
  const { addToast } = useApp()
  const { runExport, exporting } = useExport()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState<InventarioData>(data)
  const [tab, setTab] = useState('activos')
  const [assetOpen, setAssetOpen] = useState(false)
  const [editing, setEditing] = useState<ActivoRow | null>(null)
  const [assetForm, setAssetForm] = useState(EMPTY_ASSET)
  const [orderOpen, setOrderOpen] = useState(false)
  const [orderForm, setOrderForm] = useState(EMPTY_ORDER)

  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const { activos, pedidos, roster } = state

  /** Each tab pages its own table; the visible one is the one that grows. */
  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      if (tab === 'activos') {
        const result = await fetchMoreActivos(activos.length)
        if (!result.ok) { setLoadMoreError(result.error); return }
        setState((prev) => {
          const seen = new Set(prev.activos.map((a) => a.id))
          return {
            ...prev,
            activos: [...prev.activos, ...result.data.rows.filter((a) => !seen.has(a.id))],
            activosTotal: result.data.total,
          }
        })
        return
      }

      const result = await fetchMorePedidos(pedidos.length)
      if (!result.ok) { setLoadMoreError(result.error); return }
      setState((prev) => {
        const seen = new Set(prev.pedidos.map((o) => o.id))
        return {
          ...prev,
          pedidos: [...prev.pedidos, ...result.data.rows.filter((o) => !seen.has(o.id))],
          pedidosTotal: result.data.total,
        }
      })
    })
  }

  const stats = useMemo(() => ({
    total: state.activosTotal,
    assigned: activos.filter((a) => a.status === 'Asignado').length,
    available: activos.filter((a) => a.status === 'Disponible').length,
    maintenance: activos.filter((a) => a.status === 'Mantenimiento').length,
    // Pending orders, valued. The fixture carried a separate invoice list with
    // its own totals that agreed with nothing.
    pendingValue: pedidos
      .filter((p) => p.status !== 'Facturado' && p.status !== 'Cancelado')
      .reduce((s, p) => s + p.estPriceCents, 0),
  }), [activos, pedidos, state.activosTotal])

  function apply(next: InventarioData, message: string) {
    setState(next)
    addToast(message, 'ok')
  }

  function submitAsset() {
    if (!assetForm.name.trim()) { addToast('El nombre del activo es obligatorio', 'err'); return }
    startTransition(async () => {
      const payload = {
        name: assetForm.name.trim(),
        category: assetForm.category as (typeof ASSET_CATEGORIES)[number],
        serial: assetForm.serial.trim(),
        employeeId: assetForm.employeeId || null,
        acquiredOn: assetForm.acquiredOn || null,
        siteId: assetForm.siteId || null,
      }
      const result = editing
        ? await updateActivo({ ...payload, id: editing.id, status: assetForm.status })
        : await createActivo(payload)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setAssetOpen(false)
      setEditing(null)
      setAssetForm(EMPTY_ASSET)
      apply(result.data, editing ? 'Activo actualizado' : 'Activo registrado')
    })
  }

  function assign(a: ActivoRow, employeeId: string) {
    startTransition(async () => {
      const result = await assignActivo({ id: a.id, employeeId: employeeId || null })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data, employeeId ? 'Activo asignado' : 'Activo liberado')
    })
  }

  function removeAsset(a: ActivoRow) {
    if (!window.confirm(`¿Dar de baja "${a.name}"? Queda registrado como Baja, no se borra.`)) return
    startTransition(async () => {
      const result = await deleteActivo(a.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data, 'Activo dado de baja')
    })
  }

  function submitOrder() {
    if (!orderForm.item.trim()) { addToast('Describe qué se pide', 'err'); return }
    startTransition(async () => {
      const result = await createPedido({
        item: orderForm.item.trim(),
        supplier: orderForm.supplier.trim(),
        quantity: Math.max(1, Math.round(Number(orderForm.quantity) || 1)),
        // Pesos in the field, cents in the column.
        estPriceCents: Math.round((Number(orderForm.price) || 0) * 100),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setOrderOpen(false)
      setOrderForm(EMPTY_ORDER)
      apply(result.data, 'Pedido registrado')
    })
  }

  const exportAssets = () => {
    void runExport(
      activos.map((a) => ({
        Código: a.code ?? '',
        Activo: a.name,
        Categoría: a.category,
        Serial: a.serial,
        Asignado: a.employeeName ?? '',
        Estado: a.status,
        Adquirido: a.acquiredOn ?? '',
      })),
      'inventario-kigyo',
      'inventario',
    )
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat icon={<Boxes size={16} />} tone="blu" label="Activos" value={stats.total} /></div>
        <div className="rise d2"><Stat icon={<Users size={16} />} tone="grn" label="Asignados" value={stats.assigned} sub={`${stats.available} disponibles`} /></div>
        <div className="rise d3"><Stat icon={<AlertCircle size={16} />} tone="amb" label="En mantenimiento" value={stats.maintenance} /></div>
        <div className="rise d4"><Stat icon={<ShoppingCart size={16} />} tone="vio" label="Pedidos abiertos" value={cop(stats.pendingValue / 100)} sub="valor estimado" /></div>
      </div>

      <div className="ptools">
        <TabBar
          value={tab}
          onChange={setTab}
          items={[
            { key: 'activos', label: <><Package size={14} />Activos · {state.activosTotal}</> },
            { key: 'pedidos', label: <><ShoppingCart size={14} />Pedidos · {state.pedidosTotal}</> },
          ]}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {state.canWrite && tab === 'activos' && (
            <button className="btn pri" onClick={() => { setAssetForm(EMPTY_ASSET); setEditing(null); setAssetOpen(true) }}>
              <Plus size={15} />Nuevo activo
            </button>
          )}
          {state.canWrite && tab === 'pedidos' && (
            <button className="btn pri" onClick={() => { setOrderForm(EMPTY_ORDER); setOrderOpen(true) }}>
              <Plus size={15} />Nuevo pedido
            </button>
          )}
          <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportAssets} title="Exportar activos">
            <FileSpreadsheet size={15} />
          </button>
        </div>
      </div>

      {tab === 'activos' ? (
        <div className="card rise d2">
          <div className="tblwrap">
            <table className="tbl">
              <thead><tr><th scope="col">Activo</th><th scope="col">Categoría</th><th scope="col">Asignado a</th><th scope="col">Serial</th><th scope="col">Estado</th><th scope="col"></th></tr></thead>
              <tbody>
                {activos.length === 0 ? (
                  <tr><td colSpan={6}><div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                    {state.canWrite ? 'Todavía no hay activos. Registra el primero.' : 'Todavía no hay activos.'}
                  </div></td></tr>
                ) : activos.map((a) => (
                  <tr className="trow" key={a.id}>
                    <td>
                      <div className="cename">{a.name}</div>
                      <div className="ceid mono">{a.code ?? '—'} · {fmt(a.acquiredOn)}</div>
                    </td>
                    <td className="muted">{a.category}</td>
                    <td>
                      {/* Assignment is a picker, not a text field. The fixture
                          stored the holder as a name and used the string '—'
                          for "nobody", so an unassigned asset and one held by
                          a person called "—" were indistinguishable. */}
                      {state.canWrite && roster.length > 0 ? (
                        <Select
                          value={a.employeeId ?? ''}
                          onChange={(v) => assign(a, v)}
                          placeholder="Sin asignar"
                          options={[
                            { value: '', label: 'Sin asignar' },
                            ...roster.map((r) => ({ value: r.employeeId, label: r.fullName })),
                          ]}
                        />
                      ) : (
                        <span className="muted">{a.employeeName ?? 'Sin asignar'}</span>
                      )}
                    </td>
                    <td className="muted mono" style={{ fontSize: 12 }}>{a.serial || '—'}
                      {a.siteName ? <span className="elsub" style={{ display: 'block', fontSize: 11 }}>{a.siteName}</span> : null}
                    </td>
                    <td><Badge st={a.status} /></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {state.canWrite && (
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button
                            className="ibtn" style={{ width: 28, height: 28 }} data-tip="Editar"
                            onClick={() => {
                              setAssetForm({
                                name: a.name,
                                category: a.category,
                                serial: a.serial,
                                employeeId: a.employeeId ?? '',
                                acquiredOn: a.acquiredOn ?? '',
                                siteId: a.siteId ?? '',
                                status: a.status as (typeof ASSET_STATUSES)[number],
                              })
                              setEditing(a)
                              setAssetOpen(true)
                            }}
                            aria-label={`Editar ${a.name}`}
                          ><PenLine size={13} /></button>
                          <button className="ibtn" style={{ width: 28, height: 28, color: 'var(--redd)' }} data-tip="Dar de baja" disabled={pending} onClick={() => removeAsset(a)} aria-label={`Dar de baja ${a.name}`}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card rise d2">
          <div className="tblwrap">
            <table className="tbl">
              <thead><tr><th scope="col">Pedido</th><th scope="col">Proveedor</th><th scope="col">Cantidad</th><th scope="col">Valor estimado</th><th scope="col">Solicitó</th><th scope="col">Estado</th></tr></thead>
              <tbody>
                {pedidos.length === 0 ? (
                  <tr><td colSpan={6}><div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                    Todavía no hay pedidos. Los pedidos de la tienda también aparecen aquí.
                  </div></td></tr>
                ) : pedidos.map((p) => (
                  <tr className="trow" key={p.id}>
                    <td>
                      <div className="cename">{p.item}</div>
                      <div className="ceid mono">{p.code ?? '—'} · {fmt(p.orderedOn)}</div>
                    </td>
                    <td className="muted">{p.supplier || '—'}</td>
                    <td className="muted">{p.quantity}</td>
                    <td className="cename">{cop(p.estPriceCents / 100)}</td>
                    <td className="muted">{p.requestedByName ?? '—'}</td>
                    <td>
                      {state.canWrite ? (
                        <Select
                          value={p.status}
                          onChange={(v) => startTransition(async () => {
                            const result = await setPedidoStatus({ id: p.id, status: v as 'Solicitado' })
                            if (!result.ok) { addToast(result.error, 'err'); return }
                            apply(result.data, `Pedido ${v.toLowerCase()}`)
                          })}
                          options={[...INVENTORY_ORDER_STATUSES]}
                        />
                      ) : (
                        <Badge st={p.status} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <LoadMore
        loaded={tab === 'activos' ? activos.length : pedidos.length}
        total={tab === 'activos' ? state.activosTotal : state.pedidosTotal}
        loading={loadingMore}
        error={loadMoreError}
        onLoadMore={loadMore}
        noun={tab === 'activos' ? 'activos' : 'pedidos'}
      />

      {assetOpen && (
        <div className="mwrap" onClick={() => { setAssetOpen(false); setEditing(null) }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="mhead">
              <div className="mtitle">{editing ? 'Editar activo' : 'Nuevo activo'}</div>
              <button className="ibtn" onClick={() => { setAssetOpen(false); setEditing(null) }} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
              <input className="field" value={assetForm.name} onChange={(e) => setAssetForm((f) => ({ ...f, name: e.target.value }))} placeholder='Ej. MacBook Pro 14"' />
              <div className="fg2">
                <div>
                  <div className="flabel">Categoría</div>
                  <Select value={assetForm.category} onChange={(v) => setAssetForm((f) => ({ ...f, category: v }))} options={[...ASSET_CATEGORIES]} />
                </div>
                <div>
                  <div className="flabel">Serial</div>
                  <input className="field" value={assetForm.serial} onChange={(e) => setAssetForm((f) => ({ ...f, serial: e.target.value }))} />
                </div>
              </div>
              {roster.length > 0 && (
                <>
                  <div className="flabel">Asignado a</div>
                  <Select
                    value={assetForm.employeeId}
                    onChange={(v) => setAssetForm((f) => ({ ...f, employeeId: v }))}
                    placeholder="Sin asignar"
                    options={[
                      { value: '', label: 'Sin asignar' },
                      ...roster.map((r) => ({ value: r.employeeId, label: r.fullName })),
                    ]}
                  />
                </>
              )}
              {editing && !assetForm.employeeId && (
                <>
                  {/* Only offered when nobody holds it: with a holder the
                      status must be 'Asignado', and the database enforces it. */}
                  <div className="flabel">Estado</div>
                  <Select
                    value={assetForm.status}
                    onChange={(v) => setAssetForm((f) => ({ ...f, status: v as (typeof ASSET_STATUSES)[number] }))}
                    options={ASSET_STATUSES.filter((s) => s !== 'Asignado')}
                  />
                </>
              )}
              {state.sites.length > 1 && (
                <>
                  <div className="flabel">Sucursal</div>
                  <Select
                    value={assetForm.siteId}
                    onChange={(v) => setAssetForm((f) => ({ ...f, siteId: v }))}
                    placeholder="Sin sucursal"
                    options={[
                      { value: '', label: 'Sin sucursal' },
                      ...state.sites.map((s) => ({ value: s.id, label: s.name })),
                    ]}
                  />
                </>
              )}
              <div className="flabel">Fecha de adquisición</div>
              <DatePicker ariaLabel="Fecha de adquisición" value={assetForm.acquiredOn} onChange={(v) => setAssetForm((f) => ({ ...f, acquiredOn: v }))} />
            </div>
            <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => { setAssetOpen(false); setEditing(null) }} disabled={pending}>Cancelar</button>
              <button className="btn dark" onClick={submitAsset} disabled={pending} aria-busy={pending}>
                <Check size={14} />{pending ? 'Guardando…' : 'Guardar'}
              </button>
            </div></div>
          </div>
        </div>
      )}

      {orderOpen && (
        <div className="mwrap" onClick={() => setOrderOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Nuevo pedido</div><button className="ibtn" onClick={() => setOrderOpen(false)} aria-label="Cerrar"><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Ítem</div>
              <input className="field" value={orderForm.item} onChange={(e) => setOrderForm((f) => ({ ...f, item: e.target.value }))} placeholder="Ej. Monitor 27''" />
              <div className="flabel">Proveedor</div>
              <input className="field" value={orderForm.supplier} onChange={(e) => setOrderForm((f) => ({ ...f, supplier: e.target.value }))} />
              <div className="fg2">
                <div>
                  <div className="flabel">Cantidad</div>
                  <input className="field" type="number" min={1} value={orderForm.quantity} onChange={(e) => setOrderForm((f) => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div>
                  <div className="flabel">Valor estimado (COP)</div>
                  <input className="field" type="number" min={0} value={orderForm.price} onChange={(e) => setOrderForm((f) => ({ ...f, price: e.target.value }))} placeholder="0" />
                </div>
              </div>
            </div>
            <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => setOrderOpen(false)} disabled={pending}>Cancelar</button>
              <button className="btn dark" onClick={submitOrder} disabled={pending} aria-busy={pending}>
                <Plus size={14} />{pending ? 'Registrando…' : 'Registrar pedido'}
              </button>
            </div></div>
          </div>
        </div>
      )}
    </>
  )
}
