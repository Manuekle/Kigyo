'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Store, Check, Trash2, DollarSign, Search, XCircle,
  FileSpreadsheet, Receipt, AlertTriangle, Printer, Settings,
} from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import FormDrawer from '@/components/ui/FormDrawer'
import Toggle from '@/components/ui/Toggle'
import { useApp } from '@/lib/context/AppContext'
import { useExport } from '@/lib/hooks/use-export'
import { PAYMENT_METHODS } from '@/lib/domain'
import { cop } from '@/lib/utils'
import type { PosData, ReceiptPrefs, SaleRow, SellableRow } from '@/server/queries/pos'
import { anularVenta, cobrarPago, saveReceiptPrefs } from '@/server/mutations/pos'
import { fetchPos } from '@/server/actions/pos'

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

/** El recibo es una vista: la fila de venta ya guarda todo lo que imprime. */
function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c] ?? c)
}

const RECEIPT_DATE = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

/**
 * Imprime un recibo de 80 o 58 mm.
 *
 * En un iframe oculto y no en `window.open`: la impresión ocurre después de
 * un await (el cobro), donde ya no hay gesto de usuario y los bloqueadores
 * de ventanas sí se niegan. El iframe imprime solo su documento, y se
 * desmonta cuando el diálogo termina.
 */
function printReceipt(sale: SaleRow, prefs: ReceiptPrefs, orgName: string) {
  const rows = sale.items.map((i) => `
    <tr>
      <td class="qty">${i.quantity}</td>
      <td class="name">${esc(i.name)}</td>
      <td class="amt">${pesos(i.totalCents)}</td>
    </tr>`).join('')

  const html = `<!doctype html><html><head><meta charset="utf-8">
    <style>
      @page { size: ${prefs.width}mm auto; margin: 3mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
             font-size: 11px; color: #000; }
      .head { text-align: center; font-weight: 700; font-size: 13px;
              margin-bottom: 4px; }
      .meta { margin-bottom: 6px; }
      .meta div { display: flex; justify-content: space-between; }
      .items { width: 100%; border-top: 1px dashed #000;
               border-bottom: 1px dashed #000; margin: 6px 0; }
      .items td { padding: 2px 0; vertical-align: top; }
      .qty { width: 18px; text-align: right; padding-right: 4px; }
      .name { word-break: break-word; }
      .amt { text-align: right; white-space: nowrap; }
      .totals div { display: flex; justify-content: space-between; }
      .totals .grand { font-size: 14px; font-weight: 700; margin-top: 2px; }
      .foot { text-align: center; margin-top: 8px; }
    </style></head><body>
    ${prefs.showLogo && orgName ? `<div class="head">${esc(orgName)}</div>` : ''}
    <div class="meta">
      <div><span>Venta</span><span>${esc(sale.code ?? '')}</span></div>
      <div><span>Fecha</span><span>${RECEIPT_DATE.format(new Date(sale.soldAt))}</span></div>
      <div><span>Cliente</span><span>${esc(sale.customerName || 'Mostrador')}</span></div>
    </div>
    <table class="items">${rows}</table>
    <div class="totals">
      <div><span>Subtotal</span><span>${pesos(sale.subtotalCents)}</span></div>
      ${sale.discountCents > 0
        ? `<div><span>Descuento</span><span>-${pesos(sale.discountCents)}</span></div>`
        : ''}
      <div class="grand"><span>Total</span><span>${pesos(sale.totalCents)}</span></div>
      <div><span>Pago</span><span>${esc(sale.paymentMethod)}</span></div>
    </div>
    <div class="foot">${esc(prefs.footer)}</div>
    </body></html>`

  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.position = 'fixed'
  frame.style.right = '100%'
  frame.style.bottom = '100%'
  frame.style.width = '1px'
  frame.style.height = '1px'
  document.body.appendChild(frame)

  const doc = frame.contentDocument
  if (!doc) { frame.remove(); return }
  doc.open()
  doc.write(html)
  doc.close()

  frame.contentWindow?.addEventListener('afterprint', () => frame.remove(), { once: true })
  // Un tick para que el documento del iframe aplane estilos antes de medir.
  setTimeout(() => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
  }, 120)
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

function SimulatedPaymentDialog({
  paymentMethod,
  amountCents,
  pending,
  onOutcome,
}: {
  paymentMethod: string
  amountCents: number
  pending: boolean
  onOutcome: (status: 'APPROVED' | 'DECLINED') => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center' }}>
      <Badge st="Pago simulado" tone="amb" />
      <div className="cename" style={{ fontSize: 17 }}>{pesos(amountCents)}</div>
      <div className="elsub">Medio: {paymentMethod}</div>
      <div className="elsub">
        No hay dinero real moviéndose. La confirmación usa el mismo camino del webhook.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn dark" disabled={pending} onClick={() => onOutcome('APPROVED')}>
          <Check size={15} />Simular aprobación
        </button>
        <button className="btn" disabled={pending} onClick={() => onOutcome('DECLINED')}>
          Simular rechazo
        </button>
      </div>
    </div>
  )
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
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [prefsForm, setPrefsForm] = useState({ width: '80', footer: '', showLogo: true })
  const [qrEmail, setQrEmail] = useState('')
  const [qrOpen, setQrOpen] = useState(false)
  const [paymentState, setPaymentState] = useState<{
    saleId: string; saleCode: string; amountCents: number
    qrUrl: string | null; redirectUrl: string | null
    simulated: boolean; transactionId: string; paymentMethod: string
  } | null>(null)
  const scanRef = useRef<HTMLInputElement>(null)

  const vendibles = useMemo(() => {
    const needle = fold(query.trim())
    return state.vendibles.filter(
      (p) => !needle
        || fold(p.name).includes(needle)
        || fold(p.sku).includes(needle)
        || fold(p.barcode).includes(needle),
    )
  }, [state.vendibles, query])

  /**
   * Escaneo por teclado (keyboard wedge): el lector USB teclea el código y
   * termina con Enter, como si lo hubiera escrito una persona. Si el código
   * coincide exactamente con el de un producto, entra al carrito directo —
   * un código es único por empresa, así que el empate exacto es el producto.
   */
  function onScanKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const needle = fold(query.trim())
    if (!needle) return
    const match = state.vendibles.find(
      (p) => p.barcode && fold(p.barcode) === needle,
    )
    if (!match) return
    e.preventDefault()
    add(match)
    setQuery('')
    scanRef.current?.focus()
  }

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

  const paymentMethods = [...PAYMENT_METHODS, ...(state.qrEnabled ? ['QR Wompi' as const] : [])]

  function watchPayment(saleId: string, saleCode: string) {
    let tries = 0
    const timer = setInterval(async () => {
      tries += 1
      const fresh = await fetchPos()
      if (!fresh) return
      setState(fresh)
      const sale = fresh.ventas.find((v) => v.id === saleId)
      if (!sale) return
      if (sale.status === 'Pagada') {
        clearInterval(timer)
        setQrOpen(false)
        setPaymentState(null)
        addToast(`Venta ${saleCode} cobrada`, 'ok')
      } else if (sale.status === 'Anulada' || tries >= 40) {
        clearInterval(timer)
        setQrOpen(false)
        setPaymentState(null)
        addToast('El pago no se confirmó; la venta quedó pendiente para anular', 'info')
      }
    }, 3000)
  }

  function charge() {
    if (cart.length === 0) return
    if (paymentMethod === 'QR Wompi') {
      setQrOpen(true)
      return
    }
    startTransition(async () => {
      const result = await cobrarPago({
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
      if (result.data.qr) {
        setPaymentState({ ...result.data.qr, paymentMethod })
        clearCart()
        setQrOpen(true)
        watchPayment(result.data.qr.saleId, result.data.qr.saleCode)
        return
      }
      addToast(
        result.data.saleCode ? `Venta ${result.data.saleCode} cobrada` : 'Venta cobrada',
        'ok',
      )
      clearCart()
      // Mostrador: la venta termina con el recibo en la mano, no con un clic
      // de más. La reimpresión sigue disponible en la pestaña Ventas.
      const sale = result.data.saleCode
        ? result.data.ventas.find((v) => v.code === result.data.saleCode)
        : result.data.ventas[0]
      if (sale) printReceipt(sale, result.data.receiptPrefs, result.data.orgName)
    })
  }

  /** Genera la intención de pago: la venta nace Pendiente y el QR se muestra. */
  function submitQr() {
    if (!qrEmail.trim() || !/\S+@\S+\.\S+/.test(qrEmail.trim())) {
      addToast('Escribe el correo del cliente para el recibo', 'err')
      return
    }
    startTransition(async () => {
      const result = await cobrarPago({
        items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        paymentMethod: 'QR Wompi',
        customerName,
        customerEmail: qrEmail.trim(),
        discountCents,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      if (!result.data.qr) { addToast('No se pudo preparar el pago.', 'err'); return }
      setPaymentState({ ...result.data.qr, paymentMethod: 'QR Wompi' })
      addToast(`Venta ${result.data.qr.saleCode} pendiente de pago`, 'info')
      clearCart()
      watchPayment(result.data.qr.saleId, result.data.qr.saleCode)
    })
  }

  /** La simulación firma como el proveedor: el único camino a «Pagada». */
  function simulatePayment(status: 'APPROVED' | 'DECLINED') {
    if (!paymentState) return
    startTransition(async () => {
      try {
        const response = await fetch('/api/wompi/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId: paymentState.transactionId, status }),
        })
        if (!response.ok) {
          addToast('No se pudo simular el pago', 'err')
          return
        }
      } catch {
        addToast('No se pudo simular el pago', 'err')
        return
      }
      const fresh = await fetchPos()
      if (fresh) setState(fresh)
    })
  }

  function submitPrefs() {
    startTransition(async () => {
      const result = await saveReceiptPrefs({
        width: Number(prefsForm.width),
        footer: prefsForm.footer.trim(),
        showLogo: prefsForm.showLogo,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setPrefsOpen(false)
      addToast('Preferencias del recibo guardadas', 'ok')
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
            {state.canWrite && (
              <button className="btn" aria-label="Recibo" title="Preferencias del recibo"
                onClick={() => {
                  setPrefsForm({
                    width: String(state.receiptPrefs.width),
                    footer: state.receiptPrefs.footer,
                    showLogo: state.receiptPrefs.showLogo,
                  })
                  setPrefsOpen(true)
                }}>
                <Settings size={15} />
              </button>
            )}
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
                    ref={scanRef}
                    className="nav-find-input"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onScanKeyDown}
                    placeholder="Buscar por nombre o SKU · escanea y pulsa Enter"
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
                  options={[...paymentMethods]} />

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
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                          {v.status !== 'Anulada' && (
                            <button className="ibtn" aria-label={`Reimprimir recibo de ${v.code ?? ''}`}
                              title="Reimprimir recibo"
                              onClick={() => printReceipt(v, state.receiptPrefs, state.orgName)}>
                              <Printer size={15} />
                            </button>
                          )}
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

      <FormDrawer
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        title="Recibo"
        footer={
          <div style={{ display: 'flex', gap: 9 }}>
            <button className="btn" onClick={() => setPrefsOpen(false)} disabled={pending}>
              Cancelar
            </button>
            <button className="btn dark" onClick={submitPrefs} disabled={pending} aria-busy={pending}>
              <Check size={15} />Guardar
            </button>
          </div>
        }
      >
        <div className="flabel" style={{ marginTop: 0 }}>Ancho del papel</div>
        <Select
          value={prefsForm.width}
          onChange={(v) => setPrefsForm((p) => ({ ...p, width: v }))}
          options={[
            { value: '80', label: '80 mm — térmica estándar' },
            { value: '58', label: '58 mm — portátil' },
          ]}
        />

        <label className="flabel" htmlFor="prefs-footer">Texto del pie</label>
        <input id="prefs-footer" className="field" maxLength={120}
          value={prefsForm.footer}
          onChange={(e) => setPrefsForm((p) => ({ ...p, footer: e.target.value }))}
          placeholder="Gracias por su compra" />

        <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="cename">Encabezado con el nombre</div>
            <div className="elsub">Muestra la empresa arriba del recibo</div>
          </div>
          <Toggle
            on={prefsForm.showLogo}
            ariaLabel="Mostrar nombre de la empresa"
            onChange={(v) => setPrefsForm((p) => ({ ...p, showLogo: v }))}
          />
        </div>
      </FormDrawer>

      <FormDrawer
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        title={paymentState ? `Pago pendiente · ${paymentState.saleCode}` : 'Preparar pago'}
        footer={paymentState ? (
          <button className="btn" onClick={() => { setQrOpen(false); setPaymentState(null) }}>
            Cerrar (la venta queda pendiente)
          </button>
        ) : (
          <button className="btn dark" disabled={pending} onClick={submitQr}>
            <Check size={15} />Preparar pago
          </button>
        )}
      >
        {paymentState ? (
          paymentState.simulated ? (
            <SimulatedPaymentDialog
              paymentMethod={paymentState.paymentMethod}
              amountCents={paymentState.amountCents}
              pending={pending}
              onOutcome={simulatePayment}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center' }}>
              {paymentState.qrUrl ? (
                // El QR viene de Wompi como URL; se muestra tal cual. Sin la
                // URL (método no QR), el cliente paga por el enlace.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={paymentState.qrUrl} alt="QR de pago Wompi" width={220} height={220} />
              ) : (
                <a className="btn dark" href={paymentState.redirectUrl ?? undefined} target="_blank" rel="noreferrer">
                  Abrir pago en Wompi
                </a>
              )}
              <div className="cename" style={{ fontSize: 17 }}>{pesos(paymentState.amountCents)}</div>
              <div className="elsub">
                Escanea con la app de tu banco. La venta se confirma sola cuando el pago llega;
                no cobres en efectivo mientras tanto.
              </div>
            </div>
          )
        ) : (
          <>
             <div className="elsub" style={{ marginBottom: 12 }}>
               La venta se registra como pendiente y la confirmación llega sola cuando el
               pago se aprueba.
            </div>
            <label className="flabel" htmlFor="qr-email">Correo del cliente</label>
            <input id="qr-email" className="field" type="email" value={qrEmail}
              placeholder="cliente@correo.com"
              onChange={(e) => setQrEmail(e.target.value)} />
          </>
        )}
      </FormDrawer>
    </>
  )
}
