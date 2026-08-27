'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Users, BarChart3, Search, FileSpreadsheet, Plus, ChevronRight, PenLine, RotateCcw, Trash2 } from '@/lib/icons'
import { initials } from '@/lib/utils'
import { useExport } from '@/lib/hooks/use-export'
import { useApp } from '@/lib/context/AppContext'
import { useConfirm } from '@/lib/context/ConfirmContext'
import NuevoEmpleadoModal from '@/components/ui/NuevoEmpleadoModal'
import FormDrawer from '@/components/ui/FormDrawer'
import Select from '@/components/ui/Select'
import LoadMore from '@/components/ui/LoadMore'
import TabBar from '@/components/ui/TabBar'
import { activatable } from '@/lib/a11y'
import { type RoleKey } from '@/lib/auth/permissions'
import type { RoleRow } from '@/server/queries/roles'
import type { EmpleadosData, EmpleadoRow } from '@/server/queries/empleados'
import { createEmpleado, deleteEmpleado, refreshEmpleados, updateEmpleado } from '@/server/mutations/empleados'
import { fetchMoreEmpleados } from '@/server/actions/empleados'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const tone = (st: string): string => (({
  Activo: 'grn', Firmado: 'grn', Asignado: 'grn', Disponible: 'grn',
  Pendiente: 'amb', Onboarding: 'amb', Mantenimiento: 'amb', 'En licencia': 'amb',
  Inactivo: 'neu', Vencido: 'red', Salida: 'red',
} as Record<string, string>)[st] || 'neu')

const Badge = ({ st }: { st: string }) => (
  <span className={`badge b-${tone(st)}`}><span className="bd" />{st}</span>
)

const AV_GRADS: [string, string][] = [
  ['#7aa2ff', '#3b82f6'], ['#3ed694', '#1f9d63'], ['#f0bd5a', '#bf8410'],
  ['#b298f2', '#7c5cd6'], ['#ff8a8d', '#e5484d'], ['#5ed3d6', '#1f9098'],
  ['#f79bc4', '#db5897'], ['#8fd16a', '#4f9e2e'],
]
const avHash = (n = ''): number => { let h = 0; for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) | 0; return Math.abs(h) % AV_GRADS.length }
const Avatar = ({ name, size = 34 }: { name: string; size?: number }) => {
  const [c1, c2] = AV_GRADS[avHash(name)]
  return (
    <div className="av" style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(145deg,${c1},${c2})`, boxShadow: `0 4px 10px -4px ${c2}88` }}>{initials(name)}</div>
  )
}

/* ------------------------------------------------------------------ */
/*  EmpleadoEditor                                                     */
/* ------------------------------------------------------------------ */
type UpdateInput = {
  id: string
  fullName: string
  email: string | null
  position: string
  department: string
  location: string
  status: 'Activo' | 'Inactivo' | 'Onboarding' | 'En licencia' | 'Salida'
  employmentType: 'Tiempo completo' | 'Medio tiempo' | 'Contrato' | 'Prácticas'
  intendedRole: RoleKey
  managerId: string | null
  hiredOn: string | null
  siteId: string | null
}

interface EmpleadoEditorProps {
  emp: EmpleadoRow
  managers: EmpleadoRow[]
  departments: string[]
  locations: string[]
  roles: RoleRow[]
  sites: Array<{ id: string; name: string }>
  busy: boolean
  onClose: () => void
  onSave: (input: UpdateInput) => void
}

/**
 * Edit side sheet, prefilled from the row being edited.
 *
 * `NuevoEmpleadoModal` cannot do duty here: its fields live in its own state
 * with no way to seed them, and it submits an id-less `NuevoEmpleadoData`.
 * Remounting this per row (`key={emp.id}`) is what keeps the prefill honest —
 * the state below starts from the row, not from whatever was edited last.
 */
function EmpleadoEditor({ emp, managers, departments, locations, roles, sites, busy, onClose, onSave }: EmpleadoEditorProps) {
  const { addToast } = useApp()
  // The row's own value is unioned in so a department the organization no
  // longer uses still renders instead of falling back to the placeholder.
  const deptOptions = [...new Set([...departments, ...(emp.department ? [emp.department] : [])])]
  const locOptions = [...new Set([...locations, ...(emp.location ? [emp.location] : [])])]
  // Same union, for the same reason: a role deleted while this sheet was open
  // must still show as the person's current value rather than silently
  // reassigning them to whatever sorts first.
  const roleOptions = roles.some((r) => r.key === emp.intendedRole)
    ? roles.map((r) => ({ value: r.key, label: r.label }))
    : [...roles.map((r) => ({ value: r.key, label: r.label })),
       { value: emp.intendedRole, label: emp.intendedRole }]

  const [name, setName] = useState(emp.fullName)
  const [role, setRole] = useState(emp.position)
  const [dept, setDept] = useState(emp.department || deptOptions[0] || '')
  const [loc, setLoc] = useState(emp.location || locOptions[0] || '')
  const [perm, setPerm] = useState<RoleKey>(emp.intendedRole)
  const [managerId, setManagerId] = useState(emp.managerId ?? '')
  const [email, setEmail] = useState(emp.email ?? '')
  const [siteId, setSiteId] = useState(emp.siteId ?? '')

  function submit() {
    if (busy) return
    if (!name.trim()) { addToast('El nombre es requerido.', 'err'); return }
    if (!role.trim()) { addToast('El cargo es requerido.', 'err'); return }
    if (email && !/^[^@]+@[^@]+\.[^@]+$/.test(email)) { addToast('Correo inválido.', 'err'); return }

    // `status` and `employmentType` are not editable here (matching the create
    // form), so the row's values carry over or the server default would
    // silently flip an Inactivo person back to Activo.
    onSave({
      id: emp.id,
      fullName: name.trim(),
      email: email.trim() ? email.trim().toLowerCase() : null,
      position: role.trim(),
      department: dept,
      location: loc,
      status: emp.status as UpdateInput['status'],
      employmentType: emp.employmentType as UpdateInput['employmentType'],
      intendedRole: perm,
      managerId: managerId || null,
      hiredOn: emp.hiredOn,
      siteId: siteId || null,
    })
  }

  // No self-manager, same rule the server enforces, and no one who has left.
  const managerOptions = managers.filter((m) => m.status !== 'Salida' && m.id !== emp.id)

  return (
    <FormDrawer
      open
      onClose={onClose}
      title="Editar empleado"
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="btn dark" onClick={submit} disabled={busy} aria-busy={busy}>
            {busy ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 4 }}>
        <div className="fg2">
          <div>
            <div className="flabel">Nombre completo *</div>
            <input className="field" placeholder="Ej: María López" value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <div className="flabel">Cargo *</div>
            <input className="field" placeholder="Ej: Analista de Datos" value={role} disabled={busy} onChange={(e) => setRole(e.target.value)} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <div className="flabel">Departamento</div>
            <Select value={dept} onChange={setDept} options={deptOptions} />
          </div>
          <div>
            <div className="flabel">Ubicación</div>
            <Select value={loc} onChange={setLoc} options={locOptions} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <div className="flabel">Rol previsto</div>
            <Select value={perm} onChange={(v) => setPerm(v as RoleKey)} options={roleOptions} />
          </div>
          <div>
            <div className="flabel">Reporta a</div>
            <Select
              value={managerId}
              onChange={setManagerId}
              placeholder="Sin manager"
              options={[
                { value: '', label: 'Sin manager' },
                ...managerOptions.map((m) => ({ value: m.id, label: m.fullName })),
              ]}
            />
          </div>
        </div>

        {sites.length > 1 ? (
          <div className="fg2">
            <div>
              <div className="flabel">Sucursal</div>
              <Select
                value={siteId}
                onChange={setSiteId}
                placeholder="Sin sucursal"
                options={[
                  { value: '', label: 'Sin sucursal' },
                  ...sites.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </div>
            <div>
              <div className="flabel">Correo corporativo</div>
              <input className="field" type="email" placeholder="nombre@empresa.co" value={email} disabled={busy} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
        ) : (
          <div>
            <div className="flabel">Correo corporativo</div>
            <input className="field" type="email" placeholder="nombre@empresa.co" value={email} disabled={busy} onChange={(e) => setEmail(e.target.value)} />
          </div>
        )}
      </div>
    </FormDrawer>
  )
}

/* ------------------------------------------------------------------ */
/*  OrgNode                                                            */
/* ------------------------------------------------------------------ */
interface OrgNodeProps {
  emp: EmpleadoRow
  byManager: Map<string | null, EmpleadoRow[]>
  onOpen: (e: EmpleadoRow) => void
  /** Guards against a cycle the server rejected but an older row still holds. */
  seen: ReadonlySet<string>
}
function OrgNode({ emp, byManager, onOpen, seen }: OrgNodeProps) {
  // Grouped once by the parent instead of a `filter` per node, which walked
  // the whole roster for every card.
  const children = (byManager.get(emp.id) ?? []).filter((c) => !seen.has(c.id))
  const nextSeen = useMemo(() => new Set([...seen, emp.id]), [seen, emp.id])
  const [first, second] = emp.fullName.split(' ')

  return (
    <div className="orgnode">
      <div className="orgcard" onClick={() => onOpen(emp)}>
        <Avatar name={emp.fullName} size={38} />
        <div className="orgname">{first} {second?.[0] ? `${second[0]}.` : ''}</div>
        <div className="orgrole">{emp.position}</div>
        <div className="orgdept">{emp.department}</div>
      </div>
      {children.length > 0 && (
        <div className="orgconnect">
          <div className="orgline-v" />
          <div className="orgchildren">
            {children.map((c) => (
              <div key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {children.length > 1 && (
                  <div style={{ height: 1.5, background: 'var(--line)', width: '100%', marginBottom: 0 }} />
                )}
                <div className="orgline-v" />
                <OrgNode emp={c} byManager={byManager} onOpen={onOpen} seen={nextSeen} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Empleados                                                          */
/* ------------------------------------------------------------------ */
export default function EmpleadosPage({ data }: { data: EmpleadosData }) {
  const confirm = useConfirm()
  const { runExport, exporting } = useExport()
  const { addToast } = useApp()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [view, setView] = useState<'directorio' | 'organigrama'>('directorio')
  const [addOpen, setAddOpen] = useState(false)
  const [creating, startCreating] = useTransition()
  const [editing, setEditing] = useState<EmpleadoRow | null>(null)
  const [mutating, startMutating] = useTransition()

  // Server state. The list used to be seeded into `useState` from a fixture
  // and appended to on create, so a new colleague survived exactly until the
  // next reload. It comes from `employees` now, and every mutation returns the
  // fresh list rather than patching a local copy.
  const [empleados, setEmpleados] = useState<EmpleadoRow[]>(data.empleados)
  const [total, setTotal] = useState(data.empleadosTotal)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  /**
   * The next page of the directory.
   *
   * The organigrama needs this too, and needs it more: a reporting line whose
   * manager has not been loaded draws as a second root, so a partially loaded
   * directory is a chart that is quietly wrong rather than merely short.
   */
  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreEmpleados(empleados.length)
      if (!result.ok) {
        setLoadMoreError(result.error)
        return
      }
      setEmpleados((prev) => {
        const seen = new Set(prev.map((e) => e.id))
        return [...prev, ...result.data.rows.filter((e) => !seen.has(e.id))]
      })
      setTotal(result.data.total)
    })
  }

  /** A mutation returns the fresh first page, and the total that matches it. */
  function applyEmpleados(next: EmpleadosData) {
    setEmpleados(next.empleados)
    setTotal(next.empleadosTotal)
  }

  function refresh() {
    startMutating(async () => {
      const result = await refreshEmpleados()
      if (!result.ok) { addToast(result.error, 'err'); return }
      applyEmpleados(result.data)
      addToast('Directorio actualizado', 'ok')
    })
  }

  async function remove(emp: EmpleadoRow) {
    if (!(await confirm({ title: `¿Retirar a ${emp.fullName} del directorio?`, description: 'Su historial se conserva.' }))) return
    startMutating(async () => {
      const result = await deleteEmpleado(emp.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      applyEmpleados(result.data)
      addToast(`${emp.fullName} retirado del equipo`, 'info')
      // The detail route and the dashboard counters read the same table, so
      // the cache they were rendered from is now stale.
      router.refresh()
    })
  }

  function saveEdit(input: UpdateInput) {
    startMutating(async () => {
      const result = await updateEmpleado(input)
      if (!result.ok) { addToast(result.error, 'err'); return }
      applyEmpleados(result.data)
      setEditing(null)
      addToast(`${input.fullName} actualizado`, 'ok')
      router.refresh()
    })
  }

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return empleados
    return empleados.filter((e) =>
      `${e.fullName} ${e.position} ${e.department} ${e.location} ${e.code ?? ''}`
        .toLowerCase()
        .includes(needle),
    )
  }, [empleados, q])

  const byManager = useMemo(() => {
    const map = new Map<string | null, EmpleadoRow[]>()
    for (const e of empleados) {
      const bucket = map.get(e.managerId)
      if (bucket) bucket.push(e)
      else map.set(e.managerId, [e])
    }
    return map
  }, [empleados])

  // Everyone with no manager is a root. The old chart picked `find` — a single
  // root — so a second top-level person and their whole reporting line were
  // simply not drawn.
  const roots = byManager.get(null) ?? []

  const openEmpleado = (e: EmpleadoRow) => router.push(`/dashboard/empleados/${e.id}`)

  const exportRows = () => {
    void runExport(
      rows.map((e) => ({
        Código: e.code ?? '',
        Nombre: e.fullName,
        Correo: e.email ?? '',
        Cargo: e.position,
        Departamento: e.department,
        Ubicación: e.location,
        Estado: e.status,
        Vinculación: e.employmentType,
      })),
      'empleados-kigyo',
      'empleados',
    )
  }

  return (
    <>
      <div className="card rise d1">
        <div className="chead">
          <TabBar
            value={view}
            onChange={(k) => setView(k as typeof view)}
            items={[
              { key: 'directorio', label: <><Users size={13} />Directorio</> },
              { key: 'organigrama', label: <><BarChart3 size={13} />Organigrama</> },
            ]}
          />
          {view === 'directorio' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div className="search" style={{ width: 220 }}>
                <Search size={15} />
                <input placeholder="Buscar empleado…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportRows}><FileSpreadsheet size={15} />Exportar</button>
              <button className="ibtn" style={{ width: 32, height: 32 }} data-tip="Refrescar" aria-label="Refrescar directorio" disabled={mutating} onClick={refresh}><RotateCcw size={15} /></button>
              {data.canWrite && (
                <button className="btn pri" onClick={() => setAddOpen(true)}><Plus size={15} />Nuevo empleado</button>
              )}
            </div>
          )}
        </div>
        {view === 'directorio' ? (
          <div className="tblwrap">
            <table className="tbl">
              <thead><tr><th scope="col">Empleado</th><th scope="col">Cargo</th><th scope="col">Departamento</th><th scope="col">Ubicación</th><th scope="col">Estado</th><th scope="col"></th></tr></thead>
              <tbody>
                {empleados.length === 0 ? (
                  <tr><td colSpan={6}><div className="dempty dempty-block">
                    {data.canWrite
                      ? 'Todavía no hay nadie en el directorio. Agrega a la primera persona del equipo.'
                      : 'Todavía no hay nadie en el directorio.'}
                  </div></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6}><div className="dempty dempty-block">No se encontraron empleados para &quot;{q}&quot;.</div></td></tr>
                ) : rows.map((e) => (
                  <tr className="trow" key={e.id} style={{ cursor: 'pointer' }} {...activatable(() => openEmpleado(e), `Ver perfil de ${e.fullName}`)}>
                    <td><div className="cemp"><Avatar name={e.fullName} /><div><div className="cename">{e.fullName}</div><div className="ceid mono">{e.code ?? '—'}{e.siteName ? <span> · {e.siteName}</span> : null}</div></div></div></td>
                    <td className="muted">{e.position || '—'}</td>
                    <td className="muted">{e.department || '—'}</td>
                    <td className="muted">{e.location || '—'}</td>
                    <td><Badge st={e.status} /></td>
                    <td style={{ textAlign: 'right' }}>
                      {data.canWrite ? (
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button
                            className="ibtn"
                            style={{ width: 28, height: 28 }}
                            data-tip="Editar"
                            disabled={mutating}
                            aria-label={`Editar a ${e.fullName}`}
                            onClick={(ev) => { ev.stopPropagation(); setEditing(e) }}
                          ><PenLine size={14} /></button>
                          <button
                            className="ibtn"
                            style={{ width: 28, height: 28 }}
                            data-tip="Retirar"
                            disabled={mutating}
                            aria-label={`Retirar a ${e.fullName}`}
                            onClick={(ev) => { ev.stopPropagation(); remove(e) }}
                          ><Trash2 size={14} /></button>
                        </div>
                      ) : (
                        <ChevronRight size={16} color="var(--ink3)" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="orgwrap">
            {/*
              The "Riesgo rotación" and "Desempeño" overlays used to live here.
              Both coloured a named colleague's card from a hardcoded score in
              lib/data/empleados.ts — "Mateo Herrera, riesgo 82%" was a number
              somebody typed, presented as an assessment of a real employee.
              An attrition model does not exist and there is no table behind it.
              Performance could be driven from `evaluations`, which does exist;
              until it is, the chart shows the reporting line and nothing it
              cannot back up.
            */}
            {roots.length === 0 ? (
              <div className="dempty dempty-block">
                {empleados.length === 0
                  ? 'Agrega personas al directorio para ver el organigrama.'
                  : 'Nadie tiene el nivel más alto: asigna jefes para construir el organigrama.'}
              </div>
            ) : (
              roots.map((root) => (
                <OrgNode key={root.id} emp={root} byManager={byManager} onOpen={openEmpleado} seen={EMPTY} />
              ))
            )}
          </div>
        )}

        <LoadMore
          loaded={empleados.length}
          total={total}
          loading={loadingMore}
          error={loadMoreError}
          onLoadMore={loadMore}
          noun="personas"
        />
      </div>

      {data.canWrite && (
        <NuevoEmpleadoModal
          open={addOpen}
          busy={creating}
          managers={empleados}
          departments={data.departments}
          locations={data.locations}
          roles={data.roles}
          sites={data.sites}
          onClose={() => setAddOpen(false)}
          onCreate={(form) =>
            startCreating(async () => {
              const result = await createEmpleado(form)
              if (!result.ok) { addToast(result.error, 'err'); return }
              applyEmpleados(result.data)
              setAddOpen(false)
              addToast(`${form.fullName} agregado al equipo`, 'ok')
              // The detail route and the dashboard counters read the same
              // table, so the cache they were rendered from is now stale.
              router.refresh()
            })
          }
        />
      )}

      {data.canWrite && editing && (
        <EmpleadoEditor
          key={editing.id}
          emp={editing}
          managers={empleados}
          departments={data.departments}
          locations={data.locations}
          roles={data.roles}
          sites={data.sites}
          busy={mutating}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}
    </>
  )
}

/** Stable empty set, so `OrgNode`'s `useMemo` is not invalidated every render. */
const EMPTY: ReadonlySet<string> = new Set()
