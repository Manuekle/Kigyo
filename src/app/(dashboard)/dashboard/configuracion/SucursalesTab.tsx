'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Plus, Trash2, PenLine, MapPin } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import FormDrawer from '@/components/ui/FormDrawer'
import Toggle from '@/components/ui/Toggle'
import { useApp } from '@/lib/context/AppContext'
import { useMember } from '@/lib/context/MemberContext'
import { archiveSite, createSite, setMemberSites, updateSite } from '@/server/mutations/sites'
import type { SitesData } from '@/server/queries/sites'

/**
 * Branches, and who is limited to which.
 *
 * The wording throughout says *limit*, never *grant*, because that is what the
 * data means: somebody with no branches ticked sees all of them. Getting that
 * backwards in the copy would be worse than getting it backwards in the code —
 * an administrator who believes ticking a box grants access will untick them
 * all to revoke it, and hand the person the whole company instead.
 */

const EMPTY = { name: '', code: '', address: '', city: '', phone: '' }

interface Props {
  data: SitesData
  members: Array<{ userId: string; fullName: string; role: string }>
  canManage: boolean
}

export default function SucursalesTab({ data, members, canManage }: Props) {
  const member = useMember()
  const router = useRouter()
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [assigning, setAssigning] = useState<Props['members'][number] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const plan = member.planDef
  const max = plan.maxSitesPerCompany
  const canAdd = canManage && (max === null || data.sites.length < max)

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, msg: string) {
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) {
        addToast(result.error, 'err')
        return
      }
      addToast(msg, 'ok')
      setOpen(false)
      setAssigning(null)
      setEditingId(null)
      setForm(EMPTY)
      router.refresh()
    })
  }

  return (
    <>
      <div className="ctitle" style={{ marginBottom: 6 }}>Sucursales</div>
      <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 16, maxWidth: 620, lineHeight: 1.55 }}>
        Una empresa sin sucursales funciona igual que siempre. Cuando las creas,
        puedes limitar a una persona a algunas de ellas — y quien no tenga ninguna
        marcada las ve todas.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span style={{ fontSize: 12.5, color: 'var(--ink3)' }}>
          {max === null
            ? `${data.sites.length} sucursales · plan ${plan.label}, sin límite`
            : `${data.sites.length} de ${max} · plan ${plan.label}`}
        </span>
        <div style={{ flex: 1 }} />
        <button
          className="btn dark"
          disabled={!canAdd || pending}
          title={canAdd ? undefined : `Tu plan ${plan.label} no permite más sucursales.`}
          onClick={() => { setEditingId(null); setForm(EMPTY); setOpen(true) }}
        >
          <Plus size={15} />Nueva sucursal
        </button>
      </div>

      {data.sites.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--ink3)', padding: '18px 0' }}>
          Todavía no hay sucursales. Los registros que crees seguirán perteneciendo a
          toda la empresa.
        </div>
      ) : (
        data.sites.map((site) => (
          <div
            key={site.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 0', borderBottom: '1px solid var(--line2)',
            }}
          >
            <MapPin size={16} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 13.5 }}>{site.name}</strong>
                {site.isDefault && <Badge st="Por defecto" tone="grn" />}
                {site.code && <span style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{site.code}</span>}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 2 }}>
                {[site.city, site.address].filter(Boolean).join(' · ') || 'Sin dirección'}
                {site.memberCount > 0 && ` · ${site.memberCount} persona${site.memberCount === 1 ? '' : 's'} limitada${site.memberCount === 1 ? '' : 's'} a ella`}
              </div>
            </div>
            {canManage && (
              <>
                <button
                  className="ibtn"
                  aria-label={`Editar ${site.name}`}
                  disabled={pending}
                  onClick={() => {
                    setEditingId(site.id)
                    setForm({
                      name: site.name, code: site.code ?? '', address: site.address ?? '',
                      city: site.city ?? '', phone: site.phone ?? '',
                    })
                    setOpen(true)
                  }}
                >
                  <PenLine size={15} />
                </button>
                <button
                  className="ibtn"
                  aria-label={`Archivar ${site.name}`}
                  disabled={pending}
                  onClick={() => run(() => archiveSite(site.id), `${site.name} archivada`)}
                >
                  <Trash2 size={15} />
                </button>
              </>
            )}
          </div>
        ))
      )}

      {data.sites.length > 0 && canManage && (
        <>
          <div className="ctitle" style={{ marginTop: 26, marginBottom: 6 }}>
            Quién está limitado a qué
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 12, maxWidth: 620, lineHeight: 1.55 }}>
            Sin nada marcado, la persona ve todas las sucursales. Marcar una o varias la
            limita a esas.
          </div>
          {members.map((m) => {
            const assigned = data.assignments[m.userId] ?? []
            return (
              <div
                key={m.userId}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0', borderBottom: '1px solid var(--line2)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5 }}>{m.fullName}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 2 }}>
                    {assigned.length === 0
                      ? 'Todas las sucursales'
                      : data.sites
                          .filter((s) => assigned.includes(s.id))
                          .map((s) => s.name)
                          .join(', ')}
                  </div>
                </div>
                <button
                  className="btn"
                  disabled={pending}
                  onClick={() => { setAssigning(m); setPicked(new Set(assigned)) }}
                >
                  Limitar
                </button>
              </div>
            )
          })}
        </>
      )}

      <FormDrawer
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? 'Editar sucursal' : 'Nueva sucursal'}
        footer={
          <button
            className="btn dark"
            disabled={pending}
            onClick={() =>
              run(
                () => editingId
                  ? updateSite({ id: editingId, ...form })
                  : createSite(form),
                editingId ? 'Sucursal actualizada' : 'Sucursal creada',
              )
            }
          >
            <Check size={15} />{editingId ? 'Guardar cambios' : 'Crear sucursal'}
          </button>
        }
      >
        <label className="flabel" htmlFor="st-name">Nombre</label>
        <input id="st-name" className="field" value={form.name} maxLength={120}
          placeholder="Sede Norte"
          onChange={(e) => setForm({ ...form, name: e.target.value })} />

        <label className="flabel" htmlFor="st-code">Código</label>
        <input id="st-code" className="field" value={form.code} maxLength={20}
          placeholder="Opcional — único dentro de la empresa"
          onChange={(e) => setForm({ ...form, code: e.target.value })} />

        <label className="flabel" htmlFor="st-city">Ciudad</label>
        <input id="st-city" className="field" value={form.city} maxLength={80}
          onChange={(e) => setForm({ ...form, city: e.target.value })} />

        <label className="flabel" htmlFor="st-address">Dirección</label>
        <input id="st-address" className="field" value={form.address} maxLength={200}
          onChange={(e) => setForm({ ...form, address: e.target.value })} />

        <label className="flabel" htmlFor="st-phone">Teléfono</label>
        <input id="st-phone" className="field" value={form.phone} maxLength={40}
          onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={assigning !== null}
        onClose={() => setAssigning(null)}
        title={`Limitar a ${assigning?.fullName ?? ''}`}
        footer={
          <button
            className="btn dark"
            disabled={pending}
            onClick={() =>
              run(
                () => setMemberSites({
                  userId: assigning!.userId,
                  siteIds: [...picked],
                }),
                picked.size === 0
                  ? `${assigning?.fullName} ve todas las sucursales`
                  : `${assigning?.fullName} limitada a ${picked.size} sucursal${picked.size === 1 ? '' : 'es'}`,
              )
            }
          >
            <Check size={15} />Guardar
          </button>
        }
      >
        {/* Said before the switches, because the empty state is the one that
            surprises people: no ticks means everything, not nothing. */}
        <p className="psub" style={{ fontSize: 12.5 }}>
          {picked.size === 0
            ? 'Sin nada marcado, esta persona ve todas las sucursales — que es lo mismo que no limitarla.'
            : `Verá solo ${picked.size === 1 ? 'la sucursal marcada' : 'las sucursales marcadas'}, más los registros que no pertenecen a ninguna.`}
        </p>
        {data.sites.map((site) => (
          <div
            key={site.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 0', borderBottom: '1px solid var(--line2)',
            }}
          >
            <div style={{ flex: 1 }}>{site.name}</div>
            <Toggle
              on={picked.has(site.id)}
              ariaLabel={`Limitar a ${site.name}`}
              onChange={() => {
                const next = new Set(picked)
                if (next.has(site.id)) next.delete(site.id)
                else next.add(site.id)
                setPicked(next)
              }}
            />
          </div>
        ))}
      </FormDrawer>
    </>
  )
}
