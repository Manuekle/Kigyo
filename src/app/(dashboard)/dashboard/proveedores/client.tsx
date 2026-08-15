'use client'

import { useMemo, useState, useTransition } from 'react'
import { Building2, UserPlus, Check, Plus, Trash2, PenLine, Phone, Mail } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Stat from '@/components/ui/Stat'
import FormDrawer from '@/components/ui/FormDrawer'
import { useApp } from '@/lib/context/AppContext'
import { cop } from '@/lib/utils'
import type { ProveedorRow, ProveedoresData } from '@/server/queries/proveedores'
import {
  createProveedor, deleteProveedor, updateProveedor,
} from '@/server/mutations/proveedores'

function pesos(cents: number): string {
  return cop(Math.round(cents / 100))
}

const EMPTY_FORM = {
  name: '', taxId: '', contactName: '', email: '', phone: '', city: '', category: '', notes: '',
}

export default function ProveedoresPage({ data }: { data: ProveedoresData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [proveedores, setProveedores] = useState<ProveedorRow[]>(data.proveedores)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const stats = useMemo(() => ({
    activos: proveedores.filter((p) => p.isActive).length,
    conDeuda: proveedores.filter((p) => p.facturasPendientes > 0).length,
    deuda: proveedores.reduce((s, p) => s + p.deudaCents, 0),
  }), [proveedores])

  function apply(next: ProveedoresData) {
    setProveedores(next.proveedores)
  }

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDrawerOpen(true)
  }

  function openEdit(p: ProveedorRow) {
    setEditingId(p.id)
    setForm({
      name: p.name,
      taxId: p.taxId,
      contactName: p.contactName,
      email: p.email,
      phone: p.phone,
      city: p.city,
      category: p.category,
      notes: p.notes,
    })
    setDrawerOpen(true)
  }

  function submit() {
    startTransition(async () => {
      const payload = {
        name: form.name,
        taxId: form.taxId,
        contactName: form.contactName,
        email: form.email,
        phone: form.phone,
        city: form.city,
        category: form.category,
        notes: form.notes,
      }
      const result = editingId
        ? await updateProveedor({ ...payload, id: editingId })
        : await createProveedor(payload)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setEditingId(null)
      setDrawerOpen(false)
      addToast(editingId ? 'Proveedor actualizado' : 'Proveedor creado', 'ok')
    })
  }

  function remove(p: ProveedorRow) {
    if (!window.confirm(`¿Eliminar a ${p.name}? Las facturas y productos conservan el nombre.`)) return
    startTransition(async () => {
      const result = await deleteProveedor(p.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Proveedor eliminado', 'ok')
    })
  }

  const set = (key: keyof typeof EMPTY_FORM) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  return (
    <>
      <div className="dash-head">
        <div>
          <h1 className="dash-hello">Proveedores</h1>
          <p className="dash-sub">
            Quién surte tu negocio, cómo contactarlos y cuánto les debes.
          </p>
        </div>
        {data.canWrite && (
          <button className="btn pri" onClick={openCreate} disabled={pending}>
            <Plus size={15} />Nuevo proveedor
          </button>
        )}
      </div>

      <div className="gkpi">
        <Stat
          label="Proveedores activos"
          value={String(stats.activos)}
          sub="en el directorio"
          tone="blu"
          icon={<Building2 size={16} />}
        />
        <Stat
          label="Con facturas abiertas"
          value={String(stats.conDeuda)}
          sub="pendiente o en revisión"
          tone="amb"
          icon={<Check size={16} />}
        />
        <Stat
          label="Deuda total"
          value={pesos(stats.deuda)}
          sub="facturas sin pagar"
          tone="red"
          icon={<UserPlus size={16} />}
        />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        {proveedores.length === 0 ? (
          <div className="dempty" style={{ padding: '40px 0', textAlign: 'center' }}>
            Todavía no hay proveedores. {data.canWrite && 'Crea el primero para empezar el directorio.'}
          </div>
        ) : (
          <div className="tblwrap">
            <table className="tbl">
              <tbody>
                {proveedores.map((p) => (
                  <tr className="trow" key={p.id}>
                    <td>
                      <div className="cename">{p.name}</div>
                      <div className="ceid">
                        {[p.taxId && `RUT ${p.taxId}`, p.category].filter(Boolean).join(' · ') || 'Sin categoría'}
                      </div>
                    </td>
                    <td>
                      <div className="cename">{p.city || '—'}</div>
                      <div className="ceid">Ciudad</div>
                    </td>
                    <td>
                      <div className="cename">{p.contactName || '—'}</div>
                      <div className="ceid" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Phone size={12} />{p.phone || 'Sin teléfono'}
                      </div>
                    </td>
                    <td>
                      <div className="cename">{p.email || '—'}</div>
                      <div className="ceid" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Mail size={12} />Correo
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="cename">{p.facturasPendientes}</div>
                      <div className="ceid">facturas abiertas</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="cename">{pesos(p.deudaCents)}</div>
                      <div className="ceid">deuda</div>
                    </td>
                    {data.canWrite && (
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="iconbtn" onClick={() => openEdit(p)} title="Editar" disabled={pending}>
                          <PenLine size={15} />
                        </button>
                        <button className="iconbtn" onClick={() => remove(p)} title="Eliminar" disabled={pending}>
                          <Trash2 size={15} />
                        </button>
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
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? 'Editar proveedor' : 'Nuevo proveedor'}
        footer={
          <>
            <button className="btn" onClick={() => setDrawerOpen(false)} disabled={pending}>Cancelar</button>
            <button className="btn dark" onClick={submit} disabled={pending || !form.name.trim()}>
              <Check size={15} />Guardar
            </button>
          </>
        }
      >
        <div className="fgrid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="flabel" style={{ gridColumn: '1 / -1' }}>
            Nombre
            <input className="finput" value={form.name} onChange={set('name')} placeholder="Distribuidora XYZ" />
          </label>
          <label className="flabel">
            RUT / NIT
            <input className="finput" value={form.taxId} onChange={set('taxId')} placeholder="901.234.567-8" />
          </label>
          <label className="flabel">
            Categoría
            <input className="finput" value={form.category} onChange={set('category')} placeholder="Materia prima" />
          </label>
          <label className="flabel">
            Contacto
            <input className="finput" value={form.contactName} onChange={set('contactName')} placeholder="Nombre de quien atiende" />
          </label>
          <label className="flabel">
            Teléfono
            <input className="finput" value={form.phone} onChange={set('phone')} placeholder="300 000 0000" />
          </label>
          <label className="flabel">
            Correo
            <input className="finput" type="email" value={form.email} onChange={set('email')} placeholder="ventas@proveedor.com" />
          </label>
          <label className="flabel">
            Ciudad
            <input className="finput" value={form.city} onChange={set('city')} placeholder="Medellín" />
          </label>
          <label className="flabel" style={{ gridColumn: '1 / -1' }}>
            Notas
            <textarea className="finput" rows={3} value={form.notes} onChange={set('notes')} placeholder="Días de entrega, mínimos, observaciones…" />
          </label>
        </div>
      </FormDrawer>
    </>
  )
}