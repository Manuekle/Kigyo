'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Store, Check, Trash2, DollarSign, Search, XCircle,
  FileSpreadsheet, Receipt, AlertTriangle,
} from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import { useApp } from '@/lib/context/AppContext'
import { useExport } from '@/lib/hooks/use-export'
import { PAYMENT_METHODS } from '@/lib/domain'
import { cop } from '@/lib/utils'
import type { PosData, SellableRow } from '@/server/queries/pos'
import { anularVenta, cobrarVenta } from '@/server/mutations/pos'

const DATETIME = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
})

function formatWhen(iso: string): string {
  return DATETIME.format(new Date(iso))
}

function toCents(value: string): number {
  const n = Number(value.replace(/[^\d]/g, ''))
  return Number.isFinite(n) ? Math.round(n) * 100 : 0
}

function pesos(cents: number): string {
  return cop(Math.round(cents / 100))
}

/** Igual que en el buscador del menú: nadie usa la tecla muerta al filtrar. */
function fold(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

interface CartLine {
  productId: string
  sku: string
  name: string
  unitPriceCents: number
  quantity: number
  /** Lo que había cuando se armó el carrito, para no dejar pedir de más. */
  stock: number
}

export default function PosPage({ data }: { data: PosData }) {
  const { runExport, exporting } = useExport()
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState(data)
  const [tab, setTab] = useState('vender')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [paymentMethod, setPaymentMethod] = useState('Efectivo')
  const [customerName, setCustomerName] = useState('')
  const [discount, setDiscount] = useState('')

  const vendibles = useMemo(() => {
    const needle = fold(query.trim())
    return state.vendibles.filter(
      (p) => !needle || fold(p.name).includes(needle) || fold(p.sku).includes(needle),
    )
  }, [state.vendibles, query])

  const subtotalCents = cart.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0)
  const discountCents = Math.min(toCents(discount), subtotalCents)
  const totalCents = subtotalCents - discountCents

  /**
   * Agregar al carrito.
   *
   * El tope es la existencia que se leyó al cargar la pantalla. No es la
   * autoridad —- la base vuelve a comprobarla dentro de la transacción, ver
   * `register_pos_sale`—, pero evita armar un carrito que se va a rechazar
   * entero cuando ya hay alguien esperando en el mostrador.
   */
  function add(product: SellableRow) {
    setCart((current) => {
      const existing = current.find((l) => l.productId === product.id)
      if (existing) {
        if (existing.quantity >= product.stock) {
          addToast(`"${product.name}" solo tiene ${product.stock} disponibles.`, 'info')
          return current
        }
        return current.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        )
      }
      if (product.stock < 1) {
        addToast(`"${product.name}" no tiene existencias.`, 'info')
        return current
      }
      return [...current, {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        unitPriceCents: product.priceCents,
        quantity: 1,
        stock: product.stock,
      }]
    })
  }

  function setQuantity(productId: string, quantity: number) {
    setCart((current) => current.flatMap((l) => {
      if (l.productId !== productId) return [l]
      if (quantity < 1) return []
      return [{ ...l, quantity: Math.min(quantity, l.stock) }]
    }))
  }

  function clearCart() {
    setCart([])
    setDiscount('')
    setCustomerName('')
  }

  function charge() {
    if (cart.length === 0) return
    startTransition(async () => {
      const result = await cobrarVenta({
        items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        paymentMethod: paymentMethod as (typeof PAYMENT_METHODS)[number],
        customerName,
        discountCents,
        notes: '',
      })
      if (!result.ok) {
        addToast(result.error, 'err')
        return
      }
      setState(result.data)
      addToast(
        result.data.saleCode ? `Venta ${result.data.saleCode} cobrada` : 'Venta cobrada',
        'ok',
      )
      clearCart()
    })
  }

  function anular(id: string, code: string | null) {
    startTransition(async () => {
      const result = await anularVenta(id)
      if (!result.ok) {
        addToast(result.error, 'err')
        return
      }
      setState(result.data)
      addToast(`Venta ${code ?? ''} anulada y existencias devueltas`.trim(), 'ok')
    })
  }

  function exportRows() {
    void runExport(state.ventas.map((v) => ({
      Venta: v.code ?? '', Cliente: v.customerName, Cuándo: formatWhen(v.soldAt),
      Subtotal: pesos(v.subtotalCents), Descuento: pesos(v.discountCents),
      Total: pesos(v.totalCents), Medio: v.paymentMethod, Estado: v.status,
      Líneas: v.items.length,
    })), 'ventas-mostrador', 'pos')
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat icon={<DollarSign size={16} />} tone="grn" label="Cobrado hoy"
            value={pesos(state.vendidoHoyCents)}
            sub={`${state.ventasHoy} ${state.ventasHoy === 1 ? 'venta' : 'ventas'}`} />
        </div>
        <div className="rise d2">
          <Stat icon={<Store size={16} />} tone="blu" label="En el carrito"
            value={pesos(totalCents)}
            sub={cart.length === 0
              ? 'sin líneas'
              : `${cart.length} ${cart.length === 1 ? 'línea' : 'líneas'}`} />
        </div>
        <div className="rise d3">
          <Stat icon={<Receipt size={16} />} tone="vio" label="Productos disponibles"
            value={state.vendibles.filter((p) => p.stock > 0).length}
            sub={`de ${state.vendibles.length} en el catálogo`} />
        </div>
        <div className="rise d4">
          <Stat icon={<AlertTriangle size={16} />} tone={state.cajaAbierta ? 'grn' : 'amb'}
            label="Caja"
            value={state.hasCaja ? (state.cajaAbierta ? 'Abierta' : 'Cerrada') : '—'}
            sub={state.hasCaja
              ? (state.cajaAbierta ? 'las ventas se enganchan al turno' : 'sin turno activo')
              : 'módulo no activo'} />
        </div>
      </div>

      {/* Dicho antes de cobrar, no después: una venta en efectivo sin turno
          abierto no queda en ningún arqueo, y eso se descubre al cierre. */}
      {state.hasCaja && !state.cajaAbierta && state.canWrite && (
        <div className="pos-warn rise d2" role="note">
          No hay turno de caja abierto. Puedes cobrar igual, pero estas ventas no
          entrarán en ningún arqueo. <Link href="/dashboard/caja">Abrir turno</Link>
        </div>
      )}

      <div className="card rise d2">
        <div className="chead">
          <TabBar
            items={[
              { key: 'vender', label: 'Vender' },
              { key: 'ventas', label: 'Ventas' },
            ]}
            value={tab}
            onChange={setTab}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportRows}>
              <FileSpreadsheet size={15} />Exportar
            </button>
          </div>
        </div>

        {/* ─── Vender ─────────────────────────────────────────────────── */}
        {tab === 'vender' && (
          state.vendibles.length === 0 ? (
            <div className="cpad">
              <div className="dempty" style={{ padding: '32px 0', textAlign: 'center' }}>
                No hay nada que vender.
                <div style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 8, maxWidth: 460, margin: '8px auto 0' }}>
                  El mostrador vende lo que está en <Link href="/dashboard/catalogos">Catálogos</Link>,
                  activo y con existencias.
                </div>
              </div>
            </div>
          ) : (
            <div className="pos-layout">
              <div className="pos-grid-side">
                <div className="nav-find" style={{ margin: '0 0 12px' }}>
                  <Search size={14} />
                  <input
                    className="nav-find-input"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por nombre o SKU"
                    aria-label="Buscar producto"
                  />
                </div>

                <div className="pos-grid">
                  {vendibles.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="pos-tile"
                      disabled={!state.canWrite || p.stock < 1 || pending}
                      onClick={() => add(p)}
                    >
                      <span className="pos-tile-name">{p.name}</span>
                      <span className="pos-tile-price">{pesos(p.priceCents)}</span>
                      <span className="pos-tile-stock">
                        {p.stock > 0 ? `${p.stock} ${p.unit}` : 'Sin existencias'}
                      </span>
                    </button>
                  ))}
                  {vendibles.length === 0 && (
                    <p className="nav-empty">Ningún producto coincide con «{query.trim()}».</p>
                  )}
                </div>
              </div>

              <div className="pos-cart">
                <div className="pos-cart-head">Venta</div>

                {cart.length === 0 ? (
                  <p className="nav-empty" style={{ padding: '24px 4px' }}>
                    Toca un producto para agregarlo.
                  </p>
                ) : (
                  <div className="pos-lines">
                    {cart.map((l) => (
                      <div key={l.productId} className="pos-line">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="pos-line-name">{l.name}</div>
                          <div className="elsub">{pesos(l.unitPriceCents)} c/u</div>
                        </div>
                        <input
                          className="field pos-qty"
                          inputMode="numeric"
                          value={l.quantity}
                          aria-label={`Cantidad de ${l.name}`}
                          onChange={(e) => setQuantity(l.productId, Number(e.target.value.replace(/\D/g, '')) || 0)}
                        />
                        <div className="pos-line-total">{pesos(l.unitPriceCents * l.quantity)}</div>
                        <button className="ibtn" aria-label={`Quitar ${l.name}`}
                          onClick={() => setQuantity(l.productId, 0)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="caja-breakdown" style={{ marginTop: 12 }}>
                  <div><span>Subtotal</span><b>{pesos(subtotalCents)}</b></div>
                  {discountCents > 0 && (
                    <div><span>Descuento</span><b>− {pesos(discountCents)}</b></div>
                  )}
                  <div className="caja-total"><span>Total</span><b>{pesos(totalCents)}</b></div>
                </div>

                <label className="flabel" htmlFor="pv-customer">Cliente</label>
                <input id="pv-customer" className="field" value={customerName} maxLength={160}
                  placeholder="Opcional"
                  onChange={(e) => setCustomerName(e.target.value)} />

                <label className="flabel" htmlFor="pv-discount">Descuento</label>
                <input id="pv-discount" className="field" inputMode="numeric" value={discount}
                  placeholder="0"
                  onChange={(e) => setDiscount(e.target.value)} />

                <label className="flabel" htmlFor="pv-method">Medio de pago</label>
                <Select value={paymentMethod} onChange={setPaymentMethod}
                  options={[...PAYMENT_METHODS]} />

                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button className="btn" disabled={pending || cart.length === 0} onClick={clearCart}>
                    <XCircle size={15} />Limpiar
                  </button>
                  <button className="btn dark" style={{ flex: 1 }}
                    disabled={pending || cart.length === 0 || !state.canWrite}
                    onClick={charge}>
                    <Check size={15} />Cobrar {pesos(totalCents)}
                  </button>
                </div>
              </div>
            </div>
          )
        )}

        {/* ─── Ventas ─────────────────────────────────────────────────── */}
        {tab === 'ventas' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Venta</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Líneas</th>
                  <th scope="col">Total</th>
                  <th scope="col">Medio</th>
                  <th scope="col">Estado</th>
                  {state.canWrite && <th scope="col" aria-label="Acciones" />}
                </tr>
              </thead>
              <tbody>
                {state.ventas.length === 0 ? (
                  <tr>
                    <td colSpan={state.canWrite ? 7 : 6}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        Todavía no se ha cobrado nada.
                      </div>
                    </td>
                  </tr>
                ) : state.ventas.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <div className="cename mono">{v.code ?? '—'}</div>
                      <div className="elsub">{formatWhen(v.soldAt)}</div>
                    </td>
                    <td>{v.customerName || 'Mostrador'}</td>
                    <td>
                      {v.items.length}
                      <div className="elsub">
                        {v.items.slice(0, 2).map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                        {v.items.length > 2 ? '…' : ''}
                      </div>
                    </td>
                    <td>
                      {pesos(v.totalCents)}
                      {v.discountCents > 0 && (
                        <div className="elsub">− {pesos(v.discountCents)} dto.</div>
                      )}
                    </td>
                    <td><Badge st={v.paymentMethod} tone="neu" /></td>
                    <td>
                      <Badge st={v.status} tone={v.status === 'Anulada' ? 'red' : 'grn'} />
                    </td>
                    {state.canWrite && (
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          {v.status === 'Anulada' ? (
                            <span className="elsub">—</span>
                          ) : (
                            <button className="ibtn" aria-label={`Anular venta ${v.code ?? ''}`}
                              disabled={pending}
                              onClick={() => anular(v.id, v.code)}>
                              <XCircle size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
