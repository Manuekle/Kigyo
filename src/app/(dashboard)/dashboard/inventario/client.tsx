'use client'

import { useState } from 'react'
import {
  Boxes, Users, Package, AlertCircle, ShoppingCart, Receipt,
  FileSpreadsheet, Plus, PenLine, Trash2, X, Check, Printer,
} from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Stat from '@/components/ui/Stat'
import Select from '@/components/ui/Select'
import TabBar from '@/components/ui/TabBar'
import { useApp } from '@/lib/context/AppContext'
import { cop } from '@/lib/utils'
import { useExport } from '@/lib/hooks/use-export'
import { EMPLEADOS } from '@/lib/data/empleados'
import { activatable } from '@/lib/a11y'

// ── Page-local data (faithful to original nucleo-rh.jsx — shared data files
//    have incompatible shapes/values, so seeded inline to render IDENTICAL).
interface InvItem { id: string; item: string; cat: string; who: string; serial: string; st: string; date: string }
interface InvFacturaItem { activo: string; cant: number; precio: number }
interface InvFactura { id: string; proveedor: string; fecha: string; st: string; items: InvFacturaItem[] }
interface InvPedido { id: string; item: string; proveedor: string; cant: number; precioEst: number; fecha: string; st: string; quien: string }

const INVENTARIO: InvItem[] = [
  { id: 'INV-0571', item: 'MacBook Pro 14"', cat: 'Cómputo', who: 'María González', serial: 'C02XL14ABCD', st: 'Asignado', date: '10 ene 2026' },
  { id: 'INV-0572', item: "Monitor LG 27''", cat: 'Cómputo', who: 'Juan Pérez', serial: 'MN27GH88012', st: 'Asignado', date: '10 ene 2026' },
  { id: 'INV-0588', item: 'iPhone 15', cat: 'Móvil', who: '—', serial: 'IP15RT99311', st: 'Disponible', date: '04 mar 2026' },
  { id: 'INV-0590', item: 'Silla ergonómica', cat: 'Mobiliario', who: 'Valentina Ruiz', serial: 'SL-ERG-4421', st: 'Asignado', date: '21 feb 2026' },
  { id: 'INV-0595', item: 'Dell Latitude', cat: 'Cómputo', who: '—', serial: 'DL-LAT-7780', st: 'Mantenimiento', date: '30 may 2026' },
  { id: 'INV-0601', item: 'Teclado mecánico', cat: 'Cómputo', who: 'Daniel Ospina', serial: 'KB-MX-3390', st: 'Asignado', date: '12 jun 2026' },
]

const FACTURAS: InvFactura[] = [
  { id: 'FAC-2201', proveedor: 'Apple Colombia SAS', fecha: '10 ene 2026', st: 'Pagada',
    items: [{ activo: 'MacBook Pro 14"', cant: 1, precio: 9800000 }, { activo: 'iPhone 15', cant: 1, precio: 4200000 }] },
  { id: 'FAC-2198', proveedor: 'LG Electronics', fecha: '10 ene 2026', st: 'Pagada',
    items: [{ activo: "Monitor LG 27''", cant: 1, precio: 1350000 }] },
  { id: 'FAC-2214', proveedor: 'Ergosillas SAS', fecha: '21 feb 2026', st: 'Pagada',
    items: [{ activo: 'Silla ergonómica', cant: 1, precio: 980000 }] },
  { id: 'FAC-2240', proveedor: 'Dell Colombia', fecha: '30 may 2026', st: 'Pendiente',
    items: [{ activo: 'Dell Latitude', cant: 1, precio: 5400000 }] },
  { id: 'FAC-2255', proveedor: 'MacroTech SAS', fecha: '12 jun 2026', st: 'Pendiente',
    items: [{ activo: 'Teclado mecánico', cant: 2, precio: 320000 }] },
]

const PEDIDOS: InvPedido[] = [
  { id: 'PED-501', item: "Monitor LG 27''", proveedor: 'LG Electronics', cant: 3, precioEst: 1400000, fecha: '15 jun 2026', st: 'Solicitado', quien: 'Daniel Ospina' },
  { id: 'PED-502', item: 'MacBook Air M3', proveedor: 'Apple Colombia SAS', cant: 2, precioEst: 7200000, fecha: '17 jun 2026', st: 'Aprobado', quien: 'Camila Restrepo' },
  { id: 'PED-503', item: 'Silla ergonómica', proveedor: 'Ergosillas SAS', cant: 5, precioEst: 1000000, fecha: '12 jun 2026', st: 'Facturado', quien: 'Andrés Mora' },
  { id: 'PED-504', item: 'Licencias Adobe CC', proveedor: 'Adobe Colombia', cant: 4, precioEst: 620000, fecha: '19 jun 2026', st: 'Solicitado', quien: 'Valentina Ruiz' },
]

const total = (f: InvFactura) => f.items.reduce((s, it) => s + it.cant * it.precio, 0)

export default function InventarioPage() {
  const { addToast } = useApp()
  const { runExport, exporting } = useExport()
  const [items, setItems] = useState<InvItem[]>(INVENTARIO)
  const [facturas, setFacturas] = useState<InvFactura[]>(FACTURAS)
  const [pedidos, setPedidos] = useState<InvPedido[]>(PEDIDOS)
  const [view, setView] = useState<'activos' | 'pedidos' | 'facturas'>('activos')
  const [selFacturaId, setSelFacturaId] = useState<string | null>(null)
  const [pedidoOpen, setPedidoOpen] = useState(false)
  const [editItem, setEditItem] = useState<InvItem | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [newItem, setNewItem] = useState({ nombre: '', cat: 'Cómputo', serial: '', who: '—' })

  const addItem = () => {
    if (!newItem.nombre.trim()) return
    const id = `INV-0${600 + Math.floor(Math.random() * 90)}`
    setItems(it => [{ id, item: newItem.nombre, cat: newItem.cat, who: newItem.who || '—',
      serial: newItem.serial || `NW-${Math.floor(Math.random() * 90000)}`, st: 'Disponible', date: 'Jun 2026' }, ...it])
    addToast('Activo añadido al inventario', 'ok')
    setAddOpen(false)
    setNewItem({ nombre: '', cat: 'Cómputo', serial: '', who: '—' })
  }
  const updateItem = (id: string, patch: Partial<InvItem>) => {
    setItems((it) => it.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    addToast('Activo actualizado', 'ok')
    setEditItem(null)
  }
  const deleteItem = (id: string) => {
    const removed = items.find((x) => x.id === id)
    setItems((it) => it.filter((x) => x.id !== id))
    if (removed) addToast(`"${removed.item}" eliminado`, 'info', 'Deshacer', () => setItems((it) => [removed, ...it]))
  }
  const updateFactura = (id: string, patch: Partial<InvFactura>) => {
    setFacturas((f) => f.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    addToast('Factura actualizada', 'ok')
  }
  const deleteFactura = (id: string) => {
    const removed = facturas.find((x) => x.id === id)
    setFacturas((f) => f.filter((x) => x.id !== id))
    setSelFacturaId(null)
    if (removed) addToast(`Factura ${id} eliminada`, 'info', 'Deshacer', () => setFacturas((f) => [removed, ...f]))
  }
  const selFactura = facturas.find((x) => x.id === selFacturaId) || null

  const exportActivos = () => {
    void runExport(items.map((it) => ({ ID: it.id, Activo: it.item, Categoría: it.cat, 'Asignado a': it.who, Serial: it.serial, Ingreso: it.date, Estado: it.st })), 'activos-kigyo', 'inventario')
  }
  const exportFacturas = () => {
    void runExport(facturas.map((f) => ({ Factura: f.id, Proveedor: f.proveedor, Fecha: f.fecha, Estado: f.st, Total: total(f) })), 'facturas-kigyo', 'inventario')
  }
  const exportPedidos = () => {
    void runExport(pedidos.map((p) => ({ Pedido: p.id, Artículo: p.item, Proveedor: p.proveedor, Cantidad: p.cant, 'Precio est.': p.precioEst, Fecha: p.fecha, Estado: p.st, 'Solicitado por': p.quien })), 'pedidos-kigyo', 'inventario')
  }

  const addPedido = (d: { item: string; proveedor: string; cant: number; precioEst: number }) => {
    const id = `PED-${505 + pedidos.length}`
    setPedidos((p) => [{ id, ...d, fecha: '21 jun 2026', st: 'Solicitado', quien: 'Camila Restrepo' }, ...p])
    addToast('Pedido creado', 'ok')
    setPedidoOpen(false)
  }
  const approvePedido = (id: string) => {
    setPedidos((p) => p.map((x) => (x.id === id ? { ...x, st: 'Aprobado' } : x)))
    addToast('Pedido aprobado', 'ok')
  }
  const invoicePedido = (id: string) => {
    const ped = pedidos.find((x) => x.id === id)
    if (!ped) return
    setPedidos((p) => p.map((x) => (x.id === id ? { ...x, st: 'Facturado' } : x)))
    const facId = `FAC-${2256 + facturas.length}`
    setFacturas((f) => [{ id: facId, proveedor: ped.proveedor, fecha: '21 jun 2026', st: 'Pendiente', items: [{ activo: ped.item, cant: ped.cant, precio: ped.precioEst }] }, ...f])
    addToast(`Pedido facturado · ${facId} creada`, 'ok')
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat icon={<Boxes size={16} />} tone="neu" label="Total de activos" value="234" /></div>
        <div className="rise d2"><Stat icon={<Users size={16} />} tone="blu" label="Asignados" value="188" /></div>
        <div className="rise d3"><Stat icon={<Package size={16} />} tone="grn" label="Disponibles" value="34" /></div>
        <div className="rise d4"><Stat icon={<AlertCircle size={16} />} tone="amb" label="En mantenimiento" value="12" /></div>
      </div>
      <div className="card rise d2">
        <div className="chead">
          <TabBar
            value={view}
            onChange={(k) => setView(k as typeof view)}
            items={[
              { key: 'activos', label: <><Boxes size={13} />Activos</> },
              { key: 'pedidos', label: <><ShoppingCart size={13} />Pedidos</> },
              { key: 'facturas', label: <><Receipt size={13} />Facturas</> },
            ]}
          />
          {view === 'activos' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportActivos}><FileSpreadsheet size={15} />Exportar</button>
              <button className="btn pri" onClick={() => setAddOpen(true)}><Plus size={15} />Añadir activo</button>
            </div>
          )}
          {view === 'pedidos' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportPedidos}><FileSpreadsheet size={15} />Exportar</button>
              <button className="btn pri" onClick={() => setPedidoOpen(true)}><Plus size={15} />Nuevo pedido</button>
            </div>
          )}
          {view === 'facturas' && (
            <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportFacturas}><FileSpreadsheet size={15} />Exportar</button>
          )}
        </div>

        {view === 'activos' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead><tr><th scope="col">Activo</th><th scope="col">Categoría</th><th scope="col">Asignado a</th><th scope="col">Serial</th><th scope="col">Ingreso</th><th scope="col">Estado</th><th scope="col"></th></tr></thead>
              <tbody>
                {items.map((it) => (
                  <tr className="trow" key={it.id}>
                    <td><div className="cename">{it.item}</div><div className="ceid mono">{it.id}</div></td>
                    <td className="muted">{it.cat}</td>
                    <td className="muted">{it.who}</td>
                    <td className="mono muted" style={{ fontSize: 12 }}>{it.serial}</td>
                    <td className="muted mono" style={{ fontSize: 12 }}>{it.date}</td>
                    <td><Badge st={it.st} /></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button className="ibtn" style={{ width: 30, height: 30, borderRadius: 9 }} data-tip="Editar" onClick={() => setEditItem(it)}><PenLine size={14} /></button>
                        <button className="ibtn" style={{ width: 30, height: 30, borderRadius: 9, color: 'var(--redd)' }} data-tip="Eliminar" onClick={() => deleteItem(it.id)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'pedidos' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead><tr><th scope="col">Pedido</th><th scope="col">Proveedor</th><th scope="col">Cant.</th><th scope="col">Estimado</th><th scope="col">Solicitado por</th><th scope="col">Estado</th><th scope="col"></th></tr></thead>
              <tbody>
                {pedidos.map((p) => (
                  <tr className="trow" key={p.id}>
                    <td><div className="cename">{p.item}</div><div className="ceid mono">{p.id}</div></td>
                    <td className="muted">{p.proveedor}</td>
                    <td className="muted">{p.cant}</td>
                    <td className="muted">{cop(p.cant * p.precioEst)}</td>
                    <td className="muted">{p.quien}</td>
                    <td><Badge st={p.st} /></td>
                    <td style={{ textAlign: 'right' }}>
                      {p.st === 'Solicitado' && <button className="btn" onClick={() => approvePedido(p.id)}>Aprobar</button>}
                      {p.st === 'Aprobado' && <button className="btn dark" onClick={() => invoicePedido(p.id)}>Facturar</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'facturas' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead><tr><th scope="col">Factura</th><th scope="col">Proveedor</th><th scope="col">Fecha</th><th scope="col">Total</th><th scope="col">Estado</th></tr></thead>
              <tbody>
                {facturas.map((f) => (
                  <tr className="trow" key={f.id} style={{ cursor: 'pointer' }} {...activatable(() => setSelFacturaId(f.id), `Abrir factura ${f.id} de ${f.proveedor}`)}>
                    <td><div className="cename mono">{f.id}</div><div className="ceid">{f.items.length} {f.items.length === 1 ? 'ítem' : 'ítems'}</div></td>
                    <td className="muted">{f.proveedor}</td>
                    <td className="muted mono" style={{ fontSize: 12 }}>{f.fecha}</td>
                    <td className="cename">{cop(total(f))}</td>
                    <td><Badge st={f.st} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FacturaDrawer f={selFactura} onClose={() => setSelFacturaId(null)} onUpdate={updateFactura} onDelete={deleteFactura} />
      <NewPedidoModal open={pedidoOpen} onClose={() => setPedidoOpen(false)} onCreate={addPedido} />
      <EditActivoModal item={editItem} onClose={() => setEditItem(null)} onSave={updateItem} />

      {addOpen && (
        <div className="mwrap" onClick={() => setAddOpen(false)}>
          <div className="modal t-modal is-open" onClick={e => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Nuevo activo</div><button className="ibtn" onClick={() => setAddOpen(false)}><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Nombre del activo</div>
              <input className="field" placeholder="Ej. MacBook Pro 14" value={newItem.nombre} onChange={e => setNewItem(n => ({ ...n, nombre: e.target.value }))} />
              <div className="flabel">Categoría</div>
              <Select value={newItem.cat} onChange={(v) => setNewItem(n => ({ ...n, cat: v }))} options={['Cómputo', 'Mobiliario', 'Herramientas', 'Vehículos', 'Electrónica', 'Otro']} />
              <div className="flabel">Serial / Ref.</div>
              <input className="field" placeholder="NW-12345" value={newItem.serial} onChange={e => setNewItem(n => ({ ...n, serial: e.target.value }))} />
              <div className="flabel">Asignado a</div>
              <Select value={newItem.who} onChange={(v) => setNewItem(n => ({ ...n, who: v }))} options={['—', ...EMPLEADOS.map(e => e.name)]} />
            </div>
            <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => setAddOpen(false)}>Cancelar</button>
              <button className="btn dark" onClick={addItem}>Añadir activo</button>
            </div></div>
          </div>
        </div>
      )}
    </>
  )
}

function FacturaDrawer({ f, onClose, onUpdate, onDelete }: {
  f: InvFactura | null
  onClose: () => void
  onUpdate: (id: string, patch: Partial<InvFactura>) => void
  onDelete: (id: string) => void
}) {
  if (!f) return null
  return <FacturaDrawerBody key={f.id} f={f} onClose={onClose} onUpdate={onUpdate} onDelete={onDelete} />
}

function FacturaDrawerBody({ f, onClose, onUpdate, onDelete }: {
  f: InvFactura
  onClose: () => void
  onUpdate: (id: string, patch: Partial<InvFactura>) => void
  onDelete: (id: string) => void
}) {
  const { runExport, exporting } = useExport()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ proveedor: f.proveedor, fecha: f.fecha, st: f.st })
  const tot = f.items.reduce((s, it) => s + it.cant * it.precio, 0)
  const [g1, g2] = ['#b298f2', '#8b5cf6']
  const exportRow = () => {
    void runExport(f.items.map((it) => ({ Factura: f.id, Proveedor: f.proveedor, Activo: it.activo, Cantidad: it.cant, 'Precio unitario': it.precio, Subtotal: it.cant * it.precio })), `${f.id}-kigyo`, 'inventario')
  }
  const save = () => { onUpdate(f.id, form); setEditing(false) }
  const sts = ['Pendiente', 'Pagada']
  return (
    <>
      <div className="ovl" onClick={onClose} />
      <aside className="drawer">
        <div className="dhead tkhead">
          <div className="kglow" style={{ background: g1 }} />
          <div className="dmark" style={{ background: `linear-gradient(145deg,${g1},${g2})`, boxShadow: `0 8px 18px -8px ${g2}99` }}>
            <Receipt size={19} color="#fff" />
          </div>
          <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
            <div className="dh-t mono">{f.id}</div>
            <div className="dh-s">{f.proveedor}</div>
          </div>
          <button className="ibtn" onClick={onClose} style={{ position: 'relative', zIndex: 1 }}><X size={18} /></button>
        </div>
        <div className="dbody">
          {editing ? (
            <>
              <div className="flabel" style={{ marginTop: 0 }}>Proveedor</div>
              <input className="field" value={form.proveedor} onChange={(e) => setForm((x) => x && ({ ...x, proveedor: e.target.value }))} />
              <div className="flabel">Fecha</div>
              <input className="field" value={form.fecha} onChange={(e) => setForm((x) => x && ({ ...x, fecha: e.target.value }))} />
              <div className="flabel">Estado</div>
              <div className="chips">{sts.map((s) => <button key={s} className={`chip ${form.st === s ? 'on' : ''}`} onClick={() => setForm((x) => x && ({ ...x, st: s }))}>{s}</button>)}</div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Badge st={f.st} /><span className="kvs">{f.fecha}</span></div>

              <div className="dsect">Ítems facturados</div>
              {f.items.map((it, i) => (
                <div className="elrow" key={i}>
                  <div><div className="eltxt">{it.activo}</div><div className="elsub">{it.cant} × {cop(it.precio)}</div></div>
                  <div className="eltxt">{cop(it.cant * it.precio)}</div>
                </div>
              ))}
              <div className="elrow" style={{ borderBottom: 'none', paddingTop: 14 }}>
                <div className="eltxt" style={{ fontSize: 14 }}>Total</div>
                <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-.04em' }}>{cop(tot)}</div>
              </div>
            </>
          )}
        </div>
        <div className="dacts">
          {editing ? (
            <>
              <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setEditing(false)}>Cancelar</button>
              <button className="btn dark" style={{ flex: 1, justifyContent: 'center' }} onClick={save}><Check size={15} />Guardar</button>
            </>
          ) : (
            <>
              <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportRow}><FileSpreadsheet size={15} /></button>
              <button className="btn" onClick={() => setEditing(true)}><PenLine size={15} /></button>
              <button className="btn dark" style={{ flex: 1, justifyContent: 'center' }} onClick={() => window.print()}><Printer size={15} />Imprimir / PDF</button>
              <button className="ibtn" style={{ color: 'var(--redd)', borderColor: '#f7cbcb' }} data-tip="Eliminar factura" onClick={() => onDelete(f.id)}><Trash2 size={17} /></button>
            </>
          )}
        </div>
      </aside>

      <div className="printarea">
        <div className="pinv-head">
          <div>
            <div className="pinv-logo">Whitebox</div>
            <div className="pinv-sub">Factura de compra de activo</div>
          </div>
          <div className="pinv-meta">
            <div><b>Factura</b> {f.id}</div>
            <div><b>Fecha</b> {f.fecha}</div>
            <div><b>Estado</b> {f.st}</div>
          </div>
        </div>
        <div className="pinv-parties">
          <div><div className="pinv-label">Proveedor</div><div>{f.proveedor}</div></div>
          <div><div className="pinv-label">Facturado a</div><div>Whitebox SAS · NIT 900.123.456-7</div></div>
        </div>
        <table className="pinv-table">
          <thead><tr><th scope="col">Activo</th><th scope="col">Cantidad</th><th scope="col">Precio unitario</th><th scope="col">Subtotal</th></tr></thead>
          <tbody>
            {f.items.map((it, i) => (
              <tr key={i}><td>{it.activo}</td><td>{it.cant}</td><td>{cop(it.precio)}</td><td>{cop(it.cant * it.precio)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="pinv-total">Total: {cop(tot)}</div>
        <div className="pinv-foot">Whitebox SAS — documento generado automáticamente.</div>
      </div>
    </>
  )
}

function NewPedidoModal({ open, onClose, onCreate }: {
  open: boolean
  onClose: () => void
  onCreate: (d: { item: string; proveedor: string; cant: number; precioEst: number }) => void
}) {
  if (!open) return null
  return <NewPedidoModalBody onClose={onClose} onCreate={onCreate} />
}

function NewPedidoModalBody({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (d: { item: string; proveedor: string; cant: number; precioEst: number }) => void
}) {
  const [item, setItem] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [cant, setCant] = useState(1)
  const [precioEst, setPrecioEst] = useState(0)
  const crear = () => {
    if (!item.trim()) return
    onCreate({ item: item.trim(), proveedor: proveedor.trim() || '—', cant: Number(cant) || 1, precioEst: Number(precioEst) || 0 })
  }
  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="mhead"><div className="mtitle">Nuevo pedido</div><button className="ibtn" onClick={onClose}><X size={18} /></button></div>
        <div className="mbody">
          <div className="flabel" style={{ marginTop: 0 }}>Artículo</div>
          <input className="field" placeholder="Ej. Monitor LG 27''" value={item} onChange={e => setItem(e.target.value)} />
          <div className="flabel">Proveedor</div>
          <input className="field" placeholder="Ej. LG Electronics" value={proveedor} onChange={e => setProveedor(e.target.value)} />
          <div className="flabel">Cantidad</div>
          <input className="field" type="number" min="1" value={cant} onChange={e => setCant(Number(e.target.value))} />
          <div className="flabel">Precio estimado (unitario)</div>
          <input className="field" type="number" min="0" value={precioEst} onChange={e => setPrecioEst(Number(e.target.value))} />
        </div>
        <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn dark" onClick={crear}>Crear pedido</button>
        </div></div>
      </div>
    </div>
  )
}

function EditActivoModal({ item, onClose, onSave }: {
  item: InvItem | null
  onClose: () => void
  onSave: (id: string, patch: Partial<InvItem>) => void
}) {
  if (!item) return null
  return <EditActivoModalBody key={item.id} item={item} onClose={onClose} onSave={onSave} />
}

function EditActivoModalBody({ item, onClose, onSave }: {
  item: InvItem
  onClose: () => void
  onSave: (id: string, patch: Partial<InvItem>) => void
}) {
  const [form, setForm] = useState({ item: item.item, cat: item.cat, serial: item.serial, who: item.who, st: item.st })
  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="mhead"><div className="mtitle">Editar activo</div><button className="ibtn" onClick={onClose}><X size={18} /></button></div>
        <div className="mbody">
          <div className="flabel" style={{ marginTop: 0 }}>Nombre del activo</div>
          <input className="field" value={form.item} onChange={e => setForm((x) => x && ({ ...x, item: e.target.value }))} />
          <div className="flabel">Categoría</div>
          <Select value={form.cat} onChange={(v) => setForm((x) => x && ({ ...x, cat: v }))} options={['Cómputo', 'Mobiliario', 'Herramientas', 'Vehículos', 'Electrónica', 'Móvil', 'Otro']} />
          <div className="flabel">Serial / Ref.</div>
          <input className="field" value={form.serial} onChange={e => setForm((x) => x && ({ ...x, serial: e.target.value }))} />
          <div className="flabel">Asignado a</div>
          <Select value={form.who} onChange={(v) => setForm((x) => x && ({ ...x, who: v }))} options={['—', ...EMPLEADOS.map(e => e.name)]} />
          <div className="flabel">Estado</div>
          <div className="chips">{['Asignado', 'Disponible', 'Mantenimiento'].map((s) => <button key={s} className={`chip ${form.st === s ? 'on' : ''}`} onClick={() => setForm((x) => x && ({ ...x, st: s }))}>{s}</button>)}</div>
        </div>
        <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn dark" onClick={() => form.item.trim() && onSave(item.id, form)}><Check size={15} />Guardar</button>
        </div></div>
      </div>
    </div>
  )
}
