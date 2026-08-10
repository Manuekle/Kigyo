'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Users, BarChart3, Search, FileSpreadsheet, Plus, ChevronRight } from '@/lib/icons'
import { initials } from '@/lib/utils'
import { useExport } from '@/lib/hooks/use-export'
import { useApp } from '@/lib/context/AppContext'
import NuevoEmpleadoModal from '@/components/ui/NuevoEmpleadoModal'
import LoadMore from '@/components/ui/LoadMore'
import TabBar from '@/components/ui/TabBar'
import { activatable } from '@/lib/a11y'
import type { EmpleadosData, EmpleadoRow } from '@/server/queries/empleados'
import { createEmpleado } from '@/server/mutations/empleados'
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
  const { runExport, exporting } = useExport()
  const { addToast } = useApp()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [view, setView] = useState<'directorio' | 'organigrama'>('directorio')
  const [addOpen, setAddOpen] = useState(false)
  const [creating, startCreating] = useTransition()

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
                  <tr><td colSpan={6}><div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                    {data.canWrite
                      ? 'Todavía no hay nadie en el directorio. Agrega a la primera persona del equipo.'
                      : 'Todavía no hay nadie en el directorio.'}
                  </div></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6}><div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>No se encontraron empleados para &quot;{q}&quot;.</div></td></tr>
                ) : rows.map((e) => (
                  <tr className="trow" key={e.id} style={{ cursor: 'pointer' }} {...activatable(() => openEmpleado(e), `Ver perfil de ${e.fullName}`)}>
                    <td><div className="cemp"><Avatar name={e.fullName} /><div><div className="cename">{e.fullName}</div><div className="ceid mono">{e.code ?? '—'}</div></div></div></td>
                    <td className="muted">{e.position || '—'}</td>
                    <td className="muted">{e.department || '—'}</td>
                    <td className="muted">{e.location || '—'}</td>
                    <td><Badge st={e.status} /></td>
                    <td style={{ textAlign: 'right' }}><ChevronRight size={16} color="var(--ink3)" /></td>
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
              <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
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
          onClose={() => setAddOpen(false)}
          onCreate={(form) =>
            startCreating(async () => {
              const result = await createEmpleado(form)
              if (!result.ok) { addToast(result.error, 'err'); return }
              setEmpleados(result.data.empleados)
              setTotal(result.data.empleadosTotal)
              setAddOpen(false)
              addToast(`${form.fullName} agregado al equipo`, 'ok')
              // The detail route and the dashboard counters read the same
              // table, so the cache they were rendered from is now stale.
              router.refresh()
            })
          }
        />
      )}
    </>
  )
}

/** Stable empty set, so `OrgNode`'s `useMemo` is not invalidated every render. */
const EMPTY: ReadonlySet<string> = new Set()
