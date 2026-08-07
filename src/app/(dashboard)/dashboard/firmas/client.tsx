'use client'

import { useState, useRef, useEffect } from 'react'
import { Trash2, Upload, Plus, Check, PenLine, X, Eraser, AlertCircle } from '@/lib/icons'
import { useApp } from '@/lib/context/AppContext'
import Select from '@/components/ui/Select'

type Firma = {
  id: string
  name: string
  who: string
  type: string
  st: string
  date: string
  days?: number
}

const FIRMAS_SEED: Firma[] = [
  { id: 'DOC-3201', name: 'Contrato laboral', who: 'Sebastián Cano', type: 'Contrato', st: 'Pendiente', date: '18 jun 2026', days: 2 },
  { id: 'DOC-3195', name: 'Política de seguridad', who: 'Juan Pérez', type: 'Política', st: 'Pendiente', date: '12 jun 2026', days: 8 },
  { id: 'DOC-3190', name: 'Anexo de teletrabajo', who: 'María González', type: 'Anexo', st: 'Vencido', date: '02 jun 2026', days: 18 },
  { id: 'DOC-3198', name: 'Acuerdo de confidencialidad', who: 'Valentina Ruiz', type: 'Acuerdo', st: 'Firmado', date: '15 jun 2026' },
  { id: 'DOC-3187', name: 'Contrato laboral', who: 'Laura Jiménez', type: 'Contrato', st: 'Firmado', date: '28 may 2026' },
]

const tone = (st: string): string =>
  ({ Firmado: 'grn', Pendiente: 'amb', Vencido: 'red' }[st] || 'neu')

const Badge = ({ st }: { st: string }) => (
  <span className={`badge b-${tone(st)}`}><span className="bd" />{st}</span>
)

const SC_ICO: Record<string, typeof Check> = { ok: Check, err: X, pending: AlertCircle, warn: AlertCircle }
function StatusCard({
  tone = 'ok',
  title,
  sub,
  children,
}: {
  tone?: string
  title: string
  sub?: string
  children?: React.ReactNode
}) {
  const Ico = SC_ICO[tone] || Check
  return (
    <div className={`statuscard ${tone}`}>
      <div className="scico"><Ico size={22} /></div>
      <div className="sctitle">{title}</div>
      {sub && <div className="scsub">{sub}</div>}
      {children && <div className="scacts">{children}</div>}
    </div>
  )
}

/* ── Modal para registrar/dibujar la firma (sin documento) ── */
type RegisterSignModalProps = {
  open: boolean
  onClose: () => void
  onSave: (url: string) => void
}

function RegisterSignModal(props: RegisterSignModalProps) {
  // Mounting only while open is what clears the pad between uses.
  if (!props.open) return null
  return <RegisterSignModalBody {...props} />
}

function RegisterSignModalBody({ open, onClose, onSave }: RegisterSignModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)
  const [done, setDone] = useState(false)

  // Only the canvas is set up here now. hasInk/done reset by remounting (see
  // the wrapper), so this effect no longer triggers a second render pass on
  // every open.
  useEffect(() => {
    if (!open) return
    const c = canvasRef.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    const w = c.clientWidth, h = c.clientHeight
    c.width = w * dpr; c.height = h * dpr
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h)
    ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1f2937'
    ctxRef.current = ctx
  }, [open])

  const pos = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    const native = (e as React.TouchEvent).nativeEvent ?? e
    const p = 'touches' in native ? native.touches[0] : (native as MouseEvent)
    return { x: p.clientX - r.left, y: p.clientY - r.top }
  }
  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); drawing.current = true
    const { x, y } = pos(e); ctxRef.current!.beginPath(); ctxRef.current!.moveTo(x, y)
  }
  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return
    e.preventDefault()
    const { x, y } = pos(e); ctxRef.current!.lineTo(x, y); ctxRef.current!.stroke()
    if (!hasInk) setHasInk(true)
  }
  const end = () => { drawing.current = false }
  const clear = () => {
    const c = canvasRef.current!
    ctxRef.current!.clearRect(0, 0, c.width, c.height); setHasInk(false)
  }
  const save = () => {
    if (!hasInk) return
    onSave(canvasRef.current!.toDataURL('image/png'))
    setDone(true)
  }

  if (!open) return null
  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal" style={{ width: 580 }} onClick={(e) => e.stopPropagation()}>
        <div className="mhead">
          <div className="mtitle">Registrar tu firma</div>
          <button className="ibtn" onClick={onClose}><X size={18} /></button>
        </div>
        {done ? (
          <StatusCard tone="ok" title="Firma registrada" sub="Tu firma quedó almacenada y se usará para firmar documentos.">
            <button className="btn dark" onClick={onClose}>Cerrar</button>
          </StatusCard>
        ) : (
          <>
            <div className="mbody">
              <div className="sigarea">
                <canvas ref={canvasRef} style={{ background: '#fff', borderRadius: 'var(--r-sm)' }}
                  onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
                  onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
                {!hasInk && <div className="sighint">Dibuja tu firma aquí</div>}
              </div>
              <div className="sigbar"><button onClick={clear}><Eraser size={14} />Limpiar</button></div>
            </div>
            <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={onClose}>Cancelar</button>
              <button className="btn dark" onClick={save} disabled={!hasInk}>Guardar firma</button>
            </div></div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Modal para confirmar firma de un documento ── */
type ConfirmSignModalProps = {
  open: boolean
  doc: Firma | null
  sigUrl: string | null
  onClose: () => void
  onConfirm: () => void
}

function ConfirmSignModal(props: ConfirmSignModalProps) {
  if (!props.open || !props.doc) return null
  // Keyed on the document, so picking a different one mid-flow starts a fresh
  // consent state instead of carrying the previous checkbox across.
  return <ConfirmSignModalBody key={props.doc.id} {...props} doc={props.doc} />
}

function ConfirmSignModalBody({ doc, sigUrl, onClose, onConfirm }: ConfirmSignModalProps & { doc: Firma }) {
  const [agree, setAgree] = useState(false)
  const [err, setErr] = useState(false)
  const [done, setDone] = useState(false)

  const confirm = () => {
    if (!agree) { setErr(true); return }
    onConfirm()
    setDone(true)
  }

  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="mhead">
          <div className="mtitle">Firmar documento</div>
          <button className="ibtn" onClick={onClose}><X size={18} /></button>
        </div>
        {done ? (
          <StatusCard tone="ok" title={`"${doc.name}" firmado`} sub={`${doc.who} · ${doc.type} marcado como completado.`}>
            <button className="btn dark" onClick={onClose}>Cerrar</button>
          </StatusCard>
        ) : (
          <>
            <div className="mbody">
              <div className="elrow">
                <div><div className="eltxt">Documento</div><div className="elsub">{doc.name}</div></div>
                <div><div className="eltxt">ID</div><div className="elsub mono">{doc.id}</div></div>
              </div>
              <div className="elrow">
                <div><div className="eltxt">Empleado</div><div className="elsub">{doc.who}</div></div>
                <div><div className="eltxt">Tipo</div><div className="elsub">{doc.type}</div></div>
              </div>

              <div className="dsect">Tu firma registrada</div>
              <div className="signpad" style={{ background: '#fff', height: 100 }}>
                {sigUrl
                  ? <img src={sigUrl} alt="Firma" style={{ maxHeight: 86, maxWidth: '90%' }} />
                  : <span className="elsub" style={{ color: '#9ca3af' }}>Sin firma — regístrala primero</span>}
              </div>

              <div className={`agree ${err ? 'bad' : ''}`} style={{ marginTop: 12 }}>
                <button className={`sw ${agree ? 'on' : ''}`} onClick={() => { setAgree((v) => !v); setErr(false) }} aria-label="Aceptar términos" />
                <div className="agreetxt">Confirmo que he leído y acepto todos los términos contractuales. Mi firma registrada es legalmente vinculante.</div>
              </div>
              {err && <div className="errline"><AlertCircle size={14} />Confirma que aceptas los términos antes de firmar.</div>}
            </div>
            <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={onClose}>Cancelar</button>
              <button className="btn dark" onClick={confirm}>Aceptar y firmar</button>
            </div></div>
          </>
        )}
      </div>
    </div>
  )
}

export default function FirmasPage() {
  const { addToast } = useApp()
  const [sig, setSig] = useState<string | null>(null)
  const [rows, setRows] = useState<Firma[]>(FIRMAS_SEED)
  const [regOpen, setRegOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmDoc, setConfirmDoc] = useState<Firma | null>(null)
  const [reqForm, setReqForm] = useState({ name: '', who: '', type: 'Contrato' })

  const TIPOS = ['Contrato', 'Política', 'Anexo', 'Acuerdo', 'Otro']

  const request = () => {
    if (!reqForm.name.trim() || !reqForm.who.trim()) { addToast('Completa nombre del documento y empleado', 'warn'); return }
    const id = `DOC-${3200 + Math.floor(Math.random() * 90)}`
    setRows((r) => [{ id, name: reqForm.name, who: reqForm.who, type: reqForm.type, st: 'Pendiente', date: '21 jun 2026', days: 0 }, ...r])
    addToast(`Firma solicitada para "${reqForm.name}"`, 'ok')
    setReqForm({ name: '', who: '', type: 'Contrato' })
  }

  const openConfirm = (doc: Firma) => {
    if (!sig) { addToast('Registra tu firma primero', 'warn'); return }
    setConfirmDoc(doc)
    setConfirmOpen(true)
  }

  const handleConfirm = () => {
    if (!confirmDoc) return
    setRows((r) => r.map((x) => x.id === confirmDoc.id ? { ...x, st: 'Firmado' } : x))
    addToast(`"${confirmDoc.name}" firmado`, 'ok')
  }

  return (
    <div className="g2">
      <div className="card rise d1">
        <div className="chead"><div className="ctitle">Documentos para firma</div><span className="kvs">{rows.length} en total</span></div>
        <table className="tbl">
          <thead><tr><th>Documento</th><th>Empleado</th><th>Tipo</th><th>Fecha</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {rows.map((f) => (
              <tr className="trow" key={f.id}>
                <td><div className="cename">{f.name}</div><div className="ceid mono">{f.id}</div></td>
                <td className="muted">{f.who}</td>
                <td className="muted">{f.type}</td>
                <td className="muted mono" style={{ fontSize: 12 }}>{f.date}</td>
                <td><Badge st={f.st} /></td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    {f.st === 'Pendiente' && (
                      <button className="btn dark" style={{ fontSize: 11, height: 28 }} onClick={() => openConfirm(f)}><Check size={12} />Firmar</button>
                    )}
                    <button className="ibtn" style={{ width: 28, height: 28 }} data-tip="Eliminar" onClick={() => { setRows((r) => r.filter((x) => x.id !== f.id)); addToast('Documento eliminado', 'ok') }}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card cpad rise d2">
          <div className="ctitle" style={{ marginBottom: 14 }}>Subir y solicitar firma</div>
          <div className="flabel" style={{ marginTop: 0 }}>Nombre del documento</div>
          <input className="field" placeholder="Ej. Contrato laboral" value={reqForm.name} onChange={e => setReqForm(f => ({ ...f, name: e.target.value }))} />
          <div className="flabel">Empleado</div>
          <input className="field" placeholder="Ej. Sebastián Cano" value={reqForm.who} onChange={e => setReqForm(f => ({ ...f, who: e.target.value }))} />
          <div className="flabel">Tipo de documento</div>
          <Select options={TIPOS} value={reqForm.type} onChange={v => setReqForm(f => ({ ...f, type: v }))} />
          <div className="flabel">Archivo</div>
          <div className="drop">
            <div className="dico"><Upload size={20} /></div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Arrastra un documento aquí</div>
            <div style={{ color: 'var(--ink2)', fontSize: 12.5, marginTop: 3 }}>PDF, DOCX · hasta 20 MB</div>
          </div>
          <button className="btn dark" style={{ width: '100%', marginTop: 14 }} onClick={request}><Plus size={15} />Solicitar firma</button>
        </div>

        <div className="card cpad rise d3">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div><div className="ctitle">Tu firma</div><div className="kvs" style={{ marginTop: 2 }}>Camila Restrepo · Líder de RRHH</div></div>
            {sig ? <div className="badge b-grn"><Check size={12} />Verificada</div> : <div className="badge b-amb">Pendiente</div>}
          </div>
          <div className="signpad" style={{ background: '#fff' }}>
            {sig
              ? <img src={sig} alt="Firma" style={{ maxHeight: 110, maxWidth: '90%' }} />
              : <span className="elsub" style={{ color: '#9ca3af' }}>Sin firma registrada</span>}
          </div>
          <button className="btn dark" style={{ width: '100%', marginTop: 14 }} onClick={() => setRegOpen(true)}><PenLine size={15} />{sig ? 'Cambiar firma' : 'Registrar firma'}</button>
        </div>
      </div>

      <RegisterSignModal open={regOpen} onClose={() => setRegOpen(false)} onSave={(url) => { setSig(url); addToast('Firma registrada', 'ok') }} />
      <ConfirmSignModal open={confirmOpen} doc={confirmDoc} sigUrl={sig} onClose={() => setConfirmOpen(false)} onConfirm={handleConfirm} />
    </div>
  )
}
