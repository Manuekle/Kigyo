'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, BarChart3, Search, FileSpreadsheet, Plus, ChevronRight } from '@/lib/icons'
import { initials } from '@/lib/utils'
import { useExport } from '@/lib/hooks/use-export'
import { EMPLEADOS, ROTATION_RISK } from '@/lib/data/empleados'
import type { Empleado } from '@/lib/types'
import NuevoEmpleadoModal from '@/components/ui/NuevoEmpleadoModal'
import TabBar from '@/components/ui/TabBar'
import { activatable } from '@/lib/a11y'

/* ------------------------------------------------------------------ */
/*  Page-local data (verbatim from original single-file app)           */
/* ------------------------------------------------------------------ */
const EVALUACIONES = [
  { id: 'EV-01', name: 'María González', periodo: 'Q2 2026', score: 4.6, objetivos: '5/5', st: 'Completada' },
  { id: 'EV-02', name: 'Juan Pérez', periodo: 'Q2 2026', score: 4.1, objetivos: '4/5', st: 'Completada' },
  { id: 'EV-03', name: 'Valentina Ruiz', periodo: 'Q2 2026', score: 3.2, objetivos: '2/5', st: 'Completada' },
  { id: 'EV-04', name: 'Daniel Ospina', periodo: 'Q2 2026', score: null, objetivos: '—', st: 'Pendiente' },
  { id: 'EV-05', name: 'Sebastián Cano', periodo: 'Q2 2026', score: null, objetivos: '—', st: 'Pendiente' },
]

/* ------------------------------------------------------------------ */
/*  Page-local helpers (inline to match original render exactly)       */
/* ------------------------------------------------------------------ */
const tone = (st: string): string => (({
  Activo: 'grn', Firmado: 'grn', Asignado: 'grn', Disponible: 'grn',
  Pendiente: 'amb', Onboarding: 'amb', Mantenimiento: 'amb', 'En licencia': 'amb',
  Inactivo: 'neu', Vencido: 'red',
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
  emp: Empleado
  all: Empleado[]
  onOpen: (e: Empleado) => void
  overlay: string | null
}
function OrgNode({ emp, all, onOpen, overlay }: OrgNodeProps) {
  const children = all.filter((e) => e.manager === emp.name)
  let badgeColor: string | null = null
  if (overlay === 'riesgo') {
    const r = ROTATION_RISK.find((x) => x.name === emp.name)
    if (r) badgeColor = r.riesgo >= 60 ? 'var(--redd)' : r.riesgo >= 35 ? 'var(--amb)' : 'var(--grn)'
  } else if (overlay === 'desempeno') {
    const ev = EVALUACIONES.find((e) => e.name === emp.name)
    if (ev?.score) badgeColor = ev.score >= 4 ? 'var(--grn)' : ev.score >= 3.5 ? 'var(--amb)' : 'var(--redd)'
  }
  return (
    <div className="orgnode">
      <div className="orgcard"
        style={badgeColor ? { borderColor: badgeColor, boxShadow: `0 0 0 3px color-mix(in srgb, ${badgeColor} 16%, transparent)` } : {}}
        onClick={() => onOpen(emp)}>
        <div style={{ position: 'relative' }}>
          <Avatar name={emp.name} size={38} />
          {badgeColor && <span className="orgnode-badge" style={{ background: badgeColor }} />}
        </div>
        <div className="orgname">{emp.name.split(' ')[0]} {emp.name.split(' ')[1]?.[0]}.</div>
        <div className="orgrole">{emp.role}</div>
        <div className="orgdept">{emp.dept}</div>
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
                <OrgNode emp={c} all={all} onOpen={onOpen} overlay={overlay} />
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
export default function EmpleadosPage() {
  const { runExport, exporting } = useExport()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [view, setView] = useState<'directorio' | 'organigrama'>('directorio')
  const [overlay, setOverlay] = useState('ninguno')
  const [addOpen, setAddOpen] = useState(false)
  // Held in state rather than read straight off the seed, so a newly added
  // person shows up in the directory and the org chart.
  const [empleados, setEmpleados] = useState<Empleado[]>(EMPLEADOS)

  const rows = empleados.filter((e) =>
    (e.name + e.role + e.dept + e.loc).toLowerCase().includes(q.toLowerCase()))
  const root = empleados.find((e) => !e.manager)

  const openEmpleado = (e: Empleado) => router.push(`/dashboard/empleados/${e.id}`)

  const exportRows = () => {
    void runExport(rows.map((e) => ({ ID: e.id, Nombre: e.name, Cargo: e.role, Departamento: e.dept, Ubicación: e.loc, Estado: e.st })), 'empleados-kigyo', 'empleados')
  }

  const overlays: [string, string][] = [['ninguno', 'Estándar'], ['riesgo', 'Riesgo rotación'], ['desempeno', 'Desempeño']]
  const legend: [string, string][] = [['var(--grn)', 'Alto'], ['var(--amb)', 'Medio'], ['var(--redd)', 'Bajo/Riesgo']]

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
              <button className="btn pri" onClick={() => setAddOpen(true)}><Plus size={15} />Nuevo empleado</button>
            </div>
          )}
        </div>
        {view === 'directorio' ? (
          <div className="tblwrap">
            <table className="tbl">
              <thead><tr><th scope="col">Empleado</th><th scope="col">Cargo</th><th scope="col">Departamento</th><th scope="col">Ubicación</th><th scope="col">Estado</th><th scope="col"></th></tr></thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6}><div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>No se encontraron empleados para &quot;{q}&quot;.</div></td></tr>
                ) : rows.map((e) => (
                  <tr className="trow" key={e.id} style={{ cursor: 'pointer' }} {...activatable(() => openEmpleado(e), `Ver perfil de ${e.name}`)}>
                    <td><div className="cemp"><Avatar name={e.name} /><div><div className="cename">{e.name}</div><div className="ceid mono">{e.id}</div></div></div></td>
                    <td className="muted">{e.role}</td>
                    <td className="muted">{e.dept}</td>
                    <td className="muted">{e.loc}</td>
                    <td><Badge st={e.st} /></td>
                    <td style={{ textAlign: 'right' }}><ChevronRight size={16} color="#c4c4cc" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="orgwrap">
            <div className="orgmetasel">
              <span className="kvs">Ver por:</span>
              {overlays.map(([id, lbl]) => (
                <button key={id} className={`chip ${overlay === id ? 'on' : ''}`} onClick={() => setOverlay(id)}>{lbl}</button>
              ))}
              {overlay !== 'ninguno' && (
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {legend.map(([c, l]) => (
                    <span key={l} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />{l}
                    </span>
                  ))}
                </span>
              )}
            </div>
            {root && <OrgNode emp={root} all={empleados} onOpen={openEmpleado} overlay={overlay === 'ninguno' ? null : overlay} />}
          </div>
        )}
      </div>
      <NuevoEmpleadoModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={(data) =>
          setEmpleados((prev) => [
            ...prev,
            {
              id: Math.max(0, ...prev.map((e) => e.id)) + 1,
              name: data.name,
              role: data.role,
              dept: data.dept,
              loc: data.loc,
              st: 'Activo',
              perm: data.perm as Empleado['perm'],
              ...(data.manager ? { manager: data.manager } : {}),
            },
          ])
        }
      />
    </>
  )
}
