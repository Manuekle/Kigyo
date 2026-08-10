'use client'

import { useMemo, useState, useTransition } from 'react'
import { Truck, Check, Plus, Trash2, Tag, DollarSign, Package } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import Toggle from '@/components/ui/Toggle'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import { ONLINE_ORDER_STATUSES, SHIPPING_METHODS } from '@/lib/domain'
import { cop } from '@/lib/utils'
import type { EcommerceData, OnlineOrderRow } from '@/server/queries/ecommerce'
import {
  createCupon, createPedido, deletePedido, setCuponActivo, setPedidoStatus,
} from '@/server/mutations/ecommerce'
import { fetchMorePedidos } from '@/server/actions/ecommerce'

const DATE = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

function formatDate(iso: string | null): string {
  return iso ? DATE.format(new Date(iso)) : '—'
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

interface DraftItem {
  productId: string
  description: string
  quantity: string
  unitPrice: string
}

const EMPTY_ITEM: DraftItem = { productId: '', description: '', quantity: '1', unitPrice: '' }

const EMPTY_ORDER = {
  customerName: '', customerEmail: '', customerPhone: '', shippingMethod: 'Domicilio',
  shippingAddress: '', shippingCity: '', shipping: '', couponCode: '', notes: '',
}

const EMPTY_COUPON = {
  code: '', discountKind: 'percent', percentOff: '10', amountOff: '',
  minTotal: '', maxUses: '', startsOn: '', expiresOn: '',
}

/** Open orders are everything not yet delivered, cancelled or returned. */
function isOpen(status: string): boolean {
  return status !== 'Entregado' && status !== 'Cancelado' && status !== 'Devuelto'
}

export default function EcommercePage({ data }: { data: EcommerceData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [pedidos, setPedidos] = useState<OnlineOrderRow[]>(data.pedidos)
  const [total, setTotal] = useState(data.pedidosTotal)
  const [items, setItems] = useState(data.items)
  const [cupones, setCupones] = useState(data.cupones)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const [tab, setTab] = useState('pedidos')
  const [statusFilter, setStatusFilter] = useState('Abiertos')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [orderOpen, setOrderOpen] = useState(false)
  const [couponOpen, setCouponOpen] = useState(false)
  const [orderForm, setOrderForm] = useState(EMPTY_ORDER)
  const [draftItems, setDraftItems] = useState<DraftItem[]>([{ ...EMPTY_ITEM }])
  const [couponForm, setCouponForm] = useState(EMPTY_COUPON)

  function apply(next: EcommerceData) {
    setPedidos(next.pedidos)
    setTotal(next.pedidosTotal)
    setItems(next.items)
    setCupones(next.cupones)
  }

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMorePedidos(pedidos.length)
      if (!result.ok) { setLoadMoreError(result.error); return }
      setPedidos((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        return [...prev, ...result.data.rows.filter((r) => !seen.has(r.id))]
      })
      setTotal(result.data.total)
    })
  }

  const stats = useMemo(() => {
    const sold = pedidos.filter((p) => p.status !== 'Cancelado' && p.status !== 'Devuelto')
    const revenue = sold.reduce((s, p) => s + p.totalCents, 0)
    return {
      open: pedidos.filter((p) => isOpen(p.status)).length,
      revenue,
      // Average order value, over orders that actually stuck. Including
      // cancellations would flatter it downward and refunds upward.
      average: sold.length > 0 ? Math.round(revenue / sold.length) : 0,
      toShip: pedidos.filter((p) => p.status === 'Pagado' || p.status === 'En preparación').length,
    }
  }, [pedidos])

  const visible = pedidos.filter((p) =>
    statusFilter === 'Abiertos' ? isOpen(p.status)
      : statusFilter === 'Todos' ? true
      : p.status === statusFilter,
  )

  const subtotalPreview = draftItems.reduce(
    (sum, item) => sum + Math.round((Number(item.quantity) || 0) * toCents(item.unitPrice)), 0,
  )

  function changeStatus(p: OnlineOrderRow, status: string) {
    // Only ask for a tracking number where one exists — a pickup order has none
    // and a prompt on every transition trains people to dismiss it.
    let tracking = ''
    if (status === 'Enviado' && p.shippingMethod !== 'Recoge en tienda') {
      tracking = window.prompt('Número de guía (opcional):', p.trackingCode)?.trim() ?? ''
    }
    startTransition(async () => {
      const result = await setPedidoStatus({ id: p.id, status: status as never, trackingCode: tracking })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`Pedido ${status.toLowerCase()}`, 'ok')
    })
  }

  function remove(p: OnlineOrderRow) {
    if (!window.confirm(`¿Eliminar ${p.code ?? 'este pedido'}? Se eliminan también sus líneas.`)) return
    startTransition(async () => {
      const result = await deletePedido(p.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Pedido eliminado', 'ok')
    })
  }

  function toggleCoupon(id: string, isActive: boolean) {
    startTransition(async () => {
      const result = await setCuponActivo({ id, isActive })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
    })
  }

  function submitOrder() {
    startTransition(async () => {
      const result = await createPedido({
        customerName: orderForm.customerName,
        customerEmail: orderForm.customerEmail || null,
        customerPhone: orderForm.customerPhone,
        shippingMethod: orderForm.shippingMethod as never,
        shippingAddress: orderForm.shippingAddress,
        shippingCity: orderForm.shippingCity,
        shippingCents: toCents(orderForm.shipping),
        couponCode: orderForm.couponCode,
        notes: orderForm.notes,
        items: draftItems.map((item) => ({
          productId: item.productId || null,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: toCents(item.unitPrice),
        })),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setOrderForm(EMPTY_ORDER)
      setDraftItems([{ ...EMPTY_ITEM }])
      setOrderOpen(false)
      addToast('Pedido creado', 'ok')
    })
  }

  function submitCoupon() {
    const percent = couponForm.discountKind === 'percent'
    startTransition(async () => {
      const result = await createCupon({
        code: couponForm.code,
        percentOff: percent ? couponForm.percentOff : null,
        amountOffCents: percent ? null : toCents(couponForm.amountOff),
        minTotalCents: toCents(couponForm.minTotal),
        maxUses: orNull(couponForm.maxUses),
        startsOn: orNull(couponForm.startsOn),
        expiresOn: orNull(couponForm.expiresOn),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setCouponForm(EMPTY_COUPON)
      setCouponOpen(false)
      addToast('Cupón creado', 'ok')
    })
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat icon={<Package size={16} />} tone="blu" label="Pedidos abiertos"
            value={stats.open} sub={`de ${pedidos.length} recibidos`} />
        </div>
        <div className="rise d2">
          <Stat icon={<Truck size={16} />} tone="amb" label="Por despachar" value={stats.toShip} />
        </div>
        <div className="rise d3">
          <Stat icon={<DollarSign size={16} />} tone="grn" label="Ventas"
            value={pesos(stats.revenue)} />
        </div>
        <div className="rise d4">
          <Stat icon={<Tag size={16} />} tone="vio" label="Ticket promedio"
            value={pesos(stats.average)} />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <TabBar
            items={[
              { key: 'pedidos', label: 'Pedidos' },
              { key: 'cupones', label: 'Cupones' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {data.canWrite && (
            <div style={{ display: 'flex', gap: 8 }}>
              {tab === 'cupones' ? (
                <button className="btn dark" disabled={pending} onClick={() => setCouponOpen(true)}>
                  <Plus size={15} />Cupón
                </button>
              ) : (
                <button className="btn dark" disabled={pending}
                  onClick={() => { setDraftItems([{ ...EMPTY_ITEM }]); setOrderOpen(true) }}>
                  <Plus size={15} />Pedido
                </button>
              )}
            </div>
          )}
        </div>

        {tab === 'pedidos' && (
          <>
            <div className="cpad" style={{ paddingBottom: 0 }}>
              <div style={{ maxWidth: 220 }}>
                <Select value={statusFilter} onChange={setStatusFilter}
                  options={['Abiertos', 'Todos', ...ONLINE_ORDER_STATUSES]} />
              </div>
            </div>

            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Pedido</th>
                    <th scope="col">Cliente</th>
                    <th scope="col">Envío</th>
                    <th scope="col">Total</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Estado</th>
                    {data.canWrite && <th scope="col" aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={data.canWrite ? 7 : 6}>
                        <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                          {pedidos.length === 0
                            ? 'Todavía no hay pedidos en línea.'
                            : 'No hay pedidos con ese filtro.'}
                        </div>
                      </td>
                    </tr>
                  ) : visible.map((p) => {
                    const lines = items.filter((i) => i.orderId === p.id)
                    return [
                      <tr key={p.id} className="trow"
                        onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                        <td>
                          <div className="cename mono">{p.code}</div>
                          <div className="elsub">{p.items} {p.items === 1 ? 'ítem' : 'ítems'}</div>
                        </td>
                        <td>
                          <div className="cename">{p.customerName}</div>
                          <div className="elsub">{p.customerEmail ?? p.customerPhone ?? '—'}</div>
                        </td>
                        <td>
                          {p.shippingMethod}
                          {p.shippingCity && <div className="elsub">{p.shippingCity}</div>}
                          {p.trackingCode && <div className="elsub mono">{p.trackingCode}</div>}
                        </td>
                        <td>
                          {pesos(p.totalCents)}
                          {p.discountCents > 0 && (
                            <div className="elsub">−{pesos(p.discountCents)} {p.couponCode}</div>
                          )}
                        </td>
                        <td>{formatDate(p.placedAt)}</td>
                        <td>
                          <Badge st={p.status}
                            tone={p.status === 'Entregado' ? 'grn'
                              : p.status === 'Enviado' ? 'blu'
                              : p.status === 'Cancelado' || p.status === 'Devuelto' ? 'red' : 'amb'} />
                        </td>
                        {data.canWrite && (
                          <td onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <Select
                                value={p.status}
                                onChange={(next) => { if (next !== p.status) changeStatus(p, next) }}
                                options={[...ONLINE_ORDER_STATUSES]}
                              />
                              <button className="ibtn" aria-label={`Eliminar ${p.code}`}
                                disabled={pending} onClick={() => remove(p)}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>,
                      expanded === p.id ? (
                        <tr key={`${p.id}-detail`}>
                          <td colSpan={data.canWrite ? 7 : 6} style={{ background: 'var(--bg2)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
                              {lines.map((i) => (
                                <div className="elrow" key={i.id}>
                                  <div className="eltxt">
                                    <div className="cename">{i.description}</div>
                                    <div className="elsub">
                                      {i.quantity} × {pesos(i.unitPriceCents)}
                                    </div>
                                  </div>
                                  <div className="mono">
                                    {pesos(Math.round(i.quantity * i.unitPriceCents))}
                                  </div>
                                </div>
                              ))}
                              <div className="elrow">
                                <div className="eltxt elsub">
                                  Subtotal {pesos(p.subtotalCents)} · Envío {pesos(p.shippingCents)}
                                  {p.discountCents > 0 && ` · Descuento −${pesos(p.discountCents)}`}
                                </div>
                                <div className="cename mono">{pesos(p.totalCents)}</div>
                              </div>
                              {p.shippingAddress && (
                                <div className="elrow">
                                  <div className="eltxt elsub">
                                    Entregar en: {p.shippingAddress}
                                    {p.shippingCity && `, ${p.shippingCity}`}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null,
                    ]
                  })}
                </tbody>
              </table>
            </div>

            <LoadMore
              loaded={pedidos.length}
              total={total}
              loading={loadingMore}
              error={loadMoreError}
              onLoadMore={loadMore}
              noun="pedidos"
            />
          </>
        )}

        {tab === 'cupones' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Descuento</th>
                  <th scope="col">Mínimo</th>
                  <th scope="col">Usos</th>
                  <th scope="col">Vigencia</th>
                  <th scope="col">Activo</th>
                </tr>
              </thead>
              <tbody>
                {cupones.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        No hay cupones creados.
                      </div>
                    </td>
                  </tr>
                ) : cupones.map((c) => (
                  <tr key={c.id}>
                    <td className="cename mono">{c.code}</td>
                    <td>
                      {c.percentOff !== null ? `${c.percentOff}%` : pesos(c.amountOffCents ?? 0)}
                    </td>
                    <td>{c.minTotalCents > 0 ? pesos(c.minTotalCents) : '—'}</td>
                    <td>{c.usedCount}{c.maxUses !== null && ` / ${c.maxUses}`}</td>
                    <td>
                      {c.startsOn || c.expiresOn
                        ? `${c.startsOn ?? '—'} → ${c.expiresOn ?? '—'}`
                        : 'Sin límite'}
                    </td>
                    <td>
                      {data.canWrite ? (
                        <Toggle
                          on={c.isActive}
                          ariaLabel={`Cupón ${c.code} activo`}
                          disabled={pending}
                          onChange={(next) => toggleCoupon(c.id, next)}
                        />
                      ) : (
                        <Badge st={c.isActive ? 'Activo' : 'Inactivo'}
                          tone={c.isActive ? 'grn' : 'neu'} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FormDrawer
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        title="Nuevo pedido"
        wide
        footer={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
            <div className="elsub" style={{ flex: 1 }}>
              Subtotal <b>{pesos(subtotalPreview)}</b> · el descuento se calcula al guardar
            </div>
            <button className="btn dark" disabled={pending} onClick={submitOrder}>
              <Check size={15} />Crear pedido
            </button>
          </div>
        }
      >
        <label className="flabel" htmlFor="ord-name">Comprador</label>
        <input id="ord-name" className="field" value={orderForm.customerName}
          onChange={(e) => setOrderForm({ ...orderForm, customerName: e.target.value })} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="ord-mail">Correo</label>
            <input id="ord-mail" className="field" type="email" value={orderForm.customerEmail}
              onChange={(e) => setOrderForm({ ...orderForm, customerEmail: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="ord-phone">Teléfono</label>
            <input id="ord-phone" className="field" value={orderForm.customerPhone}
              onChange={(e) => setOrderForm({ ...orderForm, customerPhone: e.target.value })} />
          </div>
        </div>

        <div className="flabel">Método de envío</div>
        <Select value={orderForm.shippingMethod}
          onChange={(v) => setOrderForm({ ...orderForm, shippingMethod: v })}
          options={[...SHIPPING_METHODS]} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="ord-addr">Dirección</label>
            <input id="ord-addr" className="field" value={orderForm.shippingAddress}
              onChange={(e) => setOrderForm({ ...orderForm, shippingAddress: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="ord-city">Ciudad</label>
            <input id="ord-city" className="field" value={orderForm.shippingCity}
              onChange={(e) => setOrderForm({ ...orderForm, shippingCity: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="ord-ship">Costo de envío (COP)</label>
            <input id="ord-ship" className="field" inputMode="numeric" value={orderForm.shipping}
              onChange={(e) => setOrderForm({ ...orderForm, shipping: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="ord-coupon">Cupón</label>
            <input id="ord-coupon" className="field" value={orderForm.couponCode}
              onChange={(e) => setOrderForm({ ...orderForm, couponCode: e.target.value.toUpperCase() })}
              placeholder="BIENVENIDA10" />
          </div>
        </div>

        <div className="flabel" style={{ marginTop: 18 }}>Productos</div>
        {draftItems.map((item, index) => (
          <div key={index} className="card" style={{ padding: 12, marginBottom: 10 }}>
            {data.productos.length > 0 && (
              <Select
                value={item.productId}
                onChange={(v) => {
                  const product = data.productos.find((p) => p.id === v)
                  setDraftItems((prev) => prev.map((row, i) => i === index ? {
                    ...row,
                    productId: v,
                    description: product ? product.name : row.description,
                    unitPrice: product ? String(Math.round(product.priceCents / 100)) : row.unitPrice,
                  } : row))
                }}
                placeholder="Producto del catálogo (opcional)"
                options={data.productos.map((p) => ({ value: p.id, label: `${p.sku} · ${p.name}` }))}
              />
            )}

            <label className="flabel" htmlFor={`eitem-desc-${index}`}>Descripción</label>
            <input id={`eitem-desc-${index}`} className="field" value={item.description}
              onChange={(e) => setDraftItems((prev) =>
                prev.map((row, i) => i === index ? { ...row, description: e.target.value } : row))} />

            <div className="fg2">
              <div>
                <label className="flabel" htmlFor={`eitem-qty-${index}`}>Cantidad</label>
                <input id={`eitem-qty-${index}`} className="field" type="number" min={0} step="1"
                  value={item.quantity}
                  onChange={(e) => setDraftItems((prev) =>
                    prev.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))} />
              </div>
              <div>
                <label className="flabel" htmlFor={`eitem-price-${index}`}>Precio unitario</label>
                <input id={`eitem-price-${index}`} className="field" inputMode="numeric"
                  value={item.unitPrice}
                  onChange={(e) => setDraftItems((prev) =>
                    prev.map((row, i) => i === index ? { ...row, unitPrice: e.target.value } : row))} />
              </div>
            </div>

            {draftItems.length > 1 && (
              <button className="btn" type="button" style={{ marginTop: 10 }}
                onClick={() => setDraftItems((prev) => prev.filter((_, i) => i !== index))}>
                <Trash2 size={14} />Quitar
              </button>
            )}
          </div>
        ))}

        <button className="btn" type="button"
          onClick={() => setDraftItems((prev) => [...prev, { ...EMPTY_ITEM }])}>
          <Plus size={15} />Agregar producto
        </button>

        <label className="flabel" htmlFor="ord-notes">Notas</label>
        <textarea id="ord-notes" className="field" rows={3} value={orderForm.notes}
          onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={couponOpen}
        onClose={() => setCouponOpen(false)}
        title="Nuevo cupón"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitCoupon}>
            <Check size={15} />Crear cupón
          </button>
        }
      >
        <label className="flabel" htmlFor="cup-code">Código</label>
        <input id="cup-code" className="field" value={couponForm.code}
          onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
          placeholder="BIENVENIDA10" />

        <div className="flabel">Tipo de descuento</div>
        <Select
          value={couponForm.discountKind}
          onChange={(v) => setCouponForm({ ...couponForm, discountKind: v })}
          options={[
            { value: 'percent', label: 'Porcentaje' },
            { value: 'amount', label: 'Monto fijo' },
          ]}
        />

        {couponForm.discountKind === 'percent' ? (
          <>
            <label className="flabel" htmlFor="cup-pct">Porcentaje (%)</label>
            <input id="cup-pct" className="field" type="number" min={1} max={100}
              value={couponForm.percentOff}
              onChange={(e) => setCouponForm({ ...couponForm, percentOff: e.target.value })} />
          </>
        ) : (
          <>
            <label className="flabel" htmlFor="cup-amt">Monto (COP)</label>
            <input id="cup-amt" className="field" inputMode="numeric" value={couponForm.amountOff}
              onChange={(e) => setCouponForm({ ...couponForm, amountOff: e.target.value })} />
          </>
        )}

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="cup-min">Compra mínima (COP)</label>
            <input id="cup-min" className="field" inputMode="numeric" value={couponForm.minTotal}
              onChange={(e) => setCouponForm({ ...couponForm, minTotal: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="cup-uses">Usos máximos</label>
            <input id="cup-uses" className="field" type="number" min={1} value={couponForm.maxUses}
              onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value })}
              placeholder="Sin límite" />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="cup-from">Desde</label>
            <input id="cup-from" className="field" type="date" value={couponForm.startsOn}
              onChange={(e) => setCouponForm({ ...couponForm, startsOn: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="cup-to">Hasta</label>
            <input id="cup-to" className="field" type="date" value={couponForm.expiresOn}
              onChange={(e) => setCouponForm({ ...couponForm, expiresOn: e.target.value })} />
          </div>
        </div>
      </FormDrawer>
    </>
  )
}
