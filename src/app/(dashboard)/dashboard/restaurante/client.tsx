'use client'

import { useMemo, useState, useTransition } from 'react'
import { Restaurant, FileSpreadsheet, Check, Plus, Trash2, DollarSign, LayoutGrid, Clock, PenLine } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import Toggle from '@/components/ui/Toggle'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import { useExport } from '@/lib/hooks/use-export'
import {
  DELIVERY_STATUSES, INGREDIENT_UNITS, MENU_CATEGORIES, PAYMENT_METHODS,
  RESTAURANT_ORDER_STATUSES, TABLE_RESERVATION_STATUSES, TABLE_STATUSES, foodCostPct,
} from '@/lib/domain'
import { cop } from '@/lib/utils'
import type { MenuItemRow, OrderRow, RestauranteData } from '@/server/queries/restaurante'
import {
  abrirCaja, abrirComanda, agregarInsumo, cerrarCaja, crearDomicilio, crearReserva,
  createMesa, createPlato, eliminarInsumo, eliminarReserva, setComandaStatus,
  setDomicilioStatus, setMesaStatus, setPlatoDisponible, setReservaStatus, updatePlato,
} from '@/server/mutations/restaurante'
import { fetchMoreComandas } from '@/server/actions/restaurante'

const TIME = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
})

function formatTime(iso: string | null): string {
  return iso ? TIME.format(new Date(iso)) : '—'
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
  menuItemId: string
  description: string
  quantity: string
  unitPrice: string
  notes: string
}

const EMPTY_ITEM: DraftItem = {
  menuItemId: '', description: '', quantity: '1', unitPrice: '', notes: '',
}
const EMPTY_ORDER = { tableId: '', waiterId: '', guests: '2', notes: '' }
const EMPTY_DISH = {
  name: '', category: 'Plato fuerte', description: '', price: '', cost: '',
  prepMinutes: '', allergens: '',
}
const EMPTY_TABLE = { label: '', zone: '', seats: '2', siteId: '' }
const EMPTY_RESERVA = {
  guestName: '', guestPhone: '', partySize: '2', reservedAt: '', tableId: '', notes: '',
}
const EMPTY_INSUMO = { name: '', quantity: '1', unit: 'g', cost: '' }
const EMPTY_CAJA = { openedBy: '', float: '', notes: '' }
const EMPTY_DOMICILIO = { orderId: '', address: '', phone: '', courierId: '', fee: '' }

/** Day, month and time — a booking is read as "jue 14, 8:00 p. m.". */
function formatWhen(iso: string): string {
  return TIME.format(new Date(iso))
}

/** Chip colour for a booking: kept, pending, or money lost. */
function reservaTone(status: string): 'grn' | 'amb' | 'red' | 'neu' | 'blu' {
  if (status === 'Cumplida') return 'grn'
  if (status === 'Sentada') return 'blu'
  if (status === 'No show') return 'red'
  if (status === 'Cancelada') return 'neu'
  return 'amb'
}

/** Open comandas are everything still being served. */
function isOpen(status: string): boolean {
  return status !== 'Pagada' && status !== 'Anulada'
}

export default function RestaurantePage({ data }: { data: RestauranteData }) {
  const { addToast } = useApp()
  const { runExport, exporting } = useExport()
  const [pending, startTransition] = useTransition()

  const [pedidos, setPedidos] = useState<OrderRow[]>(data.pedidos)
  const [total, setTotal] = useState(data.pedidosTotal)
  const [items, setItems] = useState(data.items)
  const [menu, setMenu] = useState(data.menu)
  const [mesas, setMesas] = useState(data.mesas)
  const [reservas, setReservas] = useState(data.reservas)
  const [insumos, setInsumos] = useState(data.insumos)
  const [cajas, setCajas] = useState(data.cajas)
  const [domicilios, setDomicilios] = useState(data.domicilios)
  const [reservaOpen, setReservaOpen] = useState(false)
  const [reservaForm, setReservaForm] = useState(EMPTY_RESERVA)
  /** The dish an ingredient is being added to, or null when the sheet is shut. */
  const [insumoItemId, setInsumoItemId] = useState<string | null>(null)
  const [insumoForm, setInsumoForm] = useState(EMPTY_INSUMO)
  const [cajaOpen, setCajaOpen] = useState(false)
  const [cajaForm, setCajaForm] = useState(EMPTY_CAJA)
  const [domicilioOpen, setDomicilioOpen] = useState(false)
  const [domicilioForm, setDomicilioForm] = useState(EMPTY_DOMICILIO)
  /** La comanda que se está cobrando, o null. Ver `changeStatus`. */
  const [cobroPedido, setCobroPedido] = useState<OrderRow | null>(null)
  const [cobroForm, setCobroForm] = useState({ tip: '', method: 'Efectivo' })
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const [tab, setTab] = useState('comandas')
  const [statusFilter, setStatusFilter] = useState('Abiertas')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [orderOpen, setOrderOpen] = useState(false)
  const [dishOpen, setDishOpen] = useState(false)
  const [tableOpen, setTableOpen] = useState(false)
  const [dishEditId, setDishEditId] = useState<string | null>(null)
  const [orderForm, setOrderForm] = useState(EMPTY_ORDER)
  const [draftItems, setDraftItems] = useState<DraftItem[]>([{ ...EMPTY_ITEM }])
  const [dishForm, setDishForm] = useState(EMPTY_DISH)
  const [tableForm, setTableForm] = useState(EMPTY_TABLE)

  function apply(next: RestauranteData) {
    setPedidos(next.pedidos)
    setTotal(next.pedidosTotal)
    setItems(next.items)
    setMenu(next.menu)
    setMesas(next.mesas)
    setReservas(next.reservas)
    setInsumos(next.insumos)
    setCajas(next.cajas)
    setDomicilios(next.domicilios)
  }

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreComandas(pedidos.length)
      if (!result.ok) { setLoadMoreError(result.error); return }
      setPedidos((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        return [...prev, ...result.data.rows.filter((r) => !seen.has(r.id))]
      })
      setTotal(result.data.total)
    })
  }

  const waiterName = useMemo(() => {
    const byId = new Map(data.roster.map((r) => [r.employeeId, r.fullName]))
    return (id: string | null) => (id ? byId.get(id) ?? '—' : 'Sin mesero')
  }, [data.roster])

  const stats = useMemo(() => {
    const paid = pedidos.filter((p) => p.status === 'Pagada')
    const sales = paid.reduce((s, p) => s + p.totalCents, 0)
    return {
      open: pedidos.filter((p) => isOpen(p.status)).length,
      free: mesas.filter((m) => m.status === 'Libre').length,
      sales,
      ticket: paid.length > 0 ? Math.round(sales / paid.length) : 0,
    }
  }, [pedidos, mesas])

  const visible = pedidos.filter((p) =>
    statusFilter === 'Abiertas' ? isOpen(p.status)
      : statusFilter === 'Todas' ? true
      : p.status === statusFilter,
  )

  /* ─── reservas ─── */
  function submitReserva() {
    if (!reservaForm.guestName.trim()) { addToast('Escribe a nombre de quién.', 'err'); return }
    if (!reservaForm.reservedAt) { addToast('Indica fecha y hora.', 'err'); return }
    startTransition(async () => {
      const result = await crearReserva({
        guestName: reservaForm.guestName,
        guestPhone: reservaForm.guestPhone,
        partySize: Number(reservaForm.partySize) || 2,
        // `datetime-local` has no zone; the Date constructor reads it as local
        // time, which is what the person typing it meant.
        reservedAt: new Date(reservaForm.reservedAt).toISOString(),
        tableId: orNull(reservaForm.tableId),
        status: 'Confirmada',
        notes: reservaForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setReservaOpen(false)
      setReservaForm(EMPTY_RESERVA)
      addToast('Reserva creada', 'ok')
    })
  }

  function changeReserva(id: string, status: string) {
    startTransition(async () => {
      const result = await setReservaStatus(id, status as never)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
    })
  }

  function removeReserva(r: { id: string; guestName: string }) {
    if (!window.confirm(`¿Eliminar la reserva de ${r.guestName}?`)) return
    startTransition(async () => {
      const result = await eliminarReserva(r.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Reserva eliminada', 'info')
    })
  }

  /* ─── costeo ─── */
  function submitInsumo() {
    if (!insumoItemId) return
    if (!insumoForm.name.trim()) { addToast('Escribe el insumo.', 'err'); return }
    const quantity = Number(insumoForm.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      addToast('La cantidad debe ser mayor que cero.', 'err'); return
    }
    startTransition(async () => {
      const result = await agregarInsumo({
        menuItemId: insumoItemId,
        name: insumoForm.name,
        quantity,
        unit: insumoForm.unit as never,
        costCents: toCents(insumoForm.cost),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setInsumoItemId(null)
      setInsumoForm(EMPTY_INSUMO)
      addToast('Insumo agregado', 'ok')
    })
  }

  function removeInsumo(id: string) {
    startTransition(async () => {
      const result = await eliminarInsumo(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
    })
  }

  /* ─── caja ─── */
  function submitCaja() {
    startTransition(async () => {
      const result = await abrirCaja({
        openedBy: orNull(cajaForm.openedBy),
        openingFloatCents: toCents(cajaForm.float),
        notes: cajaForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setCajaOpen(false)
      setCajaForm(EMPTY_CAJA)
      addToast('Caja abierta', 'ok')
    })
  }

  function closeCaja(id: string) {
    // The count is the whole point of closing, so it is asked for at the
    // moment of closing rather than left as a field to fill in later.
    const answer = window.prompt('¿Cuánto hay contado en la caja? (COP)', '')
    if (answer === null) return
    startTransition(async () => {
      const result = await cerrarCaja({ id, countedCents: toCents(answer), closedBy: null, notes: '' })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Caja cerrada', 'ok')
    })
  }

  /* ─── domicilios ─── */
  function submitDomicilio() {
    if (!domicilioForm.orderId) { addToast('Elige la comanda.', 'err'); return }
    if (domicilioForm.address.trim().length < 4) { addToast('Escribe la dirección.', 'err'); return }
    startTransition(async () => {
      const result = await crearDomicilio({
        orderId: domicilioForm.orderId,
        address: domicilioForm.address,
        phone: domicilioForm.phone,
        courierId: orNull(domicilioForm.courierId),
        feeCents: toCents(domicilioForm.fee),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setDomicilioOpen(false)
      setDomicilioForm(EMPTY_DOMICILIO)
      addToast('Domicilio creado', 'ok')
    })
  }

  function changeDomicilio(id: string, status: string) {
    startTransition(async () => {
      const result = await setDomicilioStatus(id, status as never)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
    })
  }

  const exportRows = () => {
    void runExport(
      menu.map((m) => ({
        Nombre: m.name,
        Categoría: m.category,
        Precio: pesos(m.priceCents),
        Costo: pesos(m.costCents),
        Estado: m.isAvailable ? 'Disponible' : 'Agotado',
      })),
      'restaurante-kigyo',
      'restaurante',
    )
  }

  /**
   * Mover la comanda.
   *
   * Cobrar se sale por su propio panel: son dos preguntas —- propina y medio de
   * pago—- y encadenar dos `window.prompt` es peor que uno, que ya era malo.
   * El medio de pago importa más de lo que parece: solo el efectivo llega al
   * cajón, así que es lo que decide si esta comanda cuenta para el arqueo.
   */
  function changeStatus(p: OrderRow, status: string) {
    if (status === 'Pagada') {
      setCobroPedido(p)
      setCobroForm({ tip: '', method: 'Efectivo' })
      return
    }
    startTransition(async () => {
      const result = await setComandaStatus({ id: p.id, status: status as never, tipCents: null })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`Comanda ${status.toLowerCase()}`, 'ok')
    })
  }

  function cobrar() {
    const pedido = cobroPedido
    if (!pedido) return
    startTransition(async () => {
      const result = await setComandaStatus({
        id: pedido.id,
        status: 'Pagada' as never,
        tipCents: cobroForm.tip.trim() === '' ? null : toCents(cobroForm.tip),
        paymentMethod: cobroForm.method as (typeof PAYMENT_METHODS)[number],
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setCobroPedido(null)
      addToast('Comanda pagada', 'ok')
    })
  }

  function changeTable(id: string, status: string) {
    startTransition(async () => {
      const result = await setMesaStatus({ id, status: status as never })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
    })
  }

  function toggleDish(id: string, isAvailable: boolean) {
    startTransition(async () => {
      const result = await setPlatoDisponible({ id, isAvailable })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
    })
  }

  function submitOrder() {
    startTransition(async () => {
      const result = await abrirComanda({
        tableId: orderForm.tableId || null,
        waiterId: orderForm.waiterId || null,
        guests: orderForm.guests || 1,
        notes: orderForm.notes,
        items: draftItems.map((item) => ({
          menuItemId: item.menuItemId || null,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: toCents(item.unitPrice),
          notes: item.notes,
        })),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setOrderForm(EMPTY_ORDER)
      setDraftItems([{ ...EMPTY_ITEM }])
      setOrderOpen(false)
      addToast('Comanda abierta', 'ok')
    })
  }

  function openEditDish(m: MenuItemRow) {
    setDishForm({
      name: m.name,
      category: m.category,
      description: m.description,
      price: String(Math.round(m.priceCents / 100)),
      cost: String(Math.round(m.costCents / 100)),
      prepMinutes: m.prepMinutes === null ? '' : String(m.prepMinutes),
      allergens: m.allergens,
    })
    setDishEditId(m.id)
    setDishOpen(true)
  }

  function submitDish() {
    startTransition(async () => {
      const payload = {
        name: dishForm.name,
        category: dishForm.category as never,
        description: dishForm.description,
        priceCents: toCents(dishForm.price),
        costCents: toCents(dishForm.cost),
        prepMinutes: orNull(dishForm.prepMinutes),
        allergens: dishForm.allergens,
      }
      const result = dishEditId
        ? await updatePlato({ id: dishEditId, ...payload })
        : await createPlato(payload)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setDishForm(EMPTY_DISH)
      setDishEditId(null)
      setDishOpen(false)
      addToast(dishEditId ? 'Plato actualizado' : 'Plato creado', 'ok')
    })
  }

  function submitTable() {
    startTransition(async () => {
      const result = await createMesa({
        label: tableForm.label,
        zone: tableForm.zone,
        seats: tableForm.seats || 2,
        siteId: tableForm.siteId || null,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setTableForm(EMPTY_TABLE)
      setTableOpen(false)
      addToast('Mesa creada', 'ok')
    })
  }

  const subtotalPreview = draftItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * toCents(item.unitPrice), 0,
  )

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat icon={<Restaurant size={16} />} tone="blu" label="Comandas abiertas"
            value={stats.open} />
        </div>
        <div className="rise d2">
          <Stat icon={<LayoutGrid size={16} />} tone="grn" label="Mesas libres"
            value={stats.free} sub={`de ${mesas.length} mesas`} />
        </div>
        <div className="rise d3">
          <Stat icon={<DollarSign size={16} />} tone="vio" label="Ventas"
            value={pesos(stats.sales)} />
        </div>
        <div className="rise d4">
          <Stat icon={<Clock size={16} />} tone="amb" label="Ticket promedio"
            value={pesos(stats.ticket)} />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <TabBar
            items={[
              { key: 'comandas', label: 'Comandas' },
              { key: 'reservas', label: 'Reservas' },
              { key: 'menu', label: 'Menú' },
              { key: 'costeo', label: 'Costeo' },
              { key: 'mesas', label: 'Mesas' },
              { key: 'domicilios', label: 'Domicilios' },
              { key: 'caja', label: 'Caja' },
            ]}
            value={tab}
            onChange={setTab}
          />
          <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportRows}><FileSpreadsheet size={15} />Exportar</button>
          {data.canWrite && (
            <div style={{ display: 'flex', gap: 8 }}>
              {tab === 'menu' || tab === 'costeo' ? (
                <button className="btn dark" disabled={pending} onClick={() => setDishOpen(true)}>
                  <Plus size={15} />Plato
                </button>
              ) : tab === 'mesas' ? (
                <button className="btn dark" disabled={pending} onClick={() => setTableOpen(true)}>
                  <Plus size={15} />Mesa
                </button>
              ) : tab === 'reservas' ? (
                <button className="btn dark" disabled={pending} onClick={() => setReservaOpen(true)}>
                  <Plus size={15} />Reserva
                </button>
              ) : tab === 'domicilios' ? (
                <button className="btn dark" disabled={pending} onClick={() => setDomicilioOpen(true)}>
                  <Plus size={15} />Domicilio
                </button>
              ) : tab === 'caja' ? (
                /* Disabled while a till is already open: the database allows
                   one at a time (cash_sessions_one_open), and a button that
                   only ever returns an error is worse than one that is off. */
                <button className="btn dark"
                  disabled={pending || cajas.some((c) => c.status === 'Abierta')}
                  data-tip={cajas.some((c) => c.status === 'Abierta') ? 'Ya hay una caja abierta' : undefined}
                  onClick={() => setCajaOpen(true)}>
                  <Plus size={15} />Caja
                </button>
              ) : (
                <button className="btn dark" disabled={pending}
                  onClick={() => { setDraftItems([{ ...EMPTY_ITEM }]); setOrderOpen(true) }}>
                  <Plus size={15} />Comanda
                </button>
              )}
            </div>
          )}
        </div>

        {tab === 'comandas' && (
          <>
            <div className="cpad" style={{ paddingBottom: 0 }}>
              <div style={{ maxWidth: 220 }}>
                <Select value={statusFilter} onChange={setStatusFilter}
                  options={['Abiertas', 'Todas', ...RESTAURANT_ORDER_STATUSES]} />
              </div>
            </div>

            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Comanda</th>
                    <th scope="col">Mesa</th>
                    <th scope="col">Mesero</th>
                    <th scope="col">Personas</th>
                    <th scope="col">Total</th>
                    <th scope="col">Abierta</th>
                    <th scope="col">Estado</th>
                    {data.canWrite && <th scope="col" aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={data.canWrite ? 8 : 7}>
                        <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                          {pedidos.length === 0
                            ? 'Todavía no hay comandas.'
                            : 'No hay comandas con ese filtro.'}
                        </div>
                      </td>
                    </tr>
                  ) : visible.map((p) => (
                    [
                      <tr key={p.id} className="trow"
                        onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                        <td>
                          <div className="cename mono">{p.code}</div>
                          <div className="elsub">{p.items} {p.items === 1 ? 'plato' : 'platos'}</div>
                        </td>
                        <td>
                          {p.tableLabel || '—'}
                          {p.siteName && <div className="elsub">{p.siteName}</div>}
                        </td>
                        <td>{waiterName(p.waiterId)}</td>
                        <td>{p.guests}</td>
                        <td>
                          {pesos(p.totalCents)}
                          {p.tipCents > 0 && <div className="elsub">propina {pesos(p.tipCents)}</div>}
                        </td>
                        <td>{formatTime(p.openedAt)}</td>
                        <td>
                          <Badge st={p.status}
                            tone={p.status === 'Pagada' ? 'grn'
                              : p.status === 'En cocina' ? 'amb'
                              : p.status === 'Anulada' ? 'neu' : 'blu'} />
                        </td>
                        {data.canWrite && (
                          <td onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <Select
                                value={p.status}
                                onChange={(next) => { if (next !== p.status) changeStatus(p, next) }}
                                options={[...RESTAURANT_ORDER_STATUSES]}
                              />
                            </div>
                          </td>
                        )}
                      </tr>,
                      expanded === p.id ? (
                        <tr key={`${p.id}-items`}>
                          <td colSpan={data.canWrite ? 8 : 7} style={{ background: 'var(--bg2)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
                              {items.filter((i) => i.orderId === p.id).map((i) => (
                                <div className="elrow" key={i.id}>
                                  <div className="eltxt">
                                    <div className="cename">{i.quantity} × {i.description}</div>
                                    {i.notes && <div className="elsub">{i.notes}</div>}
                                  </div>
                                  <div className="mono">
                                    {pesos(i.quantity * i.unitPriceCents)}
                                  </div>
                                </div>
                              ))}
                              {p.notes && (
                                <div className="elrow">
                                  <div className="eltxt elsub">Nota: {p.notes}</div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null,
                    ]
                  ))}
                </tbody>
              </table>
            </div>

            <LoadMore
              loaded={pedidos.length}
              total={total}
              loading={loadingMore}
              error={loadMoreError}
              onLoadMore={loadMore}
              noun="comandas"
            />
          </>
        )}

        {tab === 'menu' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Plato</th>
                  <th scope="col">Categoría</th>
                  <th scope="col">Precio</th>
                  <th scope="col">Costo</th>
                  <th scope="col">Margen</th>
                  <th scope="col">Disponible</th>
                  {data.canWrite && <th scope="col" aria-label="Acciones" />}
                </tr>
              </thead>
              <tbody>
                {menu.length === 0 ? (
                  <tr>
                    <td colSpan={data.canWrite ? 7 : 6}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        El menú está vacío.
                      </div>
                    </td>
                  </tr>
                ) : menu.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="cename">{m.name}</div>
                      {m.allergens && <div className="elsub">Alérgenos: {m.allergens}</div>}
                    </td>
                    <td>
                      {m.category}
                      {m.prepMinutes !== null && <div className="elsub">{m.prepMinutes} min</div>}
                    </td>
                    <td>{pesos(m.priceCents)}</td>
                    <td>{pesos(m.costCents)}</td>
                    <td>{m.marginPct === null ? '—' : `${m.marginPct}%`}</td>
                    <td>
                      {data.canWrite ? (
                        <Toggle on={m.isAvailable} ariaLabel={`${m.name} disponible`}
                          disabled={pending}
                          onChange={(next) => toggleDish(m.id, next)} />
                      ) : (
                        <Badge st={m.isAvailable ? 'Disponible' : 'Agotado'}
                          tone={m.isAvailable ? 'grn' : 'red'} />
                      )}
                    </td>
                    {data.canWrite && (
                      <td>
                        <button className="ibtn" aria-label={`Editar ${m.name}`} disabled={pending}
                          onClick={() => openEditDish(m)}>
                          <PenLine size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'mesas' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Mesa</th>
                  <th scope="col">Zona</th>
                  <th scope="col">Puestos</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {mesas.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        No hay mesas registradas.
                      </div>
                    </td>
                  </tr>
                ) : mesas.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="cename">{m.label}</div>
                      {m.siteName ? <div className="elsub">{m.siteName}</div> : null}
                    </td>
                    <td>{m.zone || '—'}</td>
                    <td>{m.seats}</td>
                    <td>
                      {data.canWrite ? (
                        <Select
                          value={m.status}
                          onChange={(next) => { if (next !== m.status) changeTable(m.id, next) }}
                          options={[...TABLE_STATUSES]}
                        />
                      ) : (
                        <Badge st={m.status}
                          tone={m.status === 'Libre' ? 'grn'
                            : m.status === 'Ocupada' ? 'red'
                            : m.status === 'Reservada' ? 'amb' : 'neu'} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ───────── Reservas ───────── */}
        {tab === 'reservas' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Reserva</th>
                  <th scope="col">A nombre de</th>
                  <th scope="col">Personas</th>
                  <th scope="col">Cuándo</th>
                  <th scope="col">Mesa</th>
                  <th scope="col">Estado</th>
                  {data.canWrite && <th scope="col" aria-label="Acciones" />}
                </tr>
              </thead>
              <tbody>
                {reservas.length === 0 ? (
                  <tr>
                    <td colSpan={data.canWrite ? 7 : 6}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        No hay reservas. Crea la primera con el botón Reserva.
                      </div>
                    </td>
                  </tr>
                ) : reservas.map((r) => (
                  <tr key={r.id}>
                    <td><div className="cename">{r.code ?? '—'}</div></td>
                    <td>
                      <div className="cename">{r.guestName}</div>
                      {r.guestPhone && <div className="ceid">{r.guestPhone}</div>}
                    </td>
                    <td>{r.partySize}</td>
                    <td>{formatWhen(r.reservedAt)}</td>
                    <td>{r.tableLabel || 'Sin asignar'}</td>
                    <td>
                      {data.canWrite ? (
                        <Select
                          value={r.status}
                          onChange={(next) => { if (next !== r.status) changeReserva(r.id, next) }}
                          options={[...TABLE_RESERVATION_STATUSES]}
                        />
                      ) : (
                        <Badge st={r.status} tone={reservaTone(r.status)} />
                      )}
                    </td>
                    {data.canWrite && (
                      <td>
                        <button className="ibtn" style={{ width: 28, height: 28, color: 'var(--redd)' }}
                          data-tip="Eliminar reserva" disabled={pending}
                          onClick={() => removeReserva(r)}
                          aria-label={`Eliminar la reserva de ${r.guestName}`}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ───────── Costeo ─────────
            One block per dish rather than a flat ingredient table: the answer
            people come here for is "what does this plate cost me", and a list
            of two hundred ingredients sorted by name never answers it. */}
        {tab === 'costeo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {menu.length === 0 ? (
              <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                Primero crea los platos del menú.
              </div>
            ) : menu.map((m) => {
              const lines = insumos.filter((i) => i.menuItemId === m.id)
              const fc = foodCostPct(m.costCents, m.priceCents)
              return (
                <div key={m.id} className="acc" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="act">{m.name}</div>
                      <div className="acs">
                        Precio {pesos(m.priceCents)} · Costo {pesos(m.costCents)}
                        {fc !== null && <> · Food cost {fc} %</>}
                        {lines.length === 0 && <> · costo escrito a mano</>}
                      </div>
                    </div>
                    {/* Under 30 % is healthy, over 40 % is where a dish stops
                        paying for itself. Shown as a chip so the kitchen can
                        scan the menu rather than compute it. */}
                    {fc !== null && (
                      <Badge st={`${fc} %`} tone={fc <= 30 ? 'grn' : fc <= 40 ? 'amb' : 'red'} />
                    )}
                  </div>

                  {lines.length > 0 && (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {lines.map((i) => (
                        <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--ink2)' }}>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            {i.name} · {i.quantity} {i.unit}
                          </span>
                          <span>{pesos(i.costCents)}</span>
                          {data.canWrite && (
                            <button className="ibtn" style={{ width: 24, height: 24, color: 'var(--redd)' }}
                              disabled={pending} onClick={() => removeInsumo(i.id)}
                              aria-label={`Quitar ${i.name} de ${m.name}`}>
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {data.canWrite && (
                    <button className="btn" style={{ height: 28, fontSize: 12.5 }}
                      disabled={pending} onClick={() => { setInsumoItemId(m.id); setInsumoForm(EMPTY_INSUMO) }}>
                      <Plus size={14} />Insumo
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ───────── Domicilios ───────── */}
        {tab === 'domicilios' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Comanda</th>
                  <th scope="col">Dirección</th>
                  <th scope="col">Repartidor</th>
                  <th scope="col">Domicilio</th>
                  <th scope="col">Total</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {domicilios.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        No hay domicilios. Crea uno desde el botón Domicilio.
                      </div>
                    </td>
                  </tr>
                ) : domicilios.map((d) => (
                  <tr key={d.id}>
                    <td><div className="cename">{d.orderCode ?? '—'}</div></td>
                    <td>
                      <div className="cename">{d.address}</div>
                      {d.phone && <div className="ceid">{d.phone}</div>}
                    </td>
                    <td>{d.courierName || 'Sin asignar'}</td>
                    <td>{pesos(d.feeCents)}</td>
                    <td>{pesos(d.totalCents)}</td>
                    <td>
                      {data.canWrite ? (
                        <Select
                          value={d.status}
                          onChange={(next) => { if (next !== d.status) changeDomicilio(d.id, next) }}
                          options={[...DELIVERY_STATUSES]}
                        />
                      ) : (
                        <Badge st={d.status} tone={d.status === 'Entregado' ? 'grn'
                          : d.status === 'Cancelado' ? 'red'
                          : d.status === 'En camino' ? 'blu' : 'amb'} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ───────── Caja ───────── */}
        {tab === 'caja' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Turno</th>
                  <th scope="col">Abrió</th>
                  <th scope="col">Base</th>
                  <th scope="col">Comandas</th>
                  <th scope="col">Esperado</th>
                  <th scope="col">Contado</th>
                  <th scope="col">Diferencia</th>
                  {data.canWrite && <th scope="col" aria-label="Acciones" />}
                </tr>
              </thead>
              <tbody>
                {cajas.length === 0 ? (
                  <tr>
                    <td colSpan={data.canWrite ? 8 : 7}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        No hay turnos de caja. Abre el primero con el botón Caja.
                      </div>
                    </td>
                  </tr>
                ) : cajas.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="cename">{c.code ?? '—'}</div>
                      <div className="ceid">{formatWhen(c.openedAt)}</div>
                    </td>
                    <td>{c.openedByName || '—'}</td>
                    <td>{pesos(c.openingFloatCents)}</td>
                    <td>{c.orders}</td>
                    <td>{c.expectedCents === null ? '—' : pesos(c.expectedCents)}</td>
                    <td>{c.countedCents === null ? '—' : pesos(c.countedCents)}</td>
                    <td>
                      {/* Zero is the outcome worth celebrating, so it gets the
                          green chip; anything else is money to explain, in
                          either direction. */}
                      {c.differenceCents === null ? (
                        <Badge st="Abierta" tone="amb" />
                      ) : (
                        <Badge
                          st={c.differenceCents === 0 ? 'Cuadra' : pesos(c.differenceCents)}
                          tone={c.differenceCents === 0 ? 'grn' : 'red'} />
                      )}
                    </td>
                    {data.canWrite && (
                      <td>
                        {c.status === 'Abierta' && (
                          <button className="btn" style={{ height: 28, fontSize: 12.5 }}
                            disabled={pending} onClick={() => closeCaja(c.id)}>
                            Cerrar
                          </button>
                        )}
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
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        title="Nueva comanda"
        wide
        footer={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
            <div className="elsub" style={{ flex: 1 }}>
              Total <b>{pesos(subtotalPreview)}</b>
            </div>
            <button className="btn dark" disabled={pending} onClick={submitOrder}>
              <Check size={15} />Abrir comanda
            </button>
          </div>
        }
      >
        <div className="fg2">
          <div>
            <div className="flabel">Mesa</div>
            <Select value={orderForm.tableId}
              onChange={(v) => setOrderForm({ ...orderForm, tableId: v })}
              placeholder="Sin mesa (para llevar)"
              options={mesas.map((m) => ({
                value: m.id,
                label: m.status === 'Libre' ? m.label : `${m.label} · ${m.status}`,
              }))} />
          </div>
          <div>
            <label className="flabel" htmlFor="com-guests">Personas</label>
            <input id="com-guests" className="field" type="number" min={1} value={orderForm.guests}
              onChange={(e) => setOrderForm({ ...orderForm, guests: e.target.value })} />
          </div>
        </div>

        <div className="flabel">Mesero</div>
        <Select value={orderForm.waiterId}
          onChange={(v) => setOrderForm({ ...orderForm, waiterId: v })}
          placeholder="Sin asignar"
          options={data.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))} />

        <div className="flabel" style={{ marginTop: 18 }}>Platos</div>
        {draftItems.map((item, index) => (
          <div key={index} className="card" style={{ padding: 12, marginBottom: 10 }}>
            {menu.length > 0 && (
              <Select
                value={item.menuItemId}
                onChange={(v) => {
                  const dish = menu.find((m) => m.id === v)
                  setDraftItems((prev) => prev.map((row, i) => i === index ? {
                    ...row,
                    menuItemId: v,
                    description: dish ? dish.name : row.description,
                    unitPrice: dish ? String(Math.round(dish.priceCents / 100)) : row.unitPrice,
                  } : row))
                }}
                placeholder="Plato del menú"
                options={menu.filter((m) => m.isAvailable).map((m) => ({
                  value: m.id, label: `${m.name} · ${pesos(m.priceCents)}`,
                }))}
              />
            )}

            <label className="flabel" htmlFor={`ritem-desc-${index}`}>Descripción</label>
            <input id={`ritem-desc-${index}`} className="field" value={item.description}
              onChange={(e) => setDraftItems((prev) =>
                prev.map((row, i) => i === index ? { ...row, description: e.target.value } : row))} />

            <div className="fg2">
              <div>
                <label className="flabel" htmlFor={`ritem-qty-${index}`}>Cantidad</label>
                <input id={`ritem-qty-${index}`} className="field" type="number" min={1}
                  value={item.quantity}
                  onChange={(e) => setDraftItems((prev) =>
                    prev.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))} />
              </div>
              <div>
                <label className="flabel" htmlFor={`ritem-price-${index}`}>Precio</label>
                <input id={`ritem-price-${index}`} className="field" inputMode="numeric"
                  value={item.unitPrice}
                  onChange={(e) => setDraftItems((prev) =>
                    prev.map((row, i) => i === index ? { ...row, unitPrice: e.target.value } : row))} />
              </div>
            </div>

            <label className="flabel" htmlFor={`ritem-notes-${index}`}>Nota para cocina</label>
            <input id={`ritem-notes-${index}`} className="field" value={item.notes}
              onChange={(e) => setDraftItems((prev) =>
                prev.map((row, i) => i === index ? { ...row, notes: e.target.value } : row))}
              placeholder="Sin cebolla, término medio…" />

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
          <Plus size={15} />Agregar plato
        </button>

        <label className="flabel" htmlFor="com-notes">Nota general</label>
        <textarea id="com-notes" className="field" rows={2} value={orderForm.notes}
          onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={dishOpen}
        onClose={() => { setDishOpen(false); setDishEditId(null) }}
        title={dishEditId ? 'Editar plato' : 'Nuevo plato'}
        footer={
          <button className="btn dark" disabled={pending} onClick={submitDish}>
            <Check size={15} />{dishEditId ? 'Guardar cambios' : 'Crear plato'}
          </button>
        }
      >
        <label className="flabel" htmlFor="dish-name">Nombre</label>
        <input id="dish-name" className="field" value={dishForm.name}
          onChange={(e) => setDishForm({ ...dishForm, name: e.target.value })} />

        <div className="flabel">Categoría</div>
        <Select value={dishForm.category}
          onChange={(v) => setDishForm({ ...dishForm, category: v })}
          options={[...MENU_CATEGORIES]} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="dish-price">Precio (COP)</label>
            <input id="dish-price" className="field" inputMode="numeric" value={dishForm.price}
              onChange={(e) => setDishForm({ ...dishForm, price: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="dish-cost">Costo (COP)</label>
            <input id="dish-cost" className="field" inputMode="numeric" value={dishForm.cost}
              onChange={(e) => setDishForm({ ...dishForm, cost: e.target.value })} />
          </div>
        </div>

        <label className="flabel" htmlFor="dish-prep">Tiempo de preparación (min)</label>
        <input id="dish-prep" className="field" type="number" min={0} value={dishForm.prepMinutes}
          onChange={(e) => setDishForm({ ...dishForm, prepMinutes: e.target.value })} />

        <label className="flabel" htmlFor="dish-all">Alérgenos</label>
        <input id="dish-all" className="field" value={dishForm.allergens}
          onChange={(e) => setDishForm({ ...dishForm, allergens: e.target.value })}
          placeholder="Gluten, lácteos, maní…" />

        <label className="flabel" htmlFor="dish-desc">Descripción</label>
        <textarea id="dish-desc" className="field" rows={3} value={dishForm.description}
          onChange={(e) => setDishForm({ ...dishForm, description: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={tableOpen}
        onClose={() => setTableOpen(false)}
        title="Nueva mesa"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitTable}>
            <Check size={15} />Crear mesa
          </button>
        }
      >
        <label className="flabel" htmlFor="tbl-label">Nombre o número</label>
        <input id="tbl-label" className="field" value={tableForm.label}
          onChange={(e) => setTableForm({ ...tableForm, label: e.target.value })}
          placeholder="Mesa 4" />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="tbl-zone">Zona</label>
            <input id="tbl-zone" className="field" value={tableForm.zone}
              onChange={(e) => setTableForm({ ...tableForm, zone: e.target.value })}
              placeholder="Terraza, salón…" />
          </div>
          <div>
            <label className="flabel" htmlFor="tbl-seats">Puestos</label>
            <input id="tbl-seats" className="field" type="number" min={1} value={tableForm.seats}
              onChange={(e) => setTableForm({ ...tableForm, seats: e.target.value })} />
          </div>
        </div>

        {data.sites.length > 1 && (
          <>
            <label className="flabel" htmlFor="tbl-site">Sucursal</label>
            <Select
              value={tableForm.siteId}
              onChange={(v) => setTableForm({ ...tableForm, siteId: v })}
              options={[
                { value: '', label: 'Sin sucursal' },
                ...data.sites.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <p className="psub" style={{ fontSize: 12.5 }}>
              La comanda que se abra en esta mesa lleva la sucursal de la mesa.
            </p>
          </>
        )}
      </FormDrawer>

      <FormDrawer
        open={reservaOpen}
        onClose={() => setReservaOpen(false)}
        title="Nueva reserva"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitReserva}>
            <Check size={15} />Crear reserva
          </button>
        }
      >
        <label className="flabel" htmlFor="rsv-name">A nombre de</label>
        <input id="rsv-name" className="field" value={reservaForm.guestName}
          onChange={(e) => setReservaForm({ ...reservaForm, guestName: e.target.value })}
          placeholder="María López" />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="rsv-phone">Teléfono</label>
            <input id="rsv-phone" className="field" value={reservaForm.guestPhone}
              onChange={(e) => setReservaForm({ ...reservaForm, guestPhone: e.target.value })}
              placeholder="300 000 0000" />
          </div>
          <div>
            <label className="flabel" htmlFor="rsv-size">Personas</label>
            <input id="rsv-size" className="field" type="number" min={1} value={reservaForm.partySize}
              onChange={(e) => setReservaForm({ ...reservaForm, partySize: e.target.value })} />
          </div>
        </div>

        <div className="flabel">Fecha y hora</div>
        <DatePicker withTime ariaLabel="Fecha y hora" value={reservaForm.reservedAt}
          onChange={(v) => setReservaForm({ ...reservaForm, reservedAt: v })} />

        {/* Optional: most bookings are taken before anyone decides which table
            they get, and forcing the choice here would block the call. */}
        <label className="flabel">Mesa (opcional)</label>
        <Select
          value={reservaForm.tableId}
          onChange={(v) => setReservaForm({ ...reservaForm, tableId: v })}
          placeholder="Asignar después"
          options={[
            { value: '', label: 'Asignar después' },
            ...mesas.map((m) => ({ value: m.id, label: `${m.label} · ${m.seats} puestos` })),
          ]}
        />

        <label className="flabel" htmlFor="rsv-notes">Notas</label>
        <input id="rsv-notes" className="field" value={reservaForm.notes}
          onChange={(e) => setReservaForm({ ...reservaForm, notes: e.target.value })}
          placeholder="Cumpleaños, alergias, silla para bebé…" />
      </FormDrawer>

      <FormDrawer
        open={insumoItemId !== null}
        onClose={() => setInsumoItemId(null)}
        title="Agregar insumo"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitInsumo}>
            <Check size={15} />Agregar
          </button>
        }
      >
        <label className="flabel" htmlFor="ins-name">Insumo</label>
        <input id="ins-name" className="field" value={insumoForm.name}
          onChange={(e) => setInsumoForm({ ...insumoForm, name: e.target.value })}
          placeholder="Salmón, aceite de oliva…" />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="ins-qty">Cantidad</label>
            <input id="ins-qty" className="field" type="number" min={0} step="0.001"
              value={insumoForm.quantity}
              onChange={(e) => setInsumoForm({ ...insumoForm, quantity: e.target.value })} />
          </div>
          <div>
            <label className="flabel">Unidad</label>
            <Select value={insumoForm.unit}
              onChange={(v) => setInsumoForm({ ...insumoForm, unit: v })}
              options={[...INGREDIENT_UNITS]} />
          </div>
        </div>

        {/* The cost of the quantity above, not of one unit — the same thing
            the column stores, so nobody has to do the multiplication twice. */}
        <label className="flabel" htmlFor="ins-cost">Costo de esa cantidad (COP)</label>
        <input id="ins-cost" className="field" inputMode="numeric" value={insumoForm.cost}
          onChange={(e) => setInsumoForm({ ...insumoForm, cost: e.target.value })}
          placeholder="4800" />
      </FormDrawer>

      <FormDrawer
        open={cajaOpen}
        onClose={() => setCajaOpen(false)}
        title="Abrir caja"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitCaja}>
            <Check size={15} />Abrir turno
          </button>
        }
      >
        <label className="flabel">Quién abre</label>
        <Select
          value={cajaForm.openedBy}
          onChange={(v) => setCajaForm({ ...cajaForm, openedBy: v })}
          placeholder="Sin asignar"
          options={[
            { value: '', label: 'Sin asignar' },
            ...data.roster.map((r) => ({ value: r.employeeId, label: r.fullName })),
          ]}
        />

        <label className="flabel" htmlFor="caj-float">Base inicial (COP)</label>
        <input id="caj-float" className="field" inputMode="numeric" value={cajaForm.float}
          onChange={(e) => setCajaForm({ ...cajaForm, float: e.target.value })}
          placeholder="200000" />
        <p style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 4, lineHeight: 1.5 }}>
          Lo que ya hay en el cajón antes de la primera venta. Cuenta para el arqueo,
          pero no para las ventas del turno.
        </p>

        <label className="flabel" htmlFor="caj-notes">Notas</label>
        <input id="caj-notes" className="field" value={cajaForm.notes}
          onChange={(e) => setCajaForm({ ...cajaForm, notes: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={domicilioOpen}
        onClose={() => setDomicilioOpen(false)}
        title="Nuevo domicilio"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitDomicilio}>
            <Check size={15} />Crear domicilio
          </button>
        }
      >
        <label className="flabel">Comanda</label>
        <Select
          value={domicilioForm.orderId}
          onChange={(v) => setDomicilioForm({ ...domicilioForm, orderId: v })}
          placeholder="Elige la comanda"
          options={pedidos
            .filter((o) => isOpen(o.status))
            .map((o) => ({ value: o.id, label: `${o.code ?? 'Comanda'} · ${pesos(o.totalCents)}` }))}
        />

        <label className="flabel" htmlFor="dom-address">Dirección</label>
        <input id="dom-address" className="field" value={domicilioForm.address}
          onChange={(e) => setDomicilioForm({ ...domicilioForm, address: e.target.value })}
          placeholder="Calle 10 #4-32, apto 501" />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="dom-phone">Teléfono</label>
            <input id="dom-phone" className="field" value={domicilioForm.phone}
              onChange={(e) => setDomicilioForm({ ...domicilioForm, phone: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="dom-fee">Valor del domicilio (COP)</label>
            <input id="dom-fee" className="field" inputMode="numeric" value={domicilioForm.fee}
              onChange={(e) => setDomicilioForm({ ...domicilioForm, fee: e.target.value })}
              placeholder="6000" />
          </div>
        </div>

        <label className="flabel">Repartidor</label>
        <Select
          value={domicilioForm.courierId}
          onChange={(v) => setDomicilioForm({ ...domicilioForm, courierId: v })}
          placeholder="Asignar después"
          options={[
            { value: '', label: 'Asignar después' },
            ...data.roster.map((r) => ({ value: r.employeeId, label: r.fullName })),
          ]}
        />
      </FormDrawer>

      <FormDrawer
        open={cobroPedido !== null}
        onClose={() => setCobroPedido(null)}
        title={`Cobrar ${cobroPedido?.code ?? 'comanda'}`}
        footer={
          <button className="btn dark" disabled={pending} onClick={cobrar}>
            <DollarSign size={15} />Cobrar
          </button>
        }
      >
        {cobroPedido && (
          <p className="psub" style={{ fontSize: 12.5, marginTop: 0 }}>
            {cobroPedido.tableLabel ? `${cobroPedido.tableLabel} · ` : ''}
            Consumo {pesos(cobroPedido.subtotalCents)}
            {cobroForm.tip.trim() !== '' && ` + propina ${pesos(toCents(cobroForm.tip))}`}
          </p>
        )}

        <label className="flabel" htmlFor="co-tip">Propina</label>
        <input id="co-tip" className="field" inputMode="numeric" value={cobroForm.tip}
          placeholder="Vacío si no hubo"
          onChange={(e) => setCobroForm({ ...cobroForm, tip: e.target.value })} />

        <label className="flabel" htmlFor="co-method">Medio de pago</label>
        <Select value={cobroForm.method}
          onChange={(v) => setCobroForm({ ...cobroForm, method: v })}
          options={[...PAYMENT_METHODS]} />

        {/* Dicho aquí porque es la consecuencia menos evidente de este campo:
            la comanda se cobra igual, pero solo el efectivo llega al cajón y
            cuenta para el arqueo del turno. */}
        <p className="psub" style={{ fontSize: 12.5 }}>
          {cobroForm.method === 'Efectivo'
            ? 'Entra al cajón y suma al arqueo del turno abierto.'
            : 'No entra al cajón, así que no cuenta para el arqueo.'}
        </p>
      </FormDrawer>
    </>
  )
}
