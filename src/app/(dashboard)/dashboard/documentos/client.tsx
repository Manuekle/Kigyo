'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles, Upload, FileText, X, Check, Calendar, ChevronLeft, PenLine, Trash2, Download, Plus,
} from '@/lib/icons'
import Stat from '@/components/ui/Stat'
import LoadMore from '@/components/ui/LoadMore'
import Select from '@/components/ui/Select'
import DatePicker from '@/components/ui/DatePicker'
import { useApp } from '@/lib/context/AppContext'
import { DUR_RESIZE_S } from '@/lib/motion'
import { createClient } from '@/lib/supabase/client'
import { DOCUMENT_KINDS, DOCUMENT_STATUSES } from '@/lib/domain'
import type { DocumentosData, DocumentoRow } from '@/server/queries/documentos'
import type { DocumentoRevision } from '@/app/api/ai/documento/route'
import {
  createCarpeta, createDocumento, deleteDocumento, documentoDownloadUrl, updateDocumento,
} from '@/server/mutations/documentos'
import { fetchMoreDocumentos } from '@/server/actions/documentos'

const MONTH = new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric' })

/** Mirrors the bucket's `allowed_mime_types`; the upload is rejected without it. */
const ACCEPT = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'image/png', 'image/jpeg', 'image/webp',
].join(',')

const MAX_BYTES = 50 * 1024 * 1024

function humanSize(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Object key for the private bucket.
 *
 * `{org_id}/…` is not decoration: every storage policy pins the first path
 * segment to an organization the caller belongs to, so the prefix is the
 * tenant boundary. The random segment keeps two uploads of "contrato.pdf" from
 * overwriting each other.
 */
function objectKey(orgId: string, fileName: string): string {
  const safe = fileName.replace(/[^\w.\-]+/g, '_').slice(-80)
  return `${orgId}/${crypto.randomUUID()}-${safe}`
}

interface UploadState {
  name: string
  stage: 'uploading' | 'saving'
}

/* ── Botón de carpeta ── */
// Every colour here comes from the `--folder-*` tokens in globals.css, which
// is what lets the folder flip with the theme — smoked glass on dark, a pale
// card on light — while the paper inside it stays white in both.
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
      // The ring was pinned to #1a1a1a, which is the dark page colour itself —
      // invisible in the theme it was written for. It reads from the token now.
      className="relative block w-full cursor-pointer rounded-[1.8rem] outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring-color)] focus-visible:ring-offset-[6px] focus-visible:ring-offset-transparent"
      style={{ maxWidth: 260, opacity: empty ? 0.55 : 1, filter: empty ? 'grayscale(0.4)' : undefined }}
    >
      <div style={{ perspective: 1200 }} className="relative h-[160px]">
        {/* Cara trasera */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: '1.8rem',
            border: `1px solid ${empty ? 'var(--folder-edge-soft)' : 'var(--folder-edge)'}`,
            backgroundColor: 'var(--folder-back)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: empty ? 'var(--folder-shadow-soft)' : 'var(--folder-shadow)',
          }}
        />
        {/* Papeles — solo si tiene archivos */}
        {!empty && (
          <div className="pointer-events-none absolute inset-0 -top-[12px] z-10 flex items-center justify-center">
            {paperDefs.map((p, i) => (
              <motion.div
                key={i}
                className="absolute aspect-[4/3] w-[80%] rounded-[1.4rem]"
                style={{
                  zIndex: p.z,
                  transformOrigin: 'bottom center',
                  backgroundColor: 'var(--folder-paper)',
                  border: '1px solid var(--folder-paper-line)',
                  boxShadow: 'var(--folder-paper-shadow)',
                }}
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
              border: `1px solid ${empty ? 'var(--folder-edge-soft)' : 'var(--folder-edge-front)'}`,
              backgroundColor: 'var(--folder-front)',
              backdropFilter: 'blur(32px)',
              WebkitBackdropFilter: 'blur(32px)',
              boxShadow: empty ? 'none' : 'var(--folder-inset)',
            }}
          >
            {!empty && (
              <motion.div
                className="pointer-events-none absolute inset-0"
                style={{ borderRadius: '1.8rem', background: 'radial-gradient(circle at 50% 100%, var(--folder-glow), transparent 68%)' }}
                animate={{ opacity: hover ? 1 : 0 }}
                transition={{ duration: DUR_RESIZE_S }}
              />
            )}
            {/* 3 puntos */}
            <motion.div
              className="absolute right-5 top-5 z-10 flex gap-1"
              animate={{ scale: hover ? 1.08 : 1 }}
              transition={{ duration: DUR_RESIZE_S }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1 w-1 rounded-full"
                  style={{ backgroundColor: empty ? 'var(--folder-dot-soft)' : 'var(--folder-dot)' }}
                />
              ))}
            </motion.div>
            <div className="relative z-10">
              <h3
                className="truncate text-[17px] font-medium tracking-[-0.01em]"
                style={{ color: empty ? 'var(--folder-ink-soft)' : 'var(--folder-ink)' }}
              >
                {name}
              </h3>
              <p
                className="mt-1 font-mono text-[11px] tabular-nums"
                style={{ color: empty ? 'var(--folder-ink-faint)' : 'var(--folder-ink-dim)' }}
              >
                {empty ? 'Vacía' : `${count} ${count === 1 ? 'archivo' : 'archivos'}`}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.button>
  )
}

export default function DocumentosPage({ data }: { data: DocumentosData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState<DocumentosData>(data)
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const [editing, setEditing] = useState<DocumentoRow | null>(null)
  const [upload, setUpload] = useState<UploadState | null>(null)
  const [folderOpen, setFolderOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const targetFolder = useRef<string | null>(null)

  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')
  /** Id of the document whose review is in flight, so only its button spins. */
  const [reviewing, setReviewing] = useState<string | null>(null)

  const { carpetas, documentos } = state

  /**
   * Runs the AI review of one document and writes the verdict.
   *
   * The row is patched in place rather than re-reading the page: a review is
   * about the one document, and refetching would throw away everything the
   * reader paged in to find it.
   */
  function review(doc: DocumentoRow) {
    setReviewing(doc.id)
    startTransition(async () => {
      try {
        const response = await fetch(`/api/ai/documento?id=${doc.id}`, { method: 'POST' })
        const payload = await response.json()

        if (!response.ok) {
          // The API answers with a problem document; `detail` is the sentence
          // written for a person, `title` the fallback when there is none.
          addToast(payload?.detail ?? payload?.title ?? 'No se pudo revisar el documento.', 'err')
          return
        }

        const revision = payload as DocumentoRevision
        setState((prev) => ({
          ...prev,
          documentos: prev.documentos.map((d) =>
            d.id === doc.id
              ? {
                  ...d,
                  aiStatus: revision.estado,
                  aiVerdict: revision.veredicto,
                  aiCheckedAt: revision.revisadoEn,
                }
              : d,
          ),
        }))
        addToast(
          revision.alcance === 'contenido'
            ? `Revisado: ${revision.estado.toLowerCase()}`
            : `Ficha revisada: ${revision.estado.toLowerCase()}`,
          revision.estado === 'Correcto' ? 'ok' : 'info',
        )
      } catch (error) {
        console.error('[documentos] review', error)
        addToast('No se pudo contactar la revisión con IA.', 'err')
      } finally {
        setReviewing(null)
      }
    })
  }

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreDocumentos(documentos.length)
      if (!result.ok) {
        setLoadMoreError(result.error)
        return
      }
      setState((prev) => {
        const seen = new Set(prev.documentos.map((d) => d.id))
        return {
          ...prev,
          documentos: [...prev.documentos, ...result.data.rows.filter((d) => !seen.has(d.id))],
          documentosTotal: result.data.total,
        }
      })
    })
  }

  const byFolder = useMemo(() => {
    const map = new Map<string | null, DocumentoRow[]>()
    for (const d of documentos) {
      const bucket = map.get(d.folderId)
      if (bucket) bucket.push(d)
      else map.set(d.folderId, [d])
    }
    return map
  }, [documentos])

  const stats = useMemo(() => {
    const thisMonth = new Date()
    const recientes = documentos.filter((d) => {
      const created = new Date(d.createdAt)
      return created.getFullYear() === thisMonth.getFullYear() && created.getMonth() === thisMonth.getMonth()
    }).length
    // Reviews that ran and found something. Counted over what is loaded, like
    // the other two: a verdict only exists for a document somebody reviewed.
    const revisados = documentos.filter((d) => d.aiStatus !== null).length
    const porAtender = documentos.filter(
      (d) => d.aiStatus === 'Revisar' || d.aiStatus === 'Incompleto',
    ).length
    return {
      // The repository's size, not the page's: the other three tiles measure
      // what is loaded and say so, but "Documentos: 200" on an org with 900
      // would just be wrong.
      total: state.documentosTotal,
      carpetasConContenido: carpetas.filter((c) => c.count > 0).length,
      recientes,
      revisados,
      porAtender,
    }
  }, [documentos, carpetas, state.documentosTotal])

  const activeInfo = carpetas.find((c) => c.id === activeFolder) ?? null
  const activeDocs = activeFolder ? (byFolder.get(activeFolder) ?? []) : []
  const looseDocs = byFolder.get(null) ?? []

  /**
   * Real upload.
   *
   * The browser writes straight into the private bucket — the storage policy
   * is what authorizes it, and going through a Server Function would mean
   * pushing a 50 MB body through the app server for no benefit. Only once the
   * object exists does the row get created, so a failed transfer leaves no
   * document pointing at nothing.
   *
   * This used to be three `setTimeout`s animating a progress bar over a
   * filename picked at random from a list of three.
   */
  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      addToast('El archivo supera el límite de 50 MB.', 'err')
      return
    }

    setUpload({ name: file.name, stage: 'uploading' })
    const key = objectKey(state.orgId, file.name)

    const supabase = createClient()
    const { error } = await supabase.storage
      .from(state.bucket)
      .upload(key, file, { contentType: file.type || undefined, upsert: false })

    if (error) {
      setUpload(null)
      console.error('[documentos] upload', error)
      addToast('No se pudo subir el archivo.', 'err')
      return
    }

    setUpload({ name: file.name, stage: 'saving' })
    startTransition(async () => {
      const result = await createDocumento({
        name: file.name.replace(/\.[^.]+$/, ''),
        kind: 'Otro',
        folderId: targetFolder.current,
        storagePath: key,
        mimeType: file.type || null,
        sizeBytes: file.size,
        department: '',
        ownerId: null,
        tags: [],
        expiresOn: null,
      })
      setUpload(null)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Documento subido', 'ok')
    })
  }

  function pickFile(folderId: string | null) {
    targetFolder.current = folderId
    fileRef.current?.click()
  }

  async function download(d: DocumentoRow) {
    const result = await documentoDownloadUrl(d.id)
    if (!result.ok) { addToast(result.error, 'err'); return }
    // Opened rather than navigated to: the signed URL lives 60 seconds and the
    // response is an attachment, so this must not replace the current page.
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  function remove(d: DocumentoRow) {
    if (!window.confirm(`¿Eliminar "${d.name}"? El archivo se conserva pero deja de aparecer.`)) return
    startTransition(async () => {
      const result = await deleteDocumento(d.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast(`"${d.name}" eliminado`, 'info')
    })
  }

  function addFolder() {
    if (!folderName.trim()) return
    startTransition(async () => {
      const result = await createCarpeta({ name: folderName.trim() })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setFolderOpen(false)
      setFolderName('')
      addToast('Carpeta creada', 'ok')
    })
  }

  const rows = activeFolder ? activeDocs : documentos

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void handleFile(file)
        }}
      />

      <div className="g3" style={{ marginBottom: 20 }}>
        <div className="rise d1"><Stat icon={<FileText size={16} />} tone="blu" label="Documentos" value={stats.total} /></div>
        <div className="rise d2"><Stat icon={<FileText size={16} />} tone="grn" label="Carpetas" value={stats.carpetasConContenido} sub={`de ${carpetas.length} totales`} /></div>
        <div className="rise d3"><Stat icon={<Calendar size={16} />} tone="amb" label="Recientes" value={stats.recientes} sub="este mes" /></div>
        {/*
          "IA · Activa · Análisis automático" used to sit here beside a per-row
          verdict typed into the fixture — nothing analysed anything. The review
          is real now (POST /api/ai/documento writes `ai_status`, `ai_verdict`
          and `ai_checked_at`), so the tile counts what it found. A document
          nobody reviewed is not counted as clean: `revisados` is the
          denominator, not the page.
        */}
        <div className="rise d4">
          <Stat
            icon={<Sparkles size={16} />}
            tone={stats.porAtender > 0 ? 'amb' : 'vio'}
            label="Por atender"
            value={stats.porAtender}
            sub={`de ${stats.revisados} revisados`}
          />
        </div>
      </div>

      {activeFolder ? (
        <div className="card rise d1">
          <div className="chead">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="ibtn" onClick={() => setActiveFolder(null)} aria-label="Volver a carpetas"><ChevronLeft size={16} /></button>
              <div className="ctitle">{activeInfo?.name}</div>
              <span className="kvs">{activeDocs.length} documentos</span>
            </div>
            {state.canWrite && (
              <button className="btn pri" onClick={() => pickFile(activeFolder)} disabled={pending || upload !== null}>
                <Upload size={15} />Subir documento
              </button>
            )}
          </div>
          <DocTable rows={activeDocs} canWrite={state.canWrite} busy={pending} reviewing={reviewing} onEdit={setEditing} onDelete={remove} onDownload={download} onReview={review} />
        </div>
      ) : (
        <>
          <div className="card rise d1" style={{ marginBottom: 16 }}>
            <div className="chead">
              <div className="ctitle">Carpetas</div>
              {state.canWrite && (
                <button className="btn ghost" onClick={() => setFolderOpen(true)}><Plus size={14} />Nueva carpeta</button>
              )}
            </div>
            <div className="cpad">
              {carpetas.length === 0 ? (
                <div className="dempty">
                  Todavía no hay carpetas. Los documentos sueltos aparecen abajo.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px, 100%), 1fr))', gap: 40, justifyItems: 'center', padding: '12px 0' }}>
                  {carpetas.map((c) => (
                    <FolderButton
                      key={c.id}
                      name={c.name}
                      count={c.count}
                      onClick={() => setActiveFolder(c.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card rise d2">
            <div className="chead">
              <div className="ctitle">{carpetas.length > 0 ? 'Todos los documentos' : 'Documentos'}</div>
              {state.canWrite && (
                <button className="btn pri" onClick={() => pickFile(null)} disabled={pending || upload !== null}>
                  <Upload size={15} />Subir documento
                </button>
              )}
            </div>
            <DocTable rows={rows.length > 0 ? rows : looseDocs} canWrite={state.canWrite} busy={pending} reviewing={reviewing} onEdit={setEditing} onDelete={remove} onDownload={download} onReview={review} />
          </div>
        </>
      )}

      {upload && (
        <div className="card cpad" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Upload size={16} style={{ color: 'var(--ink3)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="eltxt" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{upload.name}</div>
            <div className="elsub">{upload.stage === 'uploading' ? 'Subiendo archivo…' : 'Registrando documento…'}</div>
          </div>
        </div>
      )}

      {/* Outside the folder/overview switch: both views draw on the same page
          of documents, and a folder holding more than is loaded is exactly
          when the reader needs the rest. */}
      <LoadMore
        loaded={documentos.length}
        total={state.documentosTotal}
        loading={loadingMore}
        error={loadMoreError}
        onLoadMore={loadMore}
        noun="documentos"
      />

      {editing && (
        <EditModal
          key={editing.id}
          doc={editing}
          carpetas={carpetas}
          busy={pending}
          onClose={() => setEditing(null)}
          onSave={(patch) =>
            startTransition(async () => {
              const result = await updateDocumento({ id: editing.id, ...patch })
              if (!result.ok) { addToast(result.error, 'err'); return }
              setState(result.data)
              setEditing(null)
              addToast('Documento actualizado', 'ok')
            })
          }
        />
      )}

      {folderOpen && (
        <div className="mwrap" onClick={() => setFolderOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Nueva carpeta</div><button className="ibtn" onClick={() => setFolderOpen(false)} aria-label="Cerrar"><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
              <input className="field" value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="Ej. Contratos" autoFocus />
            </div>
            <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => setFolderOpen(false)} disabled={pending}>Cancelar</button>
              <button className="btn dark" onClick={addFolder} disabled={pending}>Crear</button>
            </div></div>
          </div>
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Table                                                              */
/* ------------------------------------------------------------------ */
const AI_TONE: Record<string, string> = {
  Correcto: 'grn',
  Revisar: 'amb',
  Incompleto: 'red',
}

function DocTable({
  rows, canWrite, busy, reviewing, onEdit, onDelete, onDownload, onReview,
}: {
  rows: DocumentoRow[]
  canWrite: boolean
  busy: boolean
  /** Id of the row whose review is running, or null. */
  reviewing: string | null
  onEdit: (d: DocumentoRow) => void
  onDelete: (d: DocumentoRow) => void
  onDownload: (d: DocumentoRow) => void
  onReview: (d: DocumentoRow) => void
}) {
  return (
    <div className="tblwrap">
      <table className="tbl">
        <thead><tr><th scope="col">Documento</th><th scope="col">Tipo</th><th scope="col">Responsable</th><th scope="col">Tamaño</th><th scope="col">Fecha</th><th scope="col"></th></tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={6}><div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
              {canWrite ? 'Todavía no hay documentos aquí. Sube el primero.' : 'Todavía no hay documentos aquí.'}
            </div></td></tr>
          ) : rows.map((d) => (
            <tr className="trow" key={d.id}>
              <td>
                <div className="cename">{d.name}</div>
                <div className="ceid mono">{d.code ?? '—'}</div>
                {/* Only shown once a review has actually run. A document with
                    no verdict says nothing, rather than "sin observaciones". */}
                {d.aiStatus && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 5 }}>
                    <span className={`badge b-${AI_TONE[d.aiStatus] ?? 'neu'}`}>
                      <span className="bd" />{d.aiStatus}
                    </span>
                    <span className="elsub" style={{ whiteSpace: 'normal' }}>{d.aiVerdict}</span>
                  </div>
                )}
              </td>
              <td className="muted">{d.kind}</td>
              <td className="muted">{d.ownerName ?? (d.department || '—')}</td>
              <td className="muted mono" style={{ fontSize: 12 }}>{humanSize(d.sizeBytes)}</td>
              <td className="muted mono" style={{ fontSize: 12 }}>{MONTH.format(new Date(d.createdAt))}</td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  {d.storagePath && (
                    <button className="ibtn" style={{ width: 28, height: 28 }} data-tip="Descargar" onClick={() => onDownload(d)} aria-label={`Descargar ${d.name}`}>
                      <Download size={13} />
                    </button>
                  )}
                  {canWrite && (
                    <>
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28 }}
                        data-tip={d.aiCheckedAt ? 'Revisar de nuevo con IA' : 'Revisar con IA'}
                        disabled={busy || reviewing !== null}
                        aria-busy={reviewing === d.id}
                        onClick={() => onReview(d)}
                        aria-label={`Revisar ${d.name} con IA`}
                      >
                        <Sparkles size={13} />
                      </button>
                      <button className="ibtn" style={{ width: 28, height: 28 }} data-tip="Editar" onClick={() => onEdit(d)} aria-label={`Editar ${d.name}`}>
                        <PenLine size={13} />
                      </button>
                      <button className="ibtn" style={{ width: 28, height: 28, color: 'var(--redd)' }} data-tip="Eliminar" disabled={busy} onClick={() => onDelete(d)} aria-label={`Eliminar ${d.name}`}>
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Edit                                                               */
/* ------------------------------------------------------------------ */
function EditModal({
  doc, carpetas, busy, onClose, onSave,
}: {
  doc: DocumentoRow
  carpetas: DocumentosData['carpetas']
  busy: boolean
  onClose: () => void
  onSave: (patch: {
    name: string
    kind: (typeof DOCUMENT_KINDS)[number]
    folderId: string | null
    status: (typeof DOCUMENT_STATUSES)[number]
    expiresOn: string | null
  }) => void
}) {
  const [form, setForm] = useState({
    name: doc.name,
    kind: doc.kind as (typeof DOCUMENT_KINDS)[number],
    folderId: doc.folderId ?? '',
    status: doc.status as (typeof DOCUMENT_STATUSES)[number],
    expiresOn: doc.expiresOn ?? '',
  })

  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead"><div className="mtitle">Editar documento</div><button className="ibtn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></div>
        <div className="mbody">
          <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
          <input className="field" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <div className="fg2">
            <div>
              <div className="flabel">Tipo</div>
              <Select value={form.kind} onChange={(v) => setForm((f) => ({ ...f, kind: v as (typeof DOCUMENT_KINDS)[number] }))} options={[...DOCUMENT_KINDS]} />
            </div>
            <div>
              <div className="flabel">Estado</div>
              <Select value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v as (typeof DOCUMENT_STATUSES)[number] }))} options={[...DOCUMENT_STATUSES]} />
            </div>
          </div>
          <div className="flabel">Carpeta</div>
          <Select
            value={form.folderId}
            onChange={(v) => setForm((f) => ({ ...f, folderId: v }))}
            placeholder="Sin carpeta"
            options={[{ value: '', label: 'Sin carpeta' }, ...carpetas.map((c) => ({ value: c.id, label: c.name }))]}
          />
          <div className="flabel">Vence</div>
          <DatePicker ariaLabel="Vence" value={form.expiresOn} onChange={(v) => setForm((f) => ({ ...f, expiresOn: v }))} />
        </div>
        <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
          <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
          <button
            className="btn dark"
            disabled={busy || !form.name.trim()}
            aria-busy={busy}
            onClick={() => onSave({
              name: form.name.trim(),
              kind: form.kind,
              folderId: form.folderId || null,
              status: form.status,
              expiresOn: form.expiresOn || null,
            })}
          ><Check size={15} />{busy ? 'Guardando…' : 'Guardar'}</button>
        </div></div>
      </div>
    </div>
  )
}
