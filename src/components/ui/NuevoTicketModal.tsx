'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import { useErrorShake } from '@/lib/hooks/use-error-shake'

const PRIOS = ['Alta', 'Media', 'Baja']

export interface NuevoTicketData {
  subject: string
  area: string
  priority: string
  /** Employee id (uuid), or null. The requester comes from the session. */
  assigneeId: string | null
  body: string
  /** El cliente al que refiere, cuando el ticket viene de un cliente. */
  clientId: string | null
}

interface Props {
  open: boolean
  busy?: boolean
  onClose: () => void
  /** The board's own areas, so a new ticket lands under a tab that exists. */
  areas: string[]
  /** Live directory. Empty when the caller cannot read `empleados`. */
  roster: Array<{ employeeId: string; fullName: string }>
  /** Directorio de clientes. Vacío sin clientes:read. */
  clientes: Array<{ id: string; name: string }>
  onCreate: (data: NuevoTicketData) => void
}

export default function NuevoTicketModal({ open, busy = false, onClose, areas, roster, clientes, onCreate }: Props) {
  const [title, setTitle] = useState('')
  const [area, setArea] = useState(areas[0])
  const [prio, setPrio] = useState('Media')
  const [assigneeId, setAssigneeId] = useState('')
  const [clientId, setClientId] = useState('')
  const [desc, setDesc] = useState('')

  // Destructured rather than kept as an object: the React Compiler treats a
  // value holding a ref as a ref itself, and reading through it in render is
  // an error.
  const {
    ref: titleRef, message: titleMsg, isError: titleBad,
    setError: setTitleErr, clearError: clearTitleErr,
  } = useErrorShake<HTMLInputElement>()

  function reset() {
    setTitle(''); setArea(areas[0]); setPrio('Media'); setAssigneeId(''); setClientId(''); setDesc('')
    clearTitleErr()
  }

  function handleSubmit() {
    if (busy) return
    // Was a toast, which announced the problem in the corner of the screen
    // while the empty field it was about sat untouched in the middle of it.
    if (!title.trim()) { setTitleErr('El título es requerido.'); return }

    // No success toast here. The modal does not know whether the insert
    // landed — it used to say "Ticket creado" the instant the button was
    // pressed. The board owns the outcome and reports what happened.
    onCreate({
      subject: title.trim(),
      area,
      priority: prio,
      assigneeId: assigneeId || null,
      body: desc.trim(),
      clientId: clientId || null,
    })
    reset()
  }

  function handleClose() { reset(); onClose() }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Nuevo ticket"
      footer={
        <>
          <button className="btn" onClick={handleClose} disabled={busy}>Cancelar</button>
          <button className="btn dark" onClick={handleSubmit} disabled={busy} aria-busy={busy}>
            {busy ? 'Creando…' : 'Crear ticket'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 4 }}>
        <div className={`t-input-wrap${titleBad ? ' is-error' : ''}`}>
          <div className="flabel">Título *</div>
          <input
            className={`field t-input${titleBad ? ' is-error' : ''}`}
            placeholder="Describe el ticket…"
            value={title}
            ref={titleRef}
            disabled={busy}
            onChange={(e) => { setTitle(e.target.value); clearTitleErr() }}
            aria-invalid={titleBad}
          />
          <p className="fielderr t-error-msg" role="alert">{titleMsg}</p>
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

        {/* Assigning needs the directory. The list used to come from the
            `EMPLEADOS` fixture and stored the person's *name* on the ticket,
            so a rename orphaned the assignment and a colleague who did not
            exist could be assigned work. It is an employee id now, and the
            control only appears when there is a roster to offer. */}
        {roster.length > 0 && (
          <div>
            <div className="flabel">Asignar a</div>
            <Select
              value={assigneeId}
              onChange={setAssigneeId}
              placeholder="Sin asignar"
              options={[
                { value: '', label: 'Sin asignar' },
                ...roster.map((r) => ({ value: r.employeeId, label: r.fullName })),
              ]}
            />
          </div>
        )}

        {/* El paso barato del CRM: un ticket puede venir de un cliente y
            entonces aparece en su ficha. Sin clientes:read, no hay selector
            y el ticket nace interno. */}
        {clientes.length > 0 && (
          <div>
            <div className="flabel">Cliente</div>
            <Select
              value={clientId}
              onChange={setClientId}
              placeholder="Ticket interno, sin cliente"
              options={[
                { value: '', label: 'Ticket interno, sin cliente' },
                ...clientes.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </div>
        )}

        <div>
          <div className="flabel">Descripción</div>
          <textarea
            className="field"
            placeholder="Detalla el contexto o los pasos necesarios…"
            value={desc}
            disabled={busy}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            style={{ borderRadius: 16, resize: 'vertical' }}
          />
        </div>
      </div>
    </Modal>
  )
}
