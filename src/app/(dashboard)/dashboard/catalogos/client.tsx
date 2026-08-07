'use client'

import type { StatusTone } from '@/lib/types'

import { useState, useMemo } from 'react'
import { Plus, Trash2, PenLine, X, Search, Package, DollarSign, TrendingUp, Layers } from '@/lib/icons'
import Stat from '@/components/ui/Stat'
import Badge from '@/components/ui/Badge'
import TabBar from '@/components/ui/TabBar'
import Select from '@/components/ui/Select'
import { useApp } from '@/lib/context/AppContext'
import { cop } from '@/lib/utils'

interface CatalogoItem {
  id: number
  nombre: string
  categoria: string
  precio: number
  costo: number
  stock: number
  unidad: string
  sku: string
  proveedor: string
  activo: boolean
}

const CATS = ['Paneles', 'Inversores', 'Baterías', 'Estructuras', 'Cableado', 'Protecciones', 'Servicios', 'Herramientas']

const UNIDADES = [
  { value: 'UN', label: 'Unidad' },
  { value: 'KIT', label: 'Kit' },
  { value: 'RL', label: 'Rollo' },
  { value: 'KW', label: 'kW' },
  { value: 'SERV', label: 'Servicio' },
]

const SEED: CatalogoItem[] = [
  { id: 1, nombre: 'Panel Solar 540W Monocristalino', categoria: 'Paneles', precio: 380000, costo: 290000, stock: 60, unidad: 'UN', sku: 'PAN-540-M', proveedor: 'Soltek Solar', activo: true },
  { id: 2, nombre: 'Panel Solar 640W Bifacial', categoria: 'Paneles', precio: 470000, costo: 350000, stock: 30, unidad: 'UN', sku: 'PAN-640-B', proveedor: 'Soltek Solar', activo: true },
  { id: 3, nombre: 'Microinversor 3kW', categoria: 'Inversores', precio: 1850000, costo: 1400000, stock: 24, unidad: 'UN', sku: 'INV-3K-M', proveedor: 'EnerSol', activo: true },
  { id: 4, nombre: 'Inversor Central 150kW', categoria: 'Inversores', precio: 32000000, costo: 25000000, stock: 5, unidad: 'UN', sku: 'INV-150K-C', proveedor: 'EnerSol', activo: true },
  { id: 5, nombre: 'Batería Litio 10kWh', categoria: 'Baterías', precio: 8500000, costo: 6200000, stock: 12, unidad: 'UN', sku: 'BAT-10K-L', proveedor: 'EnerSol', activo: true },
  { id: 6, nombre: 'Batería Litio 50kWh', categoria: 'Baterías', precio: 28300000, costo: 21000000, stock: 4, unidad: 'UN', sku: 'BAT-50K-L', proveedor: 'EnerSol', activo: true },
  { id: 7, nombre: 'Kit Estructura Techo', categoria: 'Estructuras', precio: 720000, costo: 510000, stock: 18, unidad: 'KIT', sku: 'EST-TECHO', proveedor: 'Metálicas SAS', activo: true },
  { id: 8, nombre: 'Kit Estructura Suelo', categoria: 'Estructuras', precio: 950000, costo: 680000, stock: 10, unidad: 'KIT', sku: 'EST-SUELO', proveedor: 'Metálicas SAS', activo: true },
  { id: 9, nombre: 'Cable Solar 6mm x 100m', categoria: 'Cableado', precio: 185000, costo: 120000, stock: 40, unidad: 'RL', sku: 'CAB-6MM', proveedor: 'ElectroAndina', activo: true },
  { id: 10, nombre: 'Protección DC 1000V', categoria: 'Protecciones', precio: 45000, costo: 28000, stock: 200, unidad: 'UN', sku: 'PRO-DC-1K', proveedor: 'ElectroAndina', activo: false },
  { id: 11, nombre: 'Instalación por kW', categoria: 'Servicios', precio: 1250000, costo: 800000, stock: 999, unidad: 'KW', sku: 'SERV-INST', proveedor: 'Interno', activo: true },
  { id: 12, nombre: 'Taladro Percutor 20V', categoria: 'Herramientas', precio: 520000, costo: 380000, stock: 8, unidad: 'UN', sku: 'HERR-TAL-20', proveedor: 'Ferrenergía', activo: true },
]

const margen = (p: number, c: number) => p > 0 ? Math.round(((p - c) / p) * 100) : 0

const CAT_TABS = ['Todas', ...CATS]

const emptyForm = { nombre: '', categoria: 'Paneles', precio: '', costo: '', stock: '', unidad: 'UN', sku: '', proveedor: '' }

export default function CatalogosPage() {
  const { addToast } = useApp()
  const [items, setItems] = useState(SEED)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('Todas')
  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState<CatalogoItem | null>(null)
  const [form, setForm] = useState(emptyForm)

  const filtered = useMemo(() => items.filter(i => {
    if (cat !== 'Todas' && i.categoria !== cat) return false
    if (search && !`${i.nombre} ${i.sku} ${i.proveedor}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [items, search, cat])

  const stats = useMemo(() => {
    const cats = new Set(items.map(i => i.categoria)).size
    const valor = items.reduce((s, i) => s + i.costo * i.stock, 0)
    const margenes = items.filter(i => i.precio > 0).map(i => margen(i.precio, i.costo))
    const margenAvg = margenes.length > 0 ? Math.round(margenes.reduce((a, b) => a + b, 0) / margenes.length) : 0
    const inactivos = items.filter(i => !i.activo).length
    return { total: items.length, cats, valor, margenAvg, inactivos }
  }, [items])

  const openAdd = () => { setForm(emptyForm); setAddOpen(true) }

  const addItem = () => {
    if (!form.nombre || !form.precio) { addToast('Nombre y precio requeridos', 'warn'); return }
    const item: CatalogoItem = {
      id: Date.now(), nombre: form.nombre, categoria: form.categoria,
      precio: Number(form.precio), costo: Number(form.costo) || 0,
      stock: Number(form.stock) || 0, unidad: form.unidad,
      sku: form.sku || `SKU-${Date.now()}`, proveedor: form.proveedor || 'Proveedor pendiente', activo: true,
    }
    setItems(prev => [item, ...prev])
    setAddOpen(false)
    addToast('Producto agregado al catálogo', 'ok')
  }

  const openEdit = (item: CatalogoItem) => {
    setEditItem(item)
    setForm({ nombre: item.nombre, categoria: item.categoria, precio: String(item.precio), costo: String(item.costo), stock: String(item.stock), unidad: item.unidad, sku: item.sku, proveedor: item.proveedor })
  }

  const saveEdit = () => {
    if (!editItem) return
    if (!form.nombre || !form.precio) { addToast('Nombre y precio requeridos', 'warn'); return }
    setItems(prev => prev.map(i => i.id === editItem.id ? { ...i, nombre: form.nombre, categoria: form.categoria, precio: Number(form.precio), costo: Number(form.costo) || 0, stock: Number(form.stock) || 0, unidad: form.unidad, sku: form.sku, proveedor: form.proveedor } : i))
    setEditItem(null)
    addToast('Producto actualizado', 'ok')
  }

  const deleteItem = (id: number) => {
    const removed = items.find(i => i.id === id)
    setItems(prev => prev.filter(i => i.id !== id))
    if (removed) addToast(`"${removed.nombre}" eliminado`, 'info', 'Deshacer', () => setItems(prev => [removed, ...prev]))
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat icon={<Package size={16} />} tone="blu" label="Productos" value={stats.total} /></div>
        <div className="rise d2"><Stat icon={<Layers size={16} />} tone="grn" label="Categorías" value={stats.cats} /></div>
        <div className="rise d3"><Stat icon={<DollarSign size={16} />} tone="vio" label="Valor inventario" value={cop(stats.valor)} /></div>
        <div className="rise d4"><Stat icon={<TrendingUp size={16} />} tone="amb" label="Margen promedio" value={`${stats.margenAvg}%`} sub={stats.inactivos > 0 ? `${stats.inactivos} inactivos` : undefined} /></div>
      </div>

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
            <button className="btn dark" onClick={openAdd}><Plus size={14} />Nuevo producto</button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="dempty">No se encontraron productos con los filtros actuales.</div>
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
                  <th scope="col">Activo</th>
                  <th scope="col"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr className="trow" key={item.id}>
                    <td>
                      <div className="cename">{item.nombre}</div>
                      <div className="ceid" style={{ display: 'flex', gap: 8 }}>
                        <span className="mono">{item.sku}</span>
                        <span className="muted">{item.proveedor}</span>
                      </div>
                    </td>
                    <td><Badge st={item.categoria} tone={({ Paneles: 'blu', Inversores: 'amb', Baterías: 'vio', Estructuras: 'neu', Cableado: 'neu', Protecciones: 'red', Servicios: 'grn', Herramientas: 'neu' } as Record<string, StatusTone>)[item.categoria] ?? 'neu'} /></td>
                    <td>
                      <div className="cename">{cop(item.precio)}</div>
                      <div className="elsub">{cop(item.costo)} costo</div>
                    </td>
                    <td>
                      <Badge st={`${margen(item.precio, item.costo)}%`} tone={item.precio > item.costo ? 'grn' : 'red'} filled />
                    </td>
                    <td>
                      <Badge st={`${item.stock} ${item.unidad}`} tone={item.stock > 10 ? 'grn' : item.stock > 0 ? 'amb' : 'red'} filled />
                    </td>
                    <td>
                      <Badge st={item.activo ? 'Activo' : 'Inactivo'} tone={item.activo ? 'grn' : 'neu'} filled />
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button className="ibtn" style={{ width: 30, height: 30, borderRadius: 9 }} data-tip="Editar" onClick={() => openEdit(item)}><PenLine size={14} /></button>
                        <button className="ibtn" style={{ width: 30, height: 30, borderRadius: 9, color: 'var(--redd)' }} data-tip="Eliminar" onClick={() => deleteItem(item.id)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal nuevo producto */}
      {addOpen && (
        <div className="mwrap" onClick={() => setAddOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Nuevo producto</div><button className="ibtn" onClick={() => setAddOpen(false)}><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
              <input className="field" placeholder="Nombre del producto" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
              <div className="fg2">
                <div>
                  <div className="flabel">Categoría</div>
                  <Select options={CATS} value={form.categoria} onChange={v => setForm(p => ({ ...p, categoria: v }))} />
                </div>
                <div>
                  <div className="flabel">Unidad</div>
                  <Select options={UNIDADES} value={form.unidad} onChange={v => setForm(p => ({ ...p, unidad: v }))} />
                </div>
              </div>
              <div className="fg2">
                <div>
                  <div className="flabel">Precio venta</div>
                  <input className="field" type="number" placeholder="0" value={form.precio} onChange={e => setForm(p => ({ ...p, precio: e.target.value }))} />
                </div>
                <div>
                  <div className="flabel">Costo</div>
                  <input className="field" type="number" placeholder="0" value={form.costo} onChange={e => setForm(p => ({ ...p, costo: e.target.value }))} />
                </div>
              </div>
              <div className="fg2">
                <div>
                  <div className="flabel">Stock</div>
                  <input className="field" type="number" placeholder="0" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} />
                </div>
                <div>
                  <div className="flabel">SKU</div>
                  <input className="field" placeholder="Auto-generado" value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} />
                </div>
              </div>
              <div className="flabel">Proveedor</div>
              <input className="field" placeholder="Nombre del proveedor" value={form.proveedor} onChange={e => setForm(p => ({ ...p, proveedor: e.target.value }))} />
            </div>
            <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => setAddOpen(false)}>Cancelar</button>
              <button className="btn dark" onClick={addItem}><Plus size={14} />Añadir producto</button>
            </div></div>
          </div>
        </div>
      )}

      {/* Modal editar producto */}
      {editItem && (
        <div className="mwrap" onClick={() => setEditItem(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Editar producto</div><button className="ibtn" onClick={() => setEditItem(null)}><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
              <input className="field" placeholder="Nombre del producto" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
              <div className="fg2">
                <div>
                  <div className="flabel">Categoría</div>
                  <Select options={CATS} value={form.categoria} onChange={v => setForm(p => ({ ...p, categoria: v }))} />
                </div>
                <div>
                  <div className="flabel">Unidad</div>
                  <Select options={UNIDADES} value={form.unidad} onChange={v => setForm(p => ({ ...p, unidad: v }))} />
                </div>
              </div>
              <div className="fg2">
                <div>
                  <div className="flabel">Precio venta</div>
                  <input className="field" type="number" placeholder="0" value={form.precio} onChange={e => setForm(p => ({ ...p, precio: e.target.value }))} />
                </div>
                <div>
                  <div className="flabel">Costo</div>
                  <input className="field" type="number" placeholder="0" value={form.costo} onChange={e => setForm(p => ({ ...p, costo: e.target.value }))} />
                </div>
              </div>
              <div className="fg2">
                <div>
                  <div className="flabel">Stock</div>
                  <input className="field" type="number" placeholder="0" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} />
                </div>
                <div>
                  <div className="flabel">SKU</div>
                  <input className="field" placeholder="SKU" value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} />
                </div>
              </div>
              <div className="flabel">Proveedor</div>
              <input className="field" placeholder="Nombre del proveedor" value={form.proveedor} onChange={e => setForm(p => ({ ...p, proveedor: e.target.value }))} />
            </div>
            <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => setEditItem(null)}>Cancelar</button>
              <button className="btn dark" onClick={saveEdit}>Guardar cambios</button>
            </div></div>
          </div>
        </div>
      )}
    </>
  )
}
