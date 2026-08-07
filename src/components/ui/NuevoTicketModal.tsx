'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import { useApp } from '@/lib/context/AppContext'
import { EMPLEADOS } from '@/lib/data/empleados'

const PRIOS = ['Alta', 'Media', 'Baja']

export interface NuevoTicketData {
  asunto: string
  area: string
  prio: string
  quien: string
  desc: string
}

interface Props {
  open: boolean
  onClose: () => void
  /** The board's own areas, so a new ticket lands under a tab that exists. */
  areas: string[]
  onCreate: (data: NuevoTicketData) => void
}

export default function NuevoTicketModal({ open, onClose, areas, onCreate }: Props) {
  const { addToast } = useApp()
  const [title, setTitle] = useState('')
  const [area, setArea] = useState(areas[0])
  const [prio, setPrio] = useState('Media')
  const [assigned, setAssigned] = useState('')
  const [desc, setDesc] = useState('')

  function reset() { setTitle(''); setArea(areas[0]); setPrio('Media'); setAssigned(''); setDesc('') }

  function handleSubmit() {
    if (!title.trim()) { addToast('El título es requerido', 'err'); return }
    // The toast used to be the whole of it — the ticket was announced and then
    // thrown away. The board owns the list, so creation goes back to it.
    onCreate({ asunto: title.trim(), area, prio, quien: assigned || 'Sin asignar', desc: desc.trim() })
    addToast(`Ticket "${title}" creado`, 'ok')
    reset()
    onClose()
  }

  function handleClose() { reset(); onClose() }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Nuevo ticket"
      footer={
        <>
          <button className="btn" onClick={handleClose}>Cancelar</button>
          <button className="btn dark" onClick={handleSubmit}>Crear ticket</button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 4 }}>
        <div>
          <div className="flabel">Título *</div>
          <input className="field" placeholder="Describe el ticket…" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="fg2">
          <div>
            <div className="flabel">Área</div>
            <Select value={area} onChange={setArea} options={areas} />
          </div>
          <div>
            <div className="flabel">Prioridad</div>
            <Select value={prio} onChange={setPrio} options={PRIOS} />
          </div>
        </div>

        <div>
          <div className="flabel">Asignar a</div>
          <Select
            value={assigned}
            onChange={setAssigned}
            placeholder="Sin asignar"
            options={[{ value: '', label: 'Sin asignar' }, ...EMPLEADOS.filter((e) => e.st === 'Activo').map((e) => ({ value: e.name, label: `${e.name} — ${e.role}` }))]}
          />
        </div>

        <div>
          <div className="flabel">Descripción</div>
          <textarea
            className="field"
            placeholder="Detalla el contexto o los pasos necesarios…"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            style={{ borderRadius: 16, resize: 'vertical' }}
          />
        </div>
      </div>
    </Modal>
  )
}
