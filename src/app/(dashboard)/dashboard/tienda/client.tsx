'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  ShoppingCart, Search, X, Trash2, Package, Tag, DollarSign,
  LayoutGrid, Zap, Layers, Settings,
} from '@/lib/icons'
import type { IconProps } from '@/lib/icons'
import Stat from '@/components/ui/Stat'
import Badge from '@/components/ui/Badge'
import TabBar from '@/components/ui/TabBar'
import { useApp } from '@/lib/context/AppContext'
import { cop } from '@/lib/utils'
import LoadMore from '@/components/ui/LoadMore'
import type { ProductosData, ProductoRow } from '@/server/queries/productos'
import { placeOrder } from '@/server/mutations/productos'
import { fetchMoreProductos } from '@/server/actions/productos'

/**
 * Category mark on a product card.
 *
 * Products used to carry an `imagen` field holding an emoji. Emoji render as a
 * different glyph on every platform, do not follow `currentColor`, and are
 * read aloud by name by a screen reader ("high voltage sign") — none of which
 * is what a product thumbnail is for. The category already tells us what to
 * draw, so it is derived rather than stored.
 */
const CAT_ICON: Record<string, (p: IconProps) => React.ReactElement> = {
  Paneles: LayoutGrid,
  Inversores: Zap,
  Baterías: Layers,
  Estructuras: Package,
  Servicios: Settings,
}

function CatMark({ categoria }: { categoria: string }) {
  const Icon = CAT_ICON[categoria] ?? Package
  return (
    <div className="shop-mark" aria-hidden="true">
      <Icon size={20} />
    </div>
  )
}

interface CartItem { product: ProductoRow; quantity: number }

const stockTone = (s: number) => (s > 10 ? 'grn' as const : s > 0 ? 'amb' as const : 'red' as const)

export default function TiendaPage({ data }: { data: ProductosData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState<ProductosData>(data)
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('Todas')

  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const { productos } = state

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreProductos('tienda', productos.length)
      if (!result.ok) {
        setLoadMoreError(result.error)
        return
      }
      setState((prev) => {
        const seen = new Set(prev.productos.map((p) => p.id))
        return {
          ...prev,
          productos: [...prev.productos, ...result.data.rows.filter((p) => !seen.has(p.id))],
          productosTotal: result.data.total,
        }
      })
    })
  }

  const filtered = useMemo(() => productos.filter((p) => {
    if (cat !== 'Todas' && p.category !== cat) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [productos, search, cat])

  const cartTotal = useMemo(
    () => cart.reduce((a, i) => a + i.product.priceCents * i.quantity, 0),
    [cart],
  )
  const cartCount = useMemo(() => cart.reduce((a, i) => a + i.quantity, 0), [cart])

  const stats = useMemo(() => ({
    total: state.productosTotal,
    cats: state.categories.length,
    // At price, not cost: the storefront is never sent `cost_cents`, and
    // showing a margin-derived figure here would leak it.
    value: productos.reduce((s, p) => s + p.priceCents * p.stock, 0),
    low: productos.filter((p) => p.stock > 0 && p.stock <= 10).length,
    out: productos.filter((p) => p.stock === 0).length,
  }), [productos, state.categories, state.productosTotal])

  function addCart(p: ProductoRow) {
    const inCart = cart.find((i) => i.product.id === p.id)?.quantity ?? 0
    // Checked here for the immediate message; the server re-reads stock at
    // checkout, because this copy is as old as the page.
    if (inCart + 1 > p.stock) {
      addToast(`"${p.name}" solo tiene ${p.stock} unidades disponibles`, 'warn')
      return
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === p.id)
      return existing
        ? prev.map((i) => (i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [...prev, { product: p, quantity: 1 }]
    })
  }

  const removeCart = (id: string) => setCart((prev) => prev.filter((i) => i.product.id !== id))

  function setQuantity(id: string, quantity: number) {
    if (quantity <= 0) { removeCart(id); return }
    const item = cart.find((i) => i.product.id === id)
    if (item && quantity > item.product.stock) {
      addToast(`Solo hay ${item.product.stock} unidades disponibles`, 'warn')
      return
    }
    setCart((prev) => prev.map((i) => (i.product.id === id ? { ...i, quantity } : i)))
  }

  /**
   * Checkout.
   *
   * The old one toasted "Pedido generado por $…" and emptied a local array.
   * Nothing was ordered, no stock moved, and the same unit could be "sold"
   * indefinitely. This decrements stock and files the order rows the inventory
   * screen reads.
   */
  function checkout() {
    if (cart.length === 0) { addToast('El carrito está vacío', 'warn'); return }
    startTransition(async () => {
      const result = await placeOrder({
        items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setCart([])
      addToast(`Pedido registrado por ${cop(cartTotal / 100)}`, 'ok')
    })
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat icon={<Package size={16} />} tone="blu" label="Productos" value={stats.total} /></div>
        <div className="rise d2"><Stat icon={<Tag size={16} />} tone="grn" label="Categorías" value={stats.cats} /></div>
        <div className="rise d3"><Stat icon={<DollarSign size={16} />} tone="vio" label="Valor en tienda" value={cop(stats.value / 100)} sub="a precio de venta" /></div>
        <div className="rise d4"><Stat icon={<ShoppingCart size={16} />} tone="amb" label="Stock bajo" value={stats.low + stats.out} sub={`${stats.low} bajo · ${stats.out} agotado`} /></div>
      </div>

      <div className="shop-layout">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card rise d1">
            <div className="chead" style={{ flexWrap: 'wrap', gap: 10 }}>
              <TabBar
                value={cat}
                onChange={(k) => setCat(k as string)}
                items={['Todas', ...state.categories].map((s) => ({ key: s, label: s }))}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--ink3)', pointerEvents: 'none' }} />
                  <input className="field" style={{ paddingLeft: 32, width: 200 }} placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
                  {search && <button className="ibtn" style={{ marginLeft: 4 }} onClick={() => setSearch('')} aria-label="Limpiar búsqueda"><X size={14} /></button>}
                </div>
                {/*
                  "Añadir", "Editar" and "Eliminar" used to live here, writing
                  products straight from the storefront. Products belong to the
                  catalogue — two screens creating them is how the same item
                  ended up with two prices.
                */}
              </div>
            </div>

            {productos.length === 0 ? (
              <div className="dempty" style={{ padding: '40px 0', textAlign: 'center' }}>
                No hay productos publicados en la tienda. Actívalos desde Catálogos.
              </div>
            ) : filtered.length === 0 ? (
              <div className="dempty" style={{ padding: '40px 0', textAlign: 'center' }}>No se encontraron productos con los filtros actuales.</div>
            ) : (
              <div style={{ padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(220px, 100%), 1fr))', gap: 12 }}>
                  {filtered.map((p) => (
                    <div key={p.id} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <CatMark categoria={p.category} />
                      <div className="cename" style={{ fontSize: 13 }}>{p.name}</div>
                      <div className="elsub" style={{ fontSize: 11, flex: 1 }}>{p.description}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 400, fontSize: 15 }}>{cop(p.priceCents / 100)}</span>
                        <Badge st={p.stock === 0 ? 'Agotado' : `${p.stock} ${p.unit}`} tone={stockTone(p.stock)} filled />
                      </div>
                      <button
                        className="btn dark"
                        style={{ justifyContent: 'center', fontSize: 12, height: 32 }}
                        disabled={p.stock === 0 || !state.canWrite}
                        onClick={() => addCart(p)}
                      >
                        <ShoppingCart size={13} />{p.stock === 0 ? 'Agotado' : 'Agregar'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <LoadMore
              loaded={productos.length}
              total={state.productosTotal}
              loading={loadingMore}
              error={loadMoreError}
              onLoadMore={loadMore}
              noun="productos"
            />
          </div>
        </div>

        <div className="card shop-cart">
          <div className="chead">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingCart size={15} />
              <span className="ctitle">Carrito</span>
            </div>
            {cartCount > 0 && <span className="kvs">{cartCount} {cartCount === 1 ? 'ítem' : 'ítems'}</span>}
          </div>
          <div className="cpad">
            {cart.length === 0 ? (
              <div className="dempty" style={{ padding: '18px 0' }}>El carrito está vacío.</div>
            ) : (
              <>
                {cart.map((i) => (
                  <div className="elrow" key={i.product.id}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="eltxt" style={{ fontSize: 13 }}>{i.product.name}</div>
                      <div className="elsub">{cop(i.product.priceCents / 100)} c/u</div>
                    </div>
                    <input
                      className="field"
                      type="number"
                      min={1}
                      max={i.product.stock}
                      value={i.quantity}
                      onChange={(e) => setQuantity(i.product.id, Number(e.target.value))}
                      style={{ width: 68 }}
                      aria-label={`Cantidad de ${i.product.name}`}
                    />
                    <button className="ibtn" style={{ width: 26, height: 26 }} onClick={() => removeCart(i.product.id)} aria-label={`Quitar ${i.product.name}`}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <div className="elrow" style={{ marginTop: 8, borderTop: '1px solid var(--line2)', paddingTop: 12 }}>
                  <div className="eltxt">Total</div>
                  <div className="eltxt" style={{ fontSize: 16 }}>{cop(cartTotal / 100)}</div>
                </div>
                <button
                  className="btn dark"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                  onClick={checkout}
                  disabled={pending || !state.canWrite}
                  aria-busy={pending}
                >
                  {pending ? 'Registrando…' : 'Generar pedido'}
                </button>
                <p className="psub" style={{ marginTop: 8, fontSize: 11.5 }}>
                  El pedido descuenta el stock y queda registrado en Inventario.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
