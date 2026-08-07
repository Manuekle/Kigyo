'use client'

import { useState, useMemo } from 'react'
import { ShoppingCart, Plus, Search, X, Trash2, PenLine, Package, Tag, DollarSign } from '@/lib/icons'
import Stat from '@/components/ui/Stat'
import Badge from '@/components/ui/Badge'
import TabBar from '@/components/ui/TabBar'
import Select from '@/components/ui/Select'
import { useApp } from '@/lib/context/AppContext'
import { cop } from '@/lib/utils'

interface Producto { id: number; nombre: string; categoria: string; precio: number; stock: number; desc: string; imagen: string }
interface CartItem { producto: Producto; cant: number }

const CATS = ['Paneles', 'Inversores', 'Baterías', 'Estructuras', 'Servicios']

const PRODUCTOS: Producto[] = [
  { id: 1, nombre: 'Panel Solar 540W Mono', categoria: 'Paneles', precio: 380000, stock: 60, desc: 'Eficiencia 21.5%, 72 células', imagen: '☀️' },
  { id: 2, nombre: 'Panel Solar 640W Bifacial', categoria: 'Paneles', precio: 470000, stock: 30, desc: 'Tecnología PERC, 144 células', imagen: '☀️' },
  { id: 3, nombre: 'Microinversor 3kW', categoria: 'Inversores', precio: 1850000, stock: 24, desc: 'Máx. eficiencia 97.2%', imagen: '⚡' },
  { id: 4, nombre: 'Inversor Central 150kW', categoria: 'Inversores', precio: 32000000, stock: 5, desc: 'Para instalaciones comerciales', imagen: '⚡' },
  { id: 5, nombre: 'Batería Litio 10kWh', categoria: 'Baterías', precio: 8500000, stock: 12, desc: 'Ciclo profundo, 6000 ciclos', imagen: '🔋' },
  { id: 6, nombre: 'Batería Litio 50kWh', categoria: 'Baterías', precio: 28300000, stock: 4, desc: 'Para respaldo industrial', imagen: '🔋' },
  { id: 7, nombre: 'Kit Estructura Techo', categoria: 'Estructuras', precio: 720000, stock: 18, desc: 'Perfiles de aluminio anodizado', imagen: '🔩' },
  { id: 8, nombre: 'Kit Estructura Suelo', categoria: 'Estructuras', precio: 950000, stock: 10, desc: 'Para terreno abierto', imagen: '🔩' },
  { id: 9, nombre: 'Instalación + Puesta Marcha', categoria: 'Servicios', precio: 1250000, stock: 99, desc: 'Por kW instalado', imagen: '🔧' },
  { id: 10, nombre: 'Mantenimiento Anual', categoria: 'Servicios', precio: 800000, stock: 99, desc: 'Incluye limpieza y revisión', imagen: '🔧' },
]

const CAT_TABS = ['Todas', ...CATS]

export default function TiendaPage() {
  const { addToast } = useApp()
  const [prods, setProds] = useState(PRODUCTOS)
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('Todas')
  const [addOpen, setAddOpen] = useState(false)
  const [editProd, setEditProd] = useState<Producto | null>(null)
  const [form, setForm] = useState({ nombre: '', categoria: 'Paneles', precio: '', stock: '', desc: '' })

  const filtered = useMemo(() => prods.filter(p => {
    if (cat !== 'Todas' && p.categoria !== cat) return false
    if (search && !p.nombre.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [prods, search, cat])

  const cartTotal = useMemo(() => cart.reduce((a, i) => a + i.producto.precio * i.cant, 0), [cart])
  const cartCount = useMemo(() => cart.reduce((a, i) => a + i.cant, 0), [cart])

  const stats = useMemo(() => {
    const valor = prods.reduce((s, p) => s + p.precio * p.stock, 0)
    const bajo = prods.filter(p => p.stock > 0 && p.stock <= 10).length
    const agotado = prods.filter(p => p.stock === 0).length
    return { total: prods.length, cats: CATS.length, valor, bajo, agotado }
  }, [prods])

  const addCart = (p: Producto) => {
    setCart(prev => {
      const e = prev.find(i => i.producto.id === p.id)
      return e
        ? prev.map(i => i.producto.id === p.id ? { ...i, cant: i.cant + 1 } : i)
        : [...prev, { producto: p, cant: 1 }]
    })
    addToast(`${p.nombre} agregado`, 'info')
  }
  const removeCart = (id: number) => setCart(prev => prev.filter(i => i.producto.id !== id))
  const updateCartCant = (id: number, cant: number) => {
    if (cant <= 0) return removeCart(id)
    setCart(prev => prev.map(i => i.producto.id === id ? { ...i, cant } : i))
  }
  const checkout = () => {
    if (cart.length === 0) return addToast('Carrito vacío', 'warn')
    addToast(`Pedido generado por ${cop(cartTotal)}`, 'ok')
    setCart([])
  }

  const addProduct = () => {
    if (!form.nombre || !form.precio) { addToast('Completa nombre y precio', 'warn'); return }
    setProds(prev => [...prev, {
      id: Date.now(), nombre: form.nombre, categoria: form.categoria,
      precio: Number(form.precio), stock: Number(form.stock) || 0,
      desc: form.desc, imagen: '📦',
    }])
    setForm({ nombre: '', categoria: 'Paneles', precio: '', stock: '', desc: '' })
    setAddOpen(false)
    addToast('Producto agregado', 'ok')
  }

  const updateProduct = (id: number) => {
    if (!form.nombre || !form.precio) { addToast('Completa nombre y precio', 'warn'); return }
    setProds(prev => prev.map(p => p.id === id ? {
      ...p, nombre: form.nombre, categoria: form.categoria,
      precio: Number(form.precio), stock: Number(form.stock) || 0, desc: form.desc,
    } : p))
    setEditProd(null)
    addToast('Producto actualizado', 'ok')
  }

  const deleteProduct = (id: number) => {
    const p = prods.find(x => x.id === id)
    setProds(prev => prev.filter(x => x.id !== id))
    if (p) addToast(`"${p.nombre}" eliminado`, 'info', 'Deshacer', () => setProds(prev => [p, ...prev]))
  }

  const openEdit = (p: Producto) => {
    setEditProd(p)
    setForm({ nombre: p.nombre, categoria: p.categoria, precio: String(p.precio), stock: String(p.stock), desc: p.desc })
  }

  const stockTone = (s: number) => s > 10 ? 'grn' as const : s > 0 ? 'amb' as const : 'red' as const

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat icon={<Package size={16} />} tone="blu" label="Productos" value={stats.total} /></div>
        <div className="rise d2"><Stat icon={<Tag size={16} />} tone="grn" label="Categorías" value={stats.cats} /></div>
        <div className="rise d3"><Stat icon={<DollarSign size={16} />} tone="vio" label="Valor inventario" value={cop(stats.valor)} /></div>
        <div className="rise d4"><Stat icon={<ShoppingCart size={16} />} tone="amb" label="Stock bajo" value={stats.bajo + stats.agotado} sub={`${stats.bajo} bajo · ${stats.agotado} agotado`} /></div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Catálogo */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card rise d1">
            <div className="chead" style={{ flexWrap: 'wrap', gap: 10 }}>
              <TabBar
                value={cat}
                onChange={(k) => setCat(k as string)}
                items={CAT_TABS.map(s => ({ key: s, label: s }))}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--ink3)', pointerEvents: 'none' }} />
                  <input className="field" style={{ paddingLeft: 32, width: 200 }} placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
                  {search && <button className="ibtn" style={{ marginLeft: 4 }} onClick={() => setSearch('')}><X size={14} /></button>}
                </div>
                <button className="btn dark" onClick={() => { setForm({ nombre: '', categoria: 'Paneles', precio: '', stock: '', desc: '' }); setAddOpen(true) }}><Plus size={14} />Añadir</button>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="dempty">No se encontraron productos con los filtros actuales.</div>
            ) : (
              <div style={{ padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
                  {filtered.map(p => (
                    <div key={p.id} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 32, textAlign: 'center', lineHeight: 1 }}>{p.imagen}</div>
                      <div className="cename" style={{ fontSize: 13 }}>{p.nombre}</div>
                      <div className="elsub" style={{ fontSize: 11, flex: 1 }}>{p.desc}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: 15 }}>{cop(p.precio)}</span>
                        <Badge st={p.stock === 0 ? 'Agotado' : `${p.stock} un`} tone={stockTone(p.stock)} filled />
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn dark" style={{ justifyContent: 'center', flex: 1, fontSize: 12, height: 32 }} onClick={() => addCart(p)}>
                          <ShoppingCart size={13} /> Agregar
                        </button>
                        <button className="ibtn" style={{ width: 32, height: 32 }} data-tip="Editar" onClick={() => openEdit(p)}><PenLine size={14} /></button>
                        <button className="ibtn" style={{ width: 32, height: 32, color: 'var(--redd)' }} data-tip="Eliminar" onClick={() => deleteProduct(p.id)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Carrito */}
        <div className="card" style={{ width: 300, minWidth: 300, position: 'sticky', top: 20 }}>
          <div className="chead">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingCart size={15} />
              <span className="ctitle">Carrito</span>
              {cartCount > 0 && <Badge st={`${cartCount}`} tone="amb" filled />}
            </div>
            {cart.length > 0 && (
              <button className="ibtn" style={{ color: 'var(--redd)' }} onClick={() => { setCart([]); addToast('Carrito vaciado', 'info') }} data-tip="Vaciar"><Trash2 size={14} /></button>
            )}
          </div>
          <div className="cpad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cart.length === 0 ? (
              <div className="dempty" style={{ padding: '24px 0' }}>Carrito vacío</div>
            ) : (
              <>
                {cart.map(item => (
                  <div key={item.producto.id} className="elrow" style={{ padding: '6px 0', gap: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="eltxt" style={{ fontSize: 12 }}>{item.producto.nombre}</div>
                      <div className="elsub" style={{ fontSize: 11 }}>{item.cant} × {cop(item.producto.precio)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <button className="ibtn" style={{ width: 22, height: 22 }} onClick={() => updateCartCant(item.producto.id, item.cant - 1)}>-</button>
                      <span style={{ fontSize: 12, fontWeight: 700, width: 18, textAlign: 'center' }}>{item.cant}</span>
                      <button className="ibtn" style={{ width: 22, height: 22 }} onClick={() => updateCartCant(item.producto.id, item.cant + 1)}>+</button>
                    </div>
                    <button className="ibtn" style={{ width: 22, height: 22 }} onClick={() => removeCart(item.producto.id)}><X size={11} /></button>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--line2)', padding: '10px 0', display: 'flex', justifyContent: 'space-between' }}>
                  <span className="eltxt">Total</span>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{cop(cartTotal)}</span>
                </div>
                <button className="btn dark" style={{ justifyContent: 'center' }} onClick={checkout}>Generar pedido</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal añadir producto */}
      {addOpen && (
        <div className="mwrap" onClick={() => setAddOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Nuevo producto</div><button className="ibtn" onClick={() => setAddOpen(false)}><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
              <input className="field" placeholder="Nombre del producto" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
              <div className="flabel">Categoría</div>
              <Select options={CATS} value={form.categoria} onChange={v => setForm(p => ({ ...p, categoria: v }))} />
              <div className="flabel">Precio</div>
              <input className="field" type="number" placeholder="0" value={form.precio} onChange={e => setForm(p => ({ ...p, precio: e.target.value }))} />
              <div className="flabel">Stock</div>
              <input className="field" type="number" placeholder="0" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} />
              <div className="flabel">Descripción</div>
              <input className="field" placeholder="Breve descripción" value={form.desc} onChange={e => setForm(p => ({ ...p, desc: e.target.value }))} />
            </div>
            <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => setAddOpen(false)}>Cancelar</button>
              <button className="btn dark" onClick={addProduct}><Plus size={14} />Añadir producto</button>
            </div></div>
          </div>
        </div>
      )}

      {/* Modal editar producto */}
      {editProd && (
        <div className="mwrap" onClick={() => setEditProd(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Editar producto</div><button className="ibtn" onClick={() => setEditProd(null)}><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
              <input className="field" placeholder="Nombre del producto" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
              <div className="flabel">Categoría</div>
              <Select options={CATS} value={form.categoria} onChange={v => setForm(p => ({ ...p, categoria: v }))} />
              <div className="flabel">Precio</div>
              <input className="field" type="number" placeholder="0" value={form.precio} onChange={e => setForm(p => ({ ...p, precio: e.target.value }))} />
              <div className="flabel">Stock</div>
              <input className="field" type="number" placeholder="0" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} />
              <div className="flabel">Descripción</div>
              <input className="field" placeholder="Breve descripción" value={form.desc} onChange={e => setForm(p => ({ ...p, desc: e.target.value }))} />
            </div>
            <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => setEditProd(null)}>Cancelar</button>
              <button className="btn dark" onClick={() => updateProduct(editProd.id)}>Guardar cambios</button>
            </div></div>
          </div>
        </div>
      )}
    </>
  )
}
