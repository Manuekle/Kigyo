'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import { useApp } from '@/lib/context/AppContext'
import { EMPLEADOS } from '@/lib/data/empleados'

const DEPTS = ['Recursos Humanos', 'Tecnología', 'Finanzas', 'Diseño', 'Ventas', 'Legal', 'Operaciones', 'Marketing']
const LOCS = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Remoto']
const PERMS = ['Administrador', 'Líder de equipo', 'Empleado']

export interface NuevoEmpleadoData {
  name: string
  role: string
  dept: string
  loc: string
  perm: string
  manager: string
}

interface Props {
  open: boolean
  onClose: () => void
  onCreate: (data: NuevoEmpleadoData) => void
}

export default function NuevoEmpleadoModal({ open, onClose, onCreate }: Props) {
  const { addToast } = useApp()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [dept, setDept] = useState(DEPTS[0])
  const [loc, setLoc] = useState(LOCS[0])
  const [perm, setPerm] = useState('Empleado')
  const [manager, setManager] = useState('')
  const [email, setEmail] = useState('')

  function reset() { setName(''); setRole(''); setDept(DEPTS[0]); setLoc(LOCS[0]); setPerm('Empleado'); setManager(''); setEmail('') }

  function handleSubmit() {
    if (!name.trim()) { addToast('El nombre es requerido', 'err'); return }
    if (!role.trim()) { addToast('El cargo es requerido', 'err'); return }
    if (email && !/^[^@]+@[^@]+\.[^@]+$/.test(email)) { addToast('Correo inválido', 'err'); return }
    // The toast used to be the whole of it — the form reported success and
    // dropped everything it had collected. The directory owns the list, so
    // creation goes back to it.
    onCreate({ name: name.trim(), role: role.trim(), dept, loc, perm, manager })
    addToast(`${name} agregado al equipo`, 'ok')
    reset()
    onClose()
  }

  function handleClose() { reset(); onClose() }

  const managers = EMPLEADOS.filter((e) => e.st === 'Activo' && e.perm !== 'Empleado')

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Nuevo empleado"
      footer={
        <>
          <button className="btn" onClick={handleClose}>Cancelar</button>
          <button className="btn dark" onClick={handleSubmit}>Agregar empleado</button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 4 }}>
        <div className="fg2">
          <div>
            <div className="flabel">Nombre completo *</div>
            <input className="field" placeholder="Ej: María López" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <div className="flabel">Cargo *</div>
            <input className="field" placeholder="Ej: Analista de Datos" value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <div className="flabel">Departamento</div>
            <Select value={dept} onChange={setDept} options={DEPTS} />
          </div>
          <div>
            <div className="flabel">Ubicación</div>
            <Select value={loc} onChange={setLoc} options={LOCS} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <div className="flabel">Rol / Permisos</div>
            <Select value={perm} onChange={setPerm} options={PERMS} />
          </div>
          <div>
            <div className="flabel">Reporta a</div>
            <Select
              value={manager}
              onChange={setManager}
              placeholder="Sin manager"
              options={[{ value: '', label: 'Sin manager' }, ...managers.map((m) => ({ value: m.name, label: m.name }))]}
            />
          </div>
        </div>

        <div>
          <div className="flabel">Correo corporativo</div>
          <input className="field" type="email" placeholder="nombre@empresa.co" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
