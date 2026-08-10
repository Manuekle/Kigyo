'use client'

import { useState } from 'react'
import FormDrawer from '@/components/ui/FormDrawer'
import Select from '@/components/ui/Select'
import { useErrorShake } from '@/lib/hooks/use-error-shake'
import { ROLES, type RoleKey } from '@/lib/auth/permissions'
import type { EmpleadoRow } from '@/server/queries/empleados'

/**
 * Fallbacks for an organization whose directory is still empty.
 *
 * The lists used to be hardcoded outright — eight departments and five
 * Colombian cities that had nothing to do with the company filling the form.
 * The page now passes whatever the roster already uses; these only stand in
 * when there is nothing to learn from yet.
 */
const DEPT_FALLBACK = ['Administración', 'Comercial', 'Operaciones', 'Finanzas', 'Tecnología']
const LOC_FALLBACK = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Remoto']

export interface NuevoEmpleadoData {
  fullName: string
  position: string
  department: string
  location: string
  accessRole: RoleKey
  /** Employee id (uuid) of the manager, or null for a top-level report. */
  managerId: string | null
  email: string | null
}

interface Props {
  open: boolean
  busy?: boolean
  /** Live roster, used to offer managers by id rather than by typed name. */
  managers: EmpleadoRow[]
  departments: string[]
  locations: string[]
  onClose: () => void
  onCreate: (data: NuevoEmpleadoData) => void
}

export default function NuevoEmpleadoModal({
  open, busy = false, managers, departments, locations, onClose, onCreate,
}: Props) {
  const deptOptions = departments.length > 0 ? departments : DEPT_FALLBACK
  const locOptions = locations.length > 0 ? locations : LOC_FALLBACK

  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [dept, setDept] = useState(deptOptions[0])
  const [loc, setLoc] = useState(locOptions[0])
  const [perm, setPerm] = useState<RoleKey>('Empleado')
  const [managerId, setManagerId] = useState('')
  const [email, setEmail] = useState('')

  // Destructured rather than kept as objects: the React Compiler treats a value
  // holding a ref as a ref itself, and reading through it in render is an error.
  const {
    ref: nameRef, message: nameMsg, isError: nameBad,
    setError: setNameErr, clearError: clearNameErr,
  } = useErrorShake<HTMLInputElement>()
  const {
    ref: roleRef, message: roleMsg, isError: roleBad,
    setError: setRoleErr, clearError: clearRoleErr,
  } = useErrorShake<HTMLInputElement>()
  const {
    ref: mailRef, message: mailMsg, isError: mailBad,
    setError: setMailErr, clearError: clearMailErr,
  } = useErrorShake<HTMLInputElement>()

  function reset() {
    setName(''); setRole(''); setDept(deptOptions[0]); setLoc(locOptions[0])
    setPerm('Empleado'); setManagerId(''); setEmail('')
    clearNameErr(); clearRoleErr(); clearMailErr()
  }

  function handleSubmit() {
    if (busy) return
    // Was three sequential toasts, so a form with two empty fields had to be
    // submitted twice to learn about the second. Every invalid field now shakes
    // at once, next to the field itself.
    let bad = false
    if (!name.trim()) { setNameErr('El nombre es requerido.'); bad = true }
    if (!role.trim()) { setRoleErr('El cargo es requerido.'); bad = true }
    if (email && !/^[^@]+@[^@]+\.[^@]+$/.test(email)) { setMailErr('Correo inválido.'); bad = true }
    if (bad) return

    // No success toast here. The modal does not know whether the write landed —
    // it used to say "agregado al equipo" the instant the button was pressed,
    // before the server had been asked. The page owns the outcome, closes this,
    // and reports what actually happened.
    onCreate({
      fullName: name.trim(),
      position: role.trim(),
      department: dept,
      location: loc,
      accessRole: perm,
      managerId: managerId || null,
      email: email.trim() ? email.trim().toLowerCase() : null,
    })
    reset()
  }

  function handleClose() { reset(); onClose() }

  // Anyone still on the roster can be a manager. Filtering to non-'Empleado'
  // access roles conflated two unrelated things: `access_role` is what the
  // person may open in Kigyo, not where they sit in the reporting line.
  const managerOptions = managers.filter((m) => m.status !== 'Salida')

  return (
    // Seven fields, three of which can grow an inline error message under
    // them. That is a form, not a dialog — it gets the side sheet.
    <FormDrawer
      open={open}
      onClose={handleClose}
      title="Nuevo empleado"
      footer={
        <>
          <button className="btn" onClick={handleClose} disabled={busy}>Cancelar</button>
          <button className="btn dark" onClick={handleSubmit} disabled={busy} aria-busy={busy}>
            {busy ? 'Agregando…' : 'Agregar empleado'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 4 }}>
        <div className="fg2">
          <div className={`t-input-wrap${nameBad ? ' is-error' : ''}`}>
            <div className="flabel">Nombre completo *</div>
            <input
              className={`field t-input${nameBad ? ' is-error' : ''}`}
              placeholder="Ej: María López"
              value={name}
              ref={nameRef}
              disabled={busy}
              onChange={(e) => { setName(e.target.value); clearNameErr() }}
              aria-invalid={nameBad}
            />
            <p className="fielderr t-error-msg" role="alert">{nameMsg}</p>
          </div>
          <div className={`t-input-wrap${roleBad ? ' is-error' : ''}`}>
            <div className="flabel">Cargo *</div>
            <input
              className={`field t-input${roleBad ? ' is-error' : ''}`}
              placeholder="Ej: Analista de Datos"
              value={role}
              ref={roleRef}
              disabled={busy}
              onChange={(e) => { setRole(e.target.value); clearRoleErr() }}
              aria-invalid={roleBad}
            />
            <p className="fielderr t-error-msg" role="alert">{roleMsg}</p>
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
            <div className="flabel">Rol / Permisos</div>
            <Select value={perm} onChange={(v) => setPerm(v as RoleKey)} options={[...ROLES]} />
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

        <div className={`t-input-wrap${mailBad ? ' is-error' : ''}`}>
          <div className="flabel">Correo corporativo</div>
          <input
            className={`field t-input${mailBad ? ' is-error' : ''}`}
            type="email"
            placeholder="nombre@empresa.co"
            value={email}
            ref={mailRef}
            disabled={busy}
            onChange={(e) => { setEmail(e.target.value); clearMailErr() }}
            aria-invalid={mailBad}
          />
          <p className="fielderr t-error-msg" role="alert">{mailMsg}</p>
        </div>
      </div>
    </FormDrawer>
  )
}
