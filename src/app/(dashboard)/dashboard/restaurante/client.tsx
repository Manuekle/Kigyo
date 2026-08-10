'use client'

import { useMemo, useState, useTransition } from 'react'
import { Restaurant, Check, Plus, Trash2, DollarSign, LayoutGrid, Clock } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import Toggle from '@/components/ui/Toggle'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import {
  MENU_CATEGORIES, RESTAURANT_ORDER_STATUSES, TABLE_STATUSES,
} from '@/lib/domain'
import { cop } from '@/lib/utils'
import type { OrderRow, RestauranteData } from '@/server/queries/restaurante'
import {
  abrirComanda, createMesa, createPlato, setComandaStatus,
  setMesaStatus, setPlatoDisponible,
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
const EMPTY_TABLE = { label: '', zone: '', seats: '2' }

/** Open comandas are everything still being served. */
function isOpen(status: string): boolean {
  return status !== 'Pagada' && status !== 'Anulada'
}

export default function RestaurantePage({ data }: { data: RestauranteData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [pedidos, setPedidos] = useState<OrderRow[]>(data.pedidos)
  const [total, setTotal] = useState(data.pedidosTotal)
  const [items, setItems] = useState(data.items)
  const [menu, setMenu] = useState(data.menu)
  const [mesas, setMesas] = useState(data.mesas)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const [tab, setTab] = useState('comandas')
  const [statusFilter, setStatusFilter] = useState('Abiertas')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [orderOpen, setOrderOpen] = useState(false)
  const [dishOpen, setDishOpen] = useState(false)
  const [tableOpen, setTableOpen] = useState(false)
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

  function changeStatus(p: OrderRow, status: string) {
    // The tip is only knowable at payment, so it is asked for exactly then.
    let tip: number | null = null
    if (status === 'Pagada') {
      const answer = window.prompt('Propina (COP), deja vacío si no hubo:', '')
      if (answer !== null && answer.trim() !== '') tip = toCents(answer)
    }
    startTransition(async () => {
      const result = await setComandaStatus({ id: p.id, status: status as never, tipCents: tip })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`Comanda ${status.toLowerCase()}`, 'ok')
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

  function submitDish() {
    startTransition(async () => {
      const result = await createPlato({
        name: dishForm.name,
        category: dishForm.category as never,
        description: dishForm.description,
        priceCents: toCents(dishForm.price),
        costCents: toCents(dishForm.cost),
        prepMinutes: orNull(dishForm.prepMinutes),
        allergens: dishForm.allergens,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setDishForm(EMPTY_DISH)
      setDishOpen(false)
      addToast('Plato creado', 'ok')
    })
  }

  function submitTable() {
    startTransition(async () => {
      const result = await createMesa({
        label: tableForm.label,
        zone: tableForm.zone,
        seats: tableForm.seats || 2,
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
              { key: 'menu', label: 'Menú' },
              { key: 'mesas', label: 'Mesas' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {data.canWrite && (
            <div style={{ display: 'flex', gap: 8 }}>
              {tab === 'menu' ? (
                <button className="btn dark" disabled={pending} onClick={() => setDishOpen(true)}>
                  <Plus size={15} />Plato
                </button>
              ) : tab === 'mesas' ? (
                <button className="btn dark" disabled={pending} onClick={() => setTableOpen(true)}>
                  <Plus size={15} />Mesa
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
                        <td>{p.tableLabel || '—'}</td>
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
                </tr>
              </thead>
              <tbody>
                {menu.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
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
                    <td><div className="cename">{m.label}</div></td>
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
        onClose={() => setDishOpen(false)}
        title="Nuevo plato"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitDish}>
            <Check size={15} />Crear plato
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
      </FormDrawer>
    </>
  )
}
