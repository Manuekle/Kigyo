'use client'

import { useMemo, useState, useTransition } from 'react'
import { Plus, Trash2, PenLine, X, Search, Package, DollarSign, TrendingUp, Layers } from '@/lib/icons'
import Stat from '@/components/ui/Stat'
import Badge from '@/components/ui/Badge'
import TabBar from '@/components/ui/TabBar'
import Select from '@/components/ui/Select'
import FormDrawer from '@/components/ui/FormDrawer'
import Toggle from '@/components/ui/Toggle'
import { useApp } from '@/lib/context/AppContext'
import { useConfirm } from '@/lib/context/ConfirmContext'
import { cop } from '@/lib/utils'
import { PRODUCT_UNITS } from '@/lib/domain'
import LoadMore from '@/components/ui/LoadMore'
import type { ProductosData, ProductoRow } from '@/server/queries/productos'
import { createProducto, deleteProducto, updateProducto } from '@/server/mutations/productos'
import { fetchMoreProductos } from '@/server/actions/productos'

const UNIT_LABEL: Record<string, string> = {
  UN: 'Unidad', KIT: 'Kit', RL: 'Rollo', KW: 'kW', SERV: 'Servicio', M: 'Metro', HR: 'Hora',
}
const UNIT_OPTIONS = PRODUCT_UNITS.map((u) => ({ value: u, label: UNIT_LABEL[u] ?? u }))

/** Margin over price. 0 when there is no price to divide by. */
const margin = (priceCents: number, costCents: number) =>
  priceCents > 0 ? Math.round(((priceCents - costCents) / priceCents) * 100) : 0

const EMPTY = {
  sku: '', barcode: '', name: '', category: '', description: '', unit: 'UN',
  price: '', cost: '', stock: '', supplier: '', isActive: true, inStorefront: true,
}

type FormState = typeof EMPTY

function toForm(p: ProductoRow): FormState {
  return {
    sku: p.sku,
    barcode: p.barcode ?? '',
    name: p.name,
    category: p.category,
    description: p.description,
    unit: p.unit,
    // Cents in the column, pesos in the field.
    price: String(p.priceCents / 100),
    cost: String((p.costCents ?? 0) / 100),
    stock: String(p.stock),
    supplier: p.supplier,
    isActive: p.isActive,
    inStorefront: p.inStorefront,
  }
}

export default function CatalogosPage({ data }: { data: ProductosData }) {
  const { addToast } = useApp()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState<ProductosData>(data)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('Todas')
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<ProductoRow | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)

  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const { productos } = state

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreProductos('catalogos', productos.length)
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
    if (search && !`${p.name} ${p.sku} ${p.supplier}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [productos, search, cat])

  const stats = useMemo(() => {
    // Inventory value at *cost*, which is what it is worth to the company.
    const value = productos.reduce((s, p) => s + (p.costCents ?? 0) * p.stock, 0)
    const margins = productos.filter((p) => p.priceCents > 0).map((p) => margin(p.priceCents, p.costCents ?? 0))
    return {
      total: state.productosTotal,
      cats: state.categories.length,
      value,
      avgMargin: margins.length > 0 ? Math.round(margins.reduce((a, b) => a + b, 0) / margins.length) : 0,
      inactive: productos.filter((p) => !p.isActive).length,
    }
  }, [productos, state.categories, state.productosTotal])

  function payload(f: FormState) {
    return {
      sku: f.sku.trim(),
      barcode: f.barcode.trim(),
      name: f.name.trim(),
      category: f.category.trim() || 'Otro',
      description: f.description.trim(),
      unit: f.unit as (typeof PRODUCT_UNITS)[number],
      priceCents: Math.round((Number(f.price) || 0) * 100),
      costCents: Math.round((Number(f.cost) || 0) * 100),
      stock: Math.max(0, Math.round(Number(f.stock) || 0)),
      supplier: f.supplier.trim(),
      isActive: f.isActive,
      inStorefront: f.inStorefront,
    }
  }

  function submitNew() {
    if (!form.name.trim() || !form.sku.trim()) { addToast('Nombre y SKU son obligatorios', 'err'); return }
    startTransition(async () => {
      const result = await createProducto(payload(form))
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setAddOpen(false)
      setForm(EMPTY)
      addToast('Producto agregado al catálogo', 'ok')
    })
  }

  function submitEdit() {
    if (!editing) return
    if (!form.name.trim() || !form.sku.trim()) { addToast('Nombre y SKU son obligatorios', 'err'); return }
    startTransition(async () => {
      const result = await updateProducto({ id: editing.id, ...payload(form) })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setEditing(null)
      addToast('Producto actualizado', 'ok')
    })
  }

  async function remove(p: ProductoRow) {
    if (!(await confirm({ title: `¿Eliminar "${p.name}"?`, description: 'Seguirá apareciendo en las cotizaciones y órdenes donde ya se usó.', tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deleteProducto(p.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast(`"${p.name}" eliminado`, 'info')
    })
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat icon={<Package size={16} />} tone="blu" label="Productos" value={stats.total} /></div>
        <div className="rise d2"><Stat icon={<Layers size={16} />} tone="grn" label="Categorías" value={stats.cats} /></div>
        <div className="rise d3"><Stat icon={<DollarSign size={16} />} tone="vio" label="Valor inventario" value={cop(stats.value / 100)} sub="a costo" /></div>
        <div className="rise d4"><Stat icon={<TrendingUp size={16} />} tone="amb" label="Margen promedio" value={`${stats.avgMargin}%`} sub={stats.inactive > 0 ? `${stats.inactive} inactivos` : undefined} /></div>
      </div>

      <div className="card rise d1">
        <div className="chead" style={{ flexWrap: 'wrap', gap: 10 }}>
          {/* Categories come from the products themselves, not a fixed list of
              solar parts every organization was assumed to sell. */}
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
            {state.canWrite && (
              <button className="btn dark" onClick={() => { setForm(EMPTY); setAddOpen(true) }}><Plus size={14} />Nuevo producto</button>
            )}
          </div>
        </div>

        {productos.length === 0 ? (
          <div className="dempty" style={{ padding: '40px 0', textAlign: 'center' }}>
            {state.canWrite ? 'Todavía no hay productos. Crea el primero.' : 'Todavía no hay productos.'}
          </div>
        ) : filtered.length === 0 ? (
          <div className="dempty" style={{ padding: '40px 0', textAlign: 'center' }}>No se encontraron productos con los filtros actuales.</div>
        ) : (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Producto</th>
                  <th scope="col">Categoría</th>
                  <th scope="col">Precio / Costo</th>
                  <th scope="col">Margen</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Tienda</th>
                  <th scope="col"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr className="trow" key={p.id}>
                    <td>
                      <div className="cename">{p.name}</div>
                      <div className="ceid" style={{ display: 'flex', gap: 8 }}>
                        <span className="mono">{p.sku}</span>
                        <span className="muted">{p.supplier || '—'}</span>
                      </div>
                    </td>
                    <td className="muted">{p.category}</td>
                    <td>
                      <div className="cename">{cop(p.priceCents / 100)}</div>
                      <div className="elsub">{cop((p.costCents ?? 0) / 100)} costo</div>
                    </td>
                    <td>
                      <Badge
                        st={`${margin(p.priceCents, p.costCents ?? 0)}%`}
                        tone={p.priceCents > (p.costCents ?? 0) ? 'grn' : 'red'}
                        filled
                      />
                    </td>
                    <td>
                      <Badge
                        st={`${p.stock} ${p.unit}`}
                        tone={p.stock > 10 ? 'grn' : p.stock > 0 ? 'amb' : 'red'}
                        filled
                      />
                    </td>
                    <td>
                      {/* Two independent flags: `is_active` retires a product
                          from procurement, `in_storefront` only hides it from
                          the shop. The old page had one boolean for both. */}
                      <Badge
                        st={!p.isActive ? 'Inactivo' : p.inStorefront ? 'En tienda' : 'Solo interno'}
                        tone={!p.isActive ? 'neu' : p.inStorefront ? 'grn' : 'amb'}
                        filled
                      />
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {state.canWrite && (
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button className="ibtn" style={{ width: 30, height: 30, borderRadius: 9 }} data-tip="Editar" onClick={() => { setForm(toForm(p)); setEditing(p) }} aria-label={`Editar ${p.name}`}><PenLine size={14} /></button>
                          <button className="ibtn" style={{ width: 30, height: 30, borderRadius: 9, color: 'var(--redd)' }} data-tip="Eliminar" disabled={pending} onClick={() => remove(p)} aria-label={`Eliminar ${p.name}`}><Trash2 size={14} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {(addOpen || editing) && (
        <ProductoModal
          title={editing ? 'Editar producto' : 'Nuevo producto'}
          form={form}
          setForm={setForm}
          busy={pending}
          categories={state.categories}
          onClose={() => { setAddOpen(false); setEditing(null) }}
          onSubmit={editing ? submitEdit : submitNew}
        />
      )}
    </>
  )
}

function ProductoModal({
  title, form, setForm, busy, categories, onClose, onSubmit,
}: {
  title: string
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  busy: boolean
  categories: string[]
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    // Eight fields plus two toggles. In a 440px dialog the toggles sat below
    // the fold and the Guardar button below them again.
    <FormDrawer
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <span />
          <div style={{ display: 'flex', gap: 9 }}>
            <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
            <button className="btn dark" onClick={onSubmit} disabled={busy} aria-busy={busy}>
              <Plus size={14} />{busy ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </>
      }
    >
          <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
          <input className="field" placeholder="Nombre del producto" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <div className="fg2">
            <div>
              <div className="flabel">SKU</div>
              {/* Required now: `(org_id, sku)` is unique and the old form
                  generated `SKU-1718…` from a timestamp when left blank, which
                  is not a code anyone can look up. */}
              <input className="field" placeholder="PAN-540-M" value={form.sku} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} />
            </div>
            <div>
              <div className="flabel">Unidad</div>
              <Select options={UNIT_OPTIONS} value={form.unit} onChange={(v) => setForm((p) => ({ ...p, unit: v }))} />
            </div>
          </div>
          <div className="flabel">Código de barras</div>
          <input className="field" placeholder="EAN-13 o código interno (opcional)" value={form.barcode}
            onChange={(e) => setForm((p) => ({ ...p, barcode: e.target.value }))} />
          <div className="flabel">Categoría</div>
          <input className="field" list="cat-options" placeholder="Ej. Paneles" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
          <datalist id="cat-options">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
          <div className="fg2">
            <div>
              <div className="flabel">Precio venta (COP)</div>
              <input className="field" type="number" min={0} placeholder="0" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} />
            </div>
            <div>
              <div className="flabel">Costo (COP)</div>
              <input className="field" type="number" min={0} placeholder="0" value={form.cost} onChange={(e) => setForm((p) => ({ ...p, cost: e.target.value }))} />
            </div>
          </div>
          <div className="fg2">
            <div>
              <div className="flabel">Stock</div>
              <input className="field" type="number" min={0} placeholder="0" value={form.stock} onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))} />
            </div>
            <div>
              <div className="flabel">Proveedor</div>
              <input className="field" placeholder="Nombre del proveedor" value={form.supplier} onChange={(e) => setForm((p) => ({ ...p, supplier: e.target.value }))} />
            </div>
          </div>
          <div className="acc" style={{ padding: '10px 0' }}>
            <div style={{ flex: 1 }}>
              <div className="act">Activo</div>
              <div className="acs">Disponible para cotizaciones y compras</div>
            </div>
            <Toggle on={form.isActive} ariaLabel="Producto activo" onChange={(v) => setForm((p) => ({ ...p, isActive: v }))} />
          </div>
          <div className="acc" style={{ padding: '10px 0' }}>
            <div style={{ flex: 1 }}>
              <div className="act">Visible en la tienda</div>
              <div className="acs">Aparece en el catálogo de venta</div>
            </div>
            <Toggle on={form.inStorefront} ariaLabel="Visible en la tienda" onChange={(v) => setForm((p) => ({ ...p, inStorefront: v }))} />
          </div>
    </FormDrawer>
  )
}
