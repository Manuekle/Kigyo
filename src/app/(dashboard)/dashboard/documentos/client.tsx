'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Upload, FileText,
  X, ChevronDown, Users, Link2, Check, ShieldCheck, Copy, Type, Bold, Italic,
  Underline, Strikethrough, List, ListOrdered, Image, Quote,
  Calendar, ChevronLeft, PenLine, Trash2, Share2,
} from '@/lib/icons'
import Stat from '@/components/ui/Stat'
import { useApp } from '@/lib/context/AppContext'
import { apiFetch, errorMessage } from '@/lib/api/client'

type RewriteInstruction =
  | 'mejorar' | 'acortar' | 'ampliar'
  | 'formal' | 'profesional' | 'cercano' | 'conciso' | 'optimista'

type Doc = {
  id: string
  name: string
  type: string
  folder: string
  who: string
  date: string
  tags: string[]
  ai: string
  url?: string
}

const FOLDERS = [
  { key: 'contratos', name: 'Contratos', color: '#7aa2ff' },
  { key: 'politicas', name: 'Políticas', color: '#3ed694' },
  { key: 'actas', name: 'Actas', color: '#f0bd5a' },
  { key: 'planes', name: 'Planes', color: '#b298f2' },
  { key: 'manuales', name: 'Manuales', color: '#a6a6b2' },
  { key: 'otros', name: 'Otros', color: '#5ed3d6' },
]

const DOCS_SEED: Doc[] = [
  { id: 'F-9001', name: 'Manual de convivencia', type: 'Política', folder: 'manuales', who: 'Personas', date: 'Jun 2026', tags: ['Vigente', 'Reglamento'], ai: 'Sin riesgos' },
  { id: 'F-9002', name: 'Contrato laboral — plantilla', type: 'Contrato', folder: 'contratos', who: 'Legal', date: 'May 2026', tags: ['Plantilla'], ai: 'Cláusula a revisar' },
  { id: 'F-9003', name: 'Política de datos personales', type: 'Política', folder: 'politicas', who: 'Legal', date: 'Abr 2026', tags: ['Habeas Data', 'Confidencial'], ai: 'Vence 30 sep' },
  { id: 'F-9004', name: 'Acta de entrega de equipo', type: 'Acta', folder: 'actas', who: 'TI', date: 'Jun 2026', tags: ['Inventario'], ai: 'Sin riesgos' },
  { id: 'F-9005', name: 'Plan de capacitación 2026', type: 'Plan', folder: 'planes', who: 'Personas', date: 'Feb 2026', tags: ['Formación'], ai: 'Sin riesgos' },
  { id: 'F-9006', name: 'Reglamento de seguridad', type: 'Política', folder: 'politicas', who: 'SST', date: 'Ene 2026', tags: ['SST', 'Obligatorio'], ai: 'Falta firma' },
  { id: 'F-9007', name: 'Contrato de confidencialidad', type: 'Contrato', folder: 'contratos', who: 'Legal', date: 'Mar 2026', tags: ['Confidencial'], ai: 'Sin riesgos' },
  { id: 'F-9008', name: 'Acta de comité SST', type: 'Acta', folder: 'actas', who: 'SST', date: 'May 2026', tags: ['SST'], ai: 'Pendiente revisión' },
]

const UPLOAD_NAMES = [
  'Política de vacaciones 2026.pdf',
  'Acta de comité SST — junio.pdf',
  'Anexo contractual — teletrabajo.pdf',
]

const SHARE_PEOPLE = [
  { name: 'Camila Restrepo', email: 'camila.r@empresa.co', owner: true, role: 'Propietario' },
  { name: 'Juan Pérez', email: 'juan.p@empresa.co', role: 'Puede editar' },
  { name: 'Laura Jiménez', email: 'laura.j@empresa.co', role: 'Puede ver' },
]

const COMPOSER_SEED = 'Estimado equipo,\n\nLes compartimos la actualización de la política de teletrabajo, vigente a partir del próximo mes. Por favor revisen los puntos clave y confirmen su lectura.\n\nQuedamos atentos a sus comentarios.'
/**
 * Rewrite instructions the server accepts. The set is fixed on both sides —
 * /api/ai/rewrite validates against the same keys — because the document body
 * is user-authored content and letting the client also supply the instruction
 * would turn the endpoint into an open prompt.
 */
const TONOS = [
  { key: 'formal', label: 'Formal' },
  { key: 'profesional', label: 'Profesional' },
  { key: 'cercano', label: 'Cercano' },
  { key: 'conciso', label: 'Conciso' },
  { key: 'optimista', label: 'Optimista' },
] as const

/* ── Modales existentes (ShareModal, AIComposer, EditDocModal, UploadCard) ── */
const AV_GRADS: [string, string][] = [
  ['#7aa2ff', '#3b82f6'], ['#3ed694', '#1f9d63'], ['#f0bd5a', '#bf8410'],
  ['#b298f2', '#7c5cd6'], ['#ff8a8d', '#e5484d'], ['#5ed3d6', '#1f9098'],
  ['#f79bc4', '#db5897'], ['#8fd16a', '#4f9e2e'],
]
const avHash = (n = '') => { let h = 0; for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) | 0; return Math.abs(h) % AV_GRADS.length }
const initials = (n = '') => n.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase()
const Avatar = ({ name, size = 34 }: { name: string; size?: number }) => {
  const [c1, c2] = AV_GRADS[avHash(name)]
  return (
    <div className="av" style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(145deg,${c1},${c2})`, boxShadow: `0 4px 10px -4px ${c2}88` }}>{initials(name)}</div>
  )
}

type SharePerson = { name: string; email: string; owner?: boolean; role?: string }

type ShareModalProps = { open: boolean; name: string | null; onClose: () => void; notify: (msg: string, kind?: 'ok' | 'err' | 'info' | 'warn') => void }

function ShareModal(props: ShareModalProps) {
  if (!props.open) return null
  return <ShareModalBody {...props} />
}

function ShareModalBody({ name, onClose, notify }: ShareModalProps) {
  const [people, setPeople] = useState<SharePerson[]>(SHARE_PEOPLE)
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('Puede ver')
  const [access, setAccess] = useState('invited')
  const cycleRole = (r?: string) => (r === 'Puede ver' ? 'Puede editar' : 'Puede ver')
  const invite = () => {
    const v = email.trim(); if (!v) return
    const nm = v.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    setPeople((p) => [...p, { name: nm, email: v, role: inviteRole }])
    setEmail(''); notify('Invitación enviada', 'ok')
  }
  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead"><div><div className="mtitle">Compartir</div><div className="kvs" style={{ marginTop: 2 }}>{name}</div></div><button className="ibtn" onClick={onClose}><X size={18} /></button></div>
        <div className="mbody">
          <div className="invite">
            <input className="field" style={{ flex: 1, minWidth: 0 }} placeholder="Correo o nombre…" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && invite()} />
            <button className="role" onClick={() => setInviteRole(cycleRole)}>{inviteRole} <ChevronDown size={13} /></button>
            <button className="btn dark" onClick={invite}>Invitar</button>
          </div>
          <div className="flabel" style={{ marginTop: 14 }}>Acceso general</div>
          <button className="acc" onClick={() => { setAccess('invited'); notify('Acceso limitado a invitados', 'ok') }}><span className="acico"><Users size={17} /></span><div style={{ flex: 1 }}><div className="act">Solo invitados</div><div className="acs">{people.length} personas con acceso</div></div>{access === 'invited' ? <Check size={16} color="var(--grn)" /> : <ChevronDown size={16} color="#c4c4cc" />}</button>
          <button className="acc" onClick={() => { setAccess('link'); notify('Acceso por enlace activado', 'ok') }}><span className="acico"><Link2 size={17} /></span><div style={{ flex: 1 }}><div className="act">Acceso por enlace</div><div className="acs">Solo quien tenga el enlace</div></div>{access === 'link' ? <Check size={16} color="var(--grn)" /> : <ChevronDown size={16} color="#c4c4cc" />}</button>
          <div className="flabel">Personas con acceso</div>
          {people.map((p, i) => (
            <div className="prow" key={i}>
              <Avatar name={p.name} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}><div className="cename">{p.name}</div><div className="ceid" style={{ fontSize: 12 }}>{p.email}</div></div>
              {p.owner ? <span className="prole" style={{ color: 'var(--grn)' }}><ShieldCheck size={13} />Propietario</span> : <><button className="prole" onClick={() => setPeople((x) => x.map((pp, j) => j === i ? { ...pp, role: cycleRole(pp.role) } : pp))}>{p.role} <ChevronDown size={13} /></button><button className="premove" title="Quitar" onClick={() => setPeople((x) => x.filter((_, j) => j !== i))}><X size={14} /></button></>}
            </div>
          ))}
          <div className="copybar"><span className="lk">nucleo.rh/doc/{(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 18)}</span><button className="btn ghost" onClick={() => notify('Enlace copiado', 'ok')}><Copy size={14} />Copiar enlace</button></div>
        </div>
      </div>
    </div>
  )
}

type AIComposerProps = { open: boolean; onClose: () => void; notify: (msg: string, kind?: 'ok' | 'err' | 'info' | 'warn') => void }

function AIComposer(props: AIComposerProps) {
  if (!props.open) return null
  return <AIComposerBody {...props} />
}

function AIComposerBody({ onClose, notify }: AIComposerProps) {
  const [text, setText] = useState(COMPOSER_SEED)
  const [loading, setLoading] = useState(false)
  const [tone, setTone] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const wrap = (before: string, after: string = before) => {
    const ta = taRef.current; if (!ta) return
    const { selectionStart: s, selectionEnd: e } = ta
    const sel = text.slice(s, e) || 'texto'
    const next = text.slice(0, s) + before + sel + after + text.slice(e)
    setText(next)
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + before.length, s + before.length + sel.length) })
  }
  const linePrefix = (prefix: string, numbered = false) => {
    const ta = taRef.current; if (!ta) return
    const { selectionStart: s, selectionEnd: e } = ta
    const lineStart = text.lastIndexOf('\n', s - 1) + 1
    const lineEnd = text.indexOf('\n', e); const end = lineEnd === -1 ? text.length : lineEnd
    const block = text.slice(lineStart, end)
    const lines = block.split('\n').map((l, i) => (numbered ? `${i + 1}. ` : prefix) + l)
    const next = text.slice(0, lineStart) + lines.join('\n') + text.slice(end)
    setText(next)
    requestAnimationFrame(() => ta.focus())
  }
  async function run(instruction: RewriteInstruction) {
    if (loading) return
    setLoading(true); setTone(false)
    try {
      const result = await apiFetch<{ text: string }>('/api/ai/rewrite', {
        method: 'POST',
        body: JSON.stringify({ instruction, text }),
      })
      if (result.text) setText(result.text)
    } catch (error) {
      notify(errorMessage(error, 'No se pudo conectar con la IA'), 'err')
    } finally {
      setLoading(false)
    }
  }
  if (!open) return null
  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal modalw" onClick={(e) => e.stopPropagation()}>
        <div className="mhead"><div className="mtitle">Redactar con IA</div><button className="ibtn" onClick={onClose}><X size={18} /></button></div>
        <div className="mbody">
          <div className="fbar">
            <button className="aipill" onClick={() => run('mejorar')}><Sparkles size={14} />Editar con IA</button><span className="fsep" />
            <button className="ftxt" onClick={() => linePrefix('# ')}><Type size={14} />Texto <ChevronDown size={12} /></button><span className="fsep" />
            <button className="fbtn" onClick={() => wrap('**')}><Bold size={15} /></button>
            <button className="fbtn" onClick={() => wrap('*')}><Italic size={15} /></button>
            <button className="fbtn" onClick={() => wrap('<u>', '</u>')}><Underline size={15} /></button>
            <button className="fbtn" onClick={() => wrap('~~')}><Strikethrough size={15} /></button><span className="fsep" />
            <button className="fbtn" onClick={() => linePrefix('- ')}><List size={15} /></button>
            <button className="fbtn" onClick={() => linePrefix('', true)}><ListOrdered size={15} /></button><span className="fsep" />
            <button className="fbtn" onClick={() => wrap('[', '](enlace)')}><Link2 size={15} /></button>
            <button className="fbtn" onClick={() => wrap('![', '](imagen)')}><Image size={15} /></button>
            <button className="fbtn" onClick={() => linePrefix('> ')}><Quote size={15} /></button>
          </div>
          <textarea ref={taRef} className="editor" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="aibar">
            <div className="aibar-h"><Sparkles size={14} style={{ color: 'var(--red)' }} />{loading ? 'La IA está escribiendo…' : tone ? 'Cambiar tono a…' : 'Preguntar a la IA'}</div>
            {loading ? <div className="typing" role="status" aria-label="La IA está escribiendo"><i /><i /><i /></div> : tone ? (<div className="aichips">{TONOS.map((t) => <button key={t.key} className="aichip" onClick={() => run(t.key)}>{t.label}</button>)}<button className="aichip" onClick={() => setTone(false)}>Cancelar</button></div>) : (<div className="aichips"><button className="aichip" onClick={() => run('mejorar')}><Sparkles size={12} />Mejorar redacción</button><button className="aichip" onClick={() => setTone(true)}>Cambiar tono</button><button className="aichip" onClick={() => run('acortar')}>Hacer más corto</button><button className="aichip" onClick={() => run('ampliar')}>Ampliar</button></div>)}
          </div>
        </div>
        <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}><button className="btn" onClick={onClose}>Cancelar</button><button className="btn dark" onClick={() => { notify('Documento guardado', 'ok'); onClose() }}>Guardar documento</button></div></div>
      </div>
    </div>
  )
}

type Upload = { id: number; name: string; pct: number; stage: string }
function UploadCard({ u, onCancel }: { u: Upload; onCancel: (id: number) => void }) {
  const tone = u.stage === 'done' ? 'grn' : u.stage === 'uploading' ? 'blu' : 'ink'
  return (
    <div className="upcard">
      <div className="uphead"><span className={`upico ${tone}`}>{u.stage === 'done' ? <Check size={14} /> : <Upload size={14} />}</span><div className="uptxt"><div className="uptitle">{u.stage === 'done' ? 'Subido' : 'Subiendo'} &quot;<b>{u.name}</b>&quot;</div><div className="upsub">{u.stage === 'done' ? '¡Subido correctamente!' : u.stage === 'uploading' ? 'Subiendo tu archivo…' : 'Preparando la subida…'}</div></div><button className="upx" onClick={() => onCancel(u.id)}><X size={14} /></button></div>
      <div className="upbar"><div className="upfill" style={{ width: `${u.pct}%`, background: tone === 'grn' ? 'var(--grn)' : tone === 'blu' ? 'var(--blu)' : 'var(--ink3)' }} /></div>
      <div className="upfoot"><span className="uppct">{u.pct}% subido{u.stage !== 'done' ? '…' : ''}</span></div>
    </div>
  )
}

type EditDocModalProps = { doc: Doc | null; onClose: () => void; onSave: (id: string, patch: Partial<Doc>) => void }

function EditDocModal(props: EditDocModalProps) {
  if (!props.doc) return null
  // Keyed on the document, so switching rows while the modal is open remounts
  // with the new values instead of syncing them in through an effect.
  return <EditDocModalBody key={props.doc.id} {...props} doc={props.doc} />
}

function EditDocModalBody({ doc, onClose, onSave }: EditDocModalProps & { doc: Doc }) {
  const [name, setName] = useState(doc.name)
  const [type, setType] = useState(doc.type)
  const types = ['Contrato', 'Política', 'Acta', 'Plan', 'Manual']
  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead"><div className="mtitle">Editar documento</div><button className="ibtn" onClick={onClose}><X size={18} /></button></div>
        <div className="mbody">
          <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flabel">Tipo</div>
          <div className="chips">{types.map((t) => <button key={t} className={`chip ${type === t ? 'on' : ''}`} onClick={() => setType(t)}>{t}</button>)}</div>
        </div>
        <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}><button className="btn" onClick={onClose}>Cancelar</button><button className="btn dark" onClick={() => name.trim() && onSave(doc.id, { name, type })}>Guardar</button></div></div>
      </div>
    </div>
  )
}

/* ── Botón de carpeta glass ── */
const GLASS_BACK = 'rgba(26,26,26,.82)'
const GLASS_FRONT = 'rgba(26,26,26,.86)'
const SHADOW = '0 22px 45px -14px rgba(0,0,0,.55)'
const HL = 'rgba(255,255,255,.14)'

const paperDefs = [
  { rotate: -8, x: -14, y: -28, z: 1 },
  { rotate: 8, x: 14, y: -28, z: 2 },
  { rotate: 0, x: 0, y: -38, z: 3 },
]

function FolderButton({ name, count, onClick }: { name: string; count: number; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const empty = count === 0
  return (
    <motion.button
      type="button"
      onClick={onClick}
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      whileHover={empty ? {} : { y: -6 }}
      whileTap={{ scale: 0.97 }}
      className="relative block w-full cursor-pointer rounded-[1.8rem] outline-none focus-visible:ring-[3px] focus-visible:ring-[#1a1a1a]/70 focus-visible:ring-offset-[6px] focus-visible:ring-offset-transparent"
      style={{ maxWidth: 260, opacity: empty ? 0.55 : 1, filter: empty ? 'grayscale(0.4)' : undefined }}
    >
      <div style={{ perspective: 1200 }} className="relative h-[160px]">
        {/* Cara trasera */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: '1.8rem',
            border: `1px solid ${empty ? 'rgba(255,255,255,.06)' : HL}`,
            backgroundColor: GLASS_BACK,
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: empty ? '0 8px 24px -8px rgba(0,0,0,.25)' : SHADOW,
          }}
        />
        {/* Papeles — solo si tiene archivos */}
        {!empty && (
          <div className="pointer-events-none absolute inset-0 -top-[12px] z-10 flex items-center justify-center">
            {paperDefs.map((p, i) => (
              <motion.div
                key={i}
                className="absolute aspect-[4/3] w-[80%] rounded-[1.4rem] border border-black/5 bg-white"
                style={{ zIndex: p.z, transformOrigin: 'bottom center', boxShadow: '0 6px 16px rgba(0,0,0,.14)' }}
                animate={{
                  rotate: hover ? p.rotate : 0,
                  x: hover ? p.x : 0,
                  y: hover ? p.y : -6,
                  scale: hover ? 0.9 : 0.88,
                }}
                transition={{ type: 'spring', stiffness: 200, damping: 30 }}
              />
            ))}
          </div>
        )}
        {/* Cara frontal */}
        <motion.div
          className="absolute inset-0 z-20 origin-bottom"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateX: empty ? 0 : hover ? -20 : 0, y: empty ? 0 : hover ? 8 : 0 }}
          transition={{ type: 'spring', stiffness: 160, damping: 20 }}
        >
          <div
            className="relative flex h-full w-full flex-col justify-end overflow-hidden p-5"
            style={{
              borderRadius: '1.8rem',
              border: `1px solid ${empty ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.16)'}`,
              backgroundColor: GLASS_FRONT,
              backdropFilter: 'blur(32px)',
              WebkitBackdropFilter: 'blur(32px)',
              boxShadow: empty ? 'none' : 'inset 0 1px 0 rgba(255,255,255,.10)',
            }}
          >
            {!empty && (
              <motion.div
                className="pointer-events-none absolute inset-0"
                style={{ borderRadius: '1.8rem', background: 'radial-gradient(circle at 50% 100%, #fff, transparent 68%)' }}
                animate={{ opacity: hover ? 0.12 : 0 }}
                transition={{ duration: 0.4 }}
              />
            )}
            {/* 3 puntos */}
            <motion.div
              className="absolute right-5 top-5 z-10 flex gap-1"
              animate={{ scale: hover ? 1.08 : 1 }}
              transition={{ duration: 0.25 }}
            >
              <span className={`h-1 w-1 rounded-full ${empty ? 'bg-white/15' : 'bg-white/30'}`} />
              <span className={`h-1 w-1 rounded-full ${empty ? 'bg-white/15' : 'bg-white/30'}`} />
              <span className={`h-1 w-1 rounded-full ${empty ? 'bg-white/15' : 'bg-white/30'}`} />
            </motion.div>
            <div className="relative z-10">
              <h3 className={`text-[17px] font-semibold tracking-[-0.03em] ${empty ? 'text-white/60' : 'text-white'}`}>{name}</h3>
              <p className={`mt-1 font-mono text-[11px] tracking-[0.01em] tabular-nums ${empty ? 'text-white/30' : 'text-white/50'}`}>
                {empty ? 'Vacía' : `${count} ${count === 1 ? 'archivo' : 'archivos'}`}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.button>
  )
}

const viewVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const } },
  exit: { opacity: 0, y: -16, transition: { duration: 0.25, ease: [0.4, 0, 1, 1] as const } },
}

/* ── Página principal ── */
export default function DocumentosPage() {
  const { addToast } = useApp()
  const [docs, setDocs] = useState<Doc[]>(DOCS_SEED)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [shareDoc, setShareDoc] = useState<string | null>(null)
  const [editDoc, setEditDoc] = useState<Doc | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const upId = useRef(0)

  const folderDocs = useMemo(() => {
    const map: Record<string, Doc[]> = {}
    FOLDERS.forEach((f) => { map[f.key] = [] })
    docs.forEach((d) => {
      if (!map[d.folder]) map[d.folder] = []
      map[d.folder].push(d)
    })
    return map
  }, [docs])

  const stats = useMemo(() => {
    const totalDocs = docs.length
    const totalFolders = FOLDERS.length
    const foldersWithContent = FOLDERS.filter((f) => (folderDocs[f.key]?.length || 0) > 0).length
    const recientes = docs.filter((d) => d.date.includes('Jun 2026')).length
    return { totalDocs, totalFolders, foldersWithContent, recientes }
  }, [docs, folderDocs])

  const activeFolderInfo = FOLDERS.find((f) => f.key === activeFolder)
  const activeDocs = activeFolder ? (folderDocs[activeFolder] || []) : []

  const startUpload = (folderKey: string) => {
    const id = ++upId.current
    const name = UPLOAD_NAMES[Math.floor(Math.random() * UPLOAD_NAMES.length)]
    setUploads((u) => [...u, { id, name, pct: 0, stage: 'queued' }])
    setTimeout(() => setUploads((u) => u.map((x) => (x.id === id ? { ...x, pct: 50, stage: 'uploading' } : x))), 650)
    setTimeout(() => setUploads((u) => u.map((x) => (x.id === id ? { ...x, pct: 100, stage: 'done' } : x))), 1650)
    setTimeout(() => {
      setUploads((u) => u.filter((x) => x.id !== id))
      setDocs((d) => [{ id: `F-${9010 + Math.floor(Math.random() * 89)}`, name: name.replace(/\.pdf$/, ''), type: 'Política', folder: folderKey, who: 'Personas', date: 'Jun 2026', tags: ['Nuevo'], ai: 'Sin riesgos' }, ...d])
      addToast('Documento subido correctamente', 'ok')
    }, 2950)
  }

  const cancelUpload = (id: number) => setUploads((u) => u.filter((x) => x.id !== id))

  const updateDoc = (id: string, patch: Partial<Doc>) => {
    setDocs((d) => d.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    addToast('Documento actualizado', 'ok')
    setEditDoc(null)
  }

  const deleteDoc = (id: string) => {
    const removed = docs.find((d) => d.id === id)
    setDocs((d) => d.filter((x) => x.id !== id))
    if (removed) addToast(`"${removed.name}" eliminado`, 'info', 'Deshacer', () => setDocs((d) => [removed, ...d]))
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 28 }}>
        <div className="rise d1"><Stat icon={<FileText size={16} />} tone="blu" label="Documentos" value={stats.totalDocs} /></div>
        <div className="rise d2"><Stat icon={<FileText size={16} />} tone="grn" label="Carpetas" value={stats.foldersWithContent} sub={`de ${stats.totalFolders} totales`} /></div>
        <div className="rise d3"><Stat icon={<Calendar size={16} />} tone="amb" label="Recientes" value={stats.recientes} sub="este mes" /></div>
        <div className="rise d4"><Stat icon={<Sparkles size={16} />} tone="vio" label="IA" value="Activa" sub="Análisis automático" /></div>
      </div>

      <AnimatePresence mode="wait">
        {activeFolder ? (
          <motion.div key={`docs-${activeFolder}`} variants={viewVariants} initial="hidden" animate="show" exit="exit">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <button className="ibtn" style={{ width: 34, height: 34 }} onClick={() => setActiveFolder(null)}>
                <ChevronLeft size={18} />
              </button>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em' }}>{activeFolderInfo?.name}</div>
                <div className="kvs">{activeDocs.length} {activeDocs.length === 1 ? 'documento' : 'documentos'}</div>
              </div>
              <div style={{ flex: 1 }} />
              <button className="btn ghost" onClick={() => setAiOpen(true)}>
                <Sparkles size={15} style={{ color: 'var(--red)' }} />Redactar con IA
              </button>
              <button className="btn dark" onClick={() => startUpload(activeFolder!)}>
                <Upload size={14} />Subir archivo
              </button>
            </div>

            {/* Tabla */}
            <div className="card rise d1" style={{ overflow: 'hidden' }}>
              {activeDocs.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', gap: 16 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={24} style={{ color: 'var(--ink3)' }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)', marginBottom: 4 }}>Carpeta vacía</div>
                    <div style={{ fontSize: 13, color: 'var(--ink3)' }}>No hay documentos en esta carpeta todavía.</div>
                  </div>
                  <button className="btn dark" onClick={() => startUpload(activeFolder!)}>
                    <Upload size={14} />Subir primer archivo
                  </button>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Nombre</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Tipo</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Departamento</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Fecha</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeDocs.map((d) => (
                      <tr key={d.id} style={{ borderBottom: '1px solid var(--line)', transition: 'background .15s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg2)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{d.name}</div>
                          <div className="ceid mono" style={{ fontSize: 10, marginTop: 2 }}>{d.id}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className="badge b-neu"><span className="bd" />{d.type}</span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--ink2)' }}>{d.who}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--ink2)' }}>{d.date}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button className="ibtn" style={{ width: 28, height: 28 }} data-tip="Compartir" onClick={() => setShareDoc(d.name)}>
                              <Share2 size={13} />
                            </button>
                            <button className="ibtn" style={{ width: 28, height: 28 }} data-tip="Editar" onClick={() => setEditDoc(d)}>
                              <PenLine size={13} />
                            </button>
                            <button className="ibtn" style={{ width: 28, height: 28, color: 'var(--redd)' }} data-tip="Eliminar" onClick={() => deleteDoc(d.id)}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="folders" variants={viewVariants} initial="hidden" animate="show" exit="exit">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 40, justifyItems: 'center', padding: '12px 0' }}>
              {FOLDERS.map((f) => {
                const count = folderDocs[f.key]?.length || 0
                return (
                  <FolderButton
                    key={f.key}
                    name={f.name}
                    count={count}
                    onClick={() => setActiveFolder(f.key)}
                  />
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AIComposer open={aiOpen} onClose={() => setAiOpen(false)} notify={addToast} />
      <ShareModal open={!!shareDoc} name={shareDoc} onClose={() => setShareDoc(null)} notify={addToast} />
      <EditDocModal doc={editDoc} onClose={() => setEditDoc(null)} onSave={updateDoc} />
      {uploads.length > 0 && (
        <div className="upwrap">
          {uploads.map((u) => <UploadCard key={u.id} u={u} onCancel={cancelUpload} />)}
        </div>
      )}
    </>
  )
}
