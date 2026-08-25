'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles, Upload, FileText, X, Check, Calendar, ChevronLeft, PenLine, Trash2, Download, Plus, Share2, FileSpreadsheet, RotateCcw, Eye, Lock,
} from '@/lib/icons'
import Stat from '@/components/ui/Stat'
import LoadMore from '@/components/ui/LoadMore'
import Select from '@/components/ui/Select'
import DatePicker from '@/components/ui/DatePicker'
import { useApp } from '@/lib/context/AppContext'
import { useConfirm } from '@/lib/context/ConfirmContext'
import { useExport } from '@/lib/hooks/use-export'
import { DUR_RESIZE_S } from '@/lib/motion'
import { createClient } from '@/lib/supabase/client'
import { DOCUMENT_KINDS, DOCUMENT_STATUSES, DOCUMENT_VISIBILITIES } from '@/lib/domain'
import type { DocumentosData, DocumentoRow } from '@/server/queries/documentos'
import type { DocumentoRevision } from '@/app/api/ai/documento/route'
import {
  createCarpeta, createDocumento, deleteDocumento, documentoDownloadUrl, updateDocumento,
  fetchDocumentShares, shareDocument, revokeShare,
  type DocumentShare,
} from '@/server/mutations/documentos'
import DocumentPreview from '@/components/ui/DocumentPreview'
import { AttachmentUpload, type AttachmentItem } from '@/components/ui/AttachmentUpload'
import { MorphingModal } from '@/components/ai/MorphingModal'
import { fetchMoreDocumentos } from '@/server/actions/documentos'
import { documentIconSrc } from '@/lib/document-icons'
import { Liquid } from 'liquid-gooey'

const MONTH = new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric' })


const MAX_BYTES = 50 * 1024 * 1024

const SHARE_ACCESSES = ['Propietario', 'Puede editar', 'Puede ver'] as const
const SHARE_TONE: Record<string, string> = {
  Propietario: 'grn',
  'Puede editar': 'amb',
  'Puede ver': 'neu',
}

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
  const { runExport, exporting } = useExport()
  const { addToast } = useApp()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState<DocumentosData>(data)
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const [editing, setEditing] = useState<DocumentoRow | null>(null)
  const [sharing, setSharing] = useState<DocumentoRow | null>(null)
  const [previewing, setPreviewing] = useState<DocumentoRow | null>(null)
  // `undefined` = modal cerrado. El valor es la carpeta destino de esta
  // tanda, para que "Subir documento" dentro de una carpeta suba ahí.
  const [uploadFolder, setUploadFolder] = useState<string | null | undefined>(undefined)
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [folderOpen, setFolderOpen] = useState(false)
  const [folderName, setFolderName] = useState('')

  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')
  /** Id of the document whose review is in flight, so only its button spins. */
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [indexing, setIndexing] = useState<string | null>(null)

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

  function index(doc: DocumentoRow) {
    setIndexing(doc.id)
    startTransition(async () => {
      try {
        const response = await fetch(`/api/ai/ingest?id=${doc.id}`, { method: 'POST' })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          addToast(payload?.detail ?? 'No se pudo indexar el documento.', 'err')
          return
        }
        addToast(payload?.indexed ? `${payload.chunks} fragmentos indexados` : 'Formato no compatible para RAG', 'info')
      } catch (error) {
        console.error('[documentos] index', error)
        addToast('No se pudo contactar la indexación con IA.', 'err')
      } finally {
        setIndexing(null)
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

  /** Marca una fila del panel de subida por id, sin tocar las demás. */
  function patchAttachment(id: string, patch: Partial<AttachmentItem>) {
    setAttachments((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  /**
   * Sube un archivo directo al bucket y, si la transferencia llega, crea la fila.
   *
   * El navegador escribe directo al bucket privado — la política de storage es
   * quien autoriza, y pasar por una Server Function significaría empujar un
   * cuerpo de hasta 50 MB por el servidor de la aplicación sin ganar nada. La
   * fila solo se crea si el objeto ya existe: una transferencia que falla no
   * deja un documento apuntando a la nada.
   *
   * Cada archivo de la tanda corre su propia llamada; una tanda de diez
   * archivos hace diez subidas independientes, así que uno que falle no frena
   * a los demás y se puede reintentar solo.
   */
  async function uploadAttachment(item: AttachmentItem, folderId: string | null) {
    const file = item.file
    if (!file) return

    patchAttachment(item.id, { status: 'uploading', error: undefined })
    const key = objectKey(state.orgId, file.name)

    const supabase = createClient()
    const { error: uploadError } = await supabase.storage
      .from(state.bucket)
      .upload(key, file, { contentType: file.type || undefined, upsert: false })

    if (uploadError) {
      console.error('[documentos] upload', uploadError)
      patchAttachment(item.id, { status: 'failed', error: 'No se pudo subir el archivo.' })
      return
    }

    const result = await createDocumento({
      name: file.name.replace(/\.[^.]+$/, ''),
      kind: 'Otro',
      folderId,
      storagePath: key,
      mimeType: file.type || null,
      sizeBytes: file.size,
      department: '',
      ownerId: null,
      tags: [],
      expiresOn: null,
    })

    if (!result.ok) {
      patchAttachment(item.id, { status: 'failed', error: result.error })
      return
    }

    setState(result.data)
    patchAttachment(item.id, { status: 'complete' })

    const created = result.data.documentos.find((document) => document.storagePath === key)
    if (created) {
      void fetch(`/api/ai/ingest?id=${created.id}`, { method: 'POST' }).catch((ingestError) =>
        console.error('[documentos] rag ingest', ingestError),
      )
    }
  }

  /**
   * Una tanda entera de archivos recién soltados o elegidos.
   *
   * Van en paralelo — cada uno es su propia fila, su propio storage key, su
   * propia inserción — y el resumen se calcula sobre lo que de verdad terminó
   * en vez de sobre lo que se pidió, porque un archivo que supera el límite ni
   * siquiera llega a intentarlo.
   */
  function addAttachments(items: AttachmentItem[]) {
    if (items.length === 0) return
    const folderId = uploadFolder ?? null
    startTransition(async () => {
      const settled = await Promise.allSettled(items.map((item) => uploadAttachment(item, folderId)))
      const failed = settled.filter((entry) => entry.status === 'rejected').length
      if (failed > 0) {
        addToast(
          failed === items.length ? 'No se pudo subir ningún archivo.' : `${failed} archivo(s) no se pudieron subir.`,
          'err',
        )
      } else {
        addToast(
          items.length === 1 ? 'Documento subido · privado' : `${items.length} documentos subidos · privados`,
          'ok',
        )
      }
    })
  }

  function openUpload(folderId: string | null) {
    setAttachments([])
    setUploadFolder(folderId)
  }

  async function download(d: DocumentoRow) {
    const result = await documentoDownloadUrl(d.id)
    if (!result.ok) { addToast(result.error, 'err'); return }
    // Opened rather than navigated to: the signed URL lives 60 seconds and the
    // response is an attachment, so this must not replace the current page.
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  async function remove(d: DocumentoRow) {
    if (!(await confirm({ title: `¿Eliminar "${d.name}"?`, description: 'El archivo se conserva pero deja de aparecer.', tone: 'danger' }))) return
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

  const exportRows = () => {
    void runExport(
      rows.map((d) => ({
        Nombre: d.name,
        Tipo: d.kind,
        Estado: d.status,
        Fecha: MONTH.format(new Date(d.createdAt)),
        Responsable: d.ownerName ?? (d.department || ''),
      })),
      'documentos-kigyo',
      'documentos',
    )
  }

  return (
    <>
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
              <button className="btn pri" onClick={() => openUpload(activeFolder)} disabled={pending}>
                <Upload size={15} />Subir archivos
              </button>
            )}
          </div>
          <DocTable rows={activeDocs} canWrite={state.canWrite} busy={pending} reviewing={reviewing} indexing={indexing} onEdit={setEditing} onPreview={setPreviewing} onShare={setSharing} onDelete={remove} onDownload={download} onReview={review} onIndex={index} />
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
                <div className="dempty" style={{ padding: '28px 0', textAlign: 'center' }}>
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
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportRows}><FileSpreadsheet size={15} />Exportar</button>
                {state.canWrite && (
                  <button className="btn pri" onClick={() => openUpload(null)} disabled={pending}>
                    <Upload size={15} />Subir archivos
                  </button>
                )}
              </div>
            </div>
          <DocTable rows={rows.length > 0 ? rows : looseDocs} canWrite={state.canWrite} busy={pending} reviewing={reviewing} indexing={indexing} onEdit={setEditing} onPreview={setPreviewing} onShare={setSharing} onDelete={remove} onDownload={download} onReview={review} onIndex={index} />
          </div>
        </>
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

      {sharing && (
        <ShareModal key={sharing.id} doc={sharing} canWrite={state.canWrite} onClose={() => setSharing(null)} />
      )}

      {previewing && (
        <DocumentPreview
          key={previewing.id}
          documentId={previewing.id}
          onClose={() => setPreviewing(null)}
          onDownload={() => download(previewing)}
        />
      )}

      <MorphingModal
        viewId={uploadFolder === undefined ? null : 'upload'}
        onClose={() => setUploadFolder(undefined)}
        labelledBy="upload-modal-title"
        className="upload-modal"
      >
        <div className="mhead" style={{ padding: 0, marginBottom: 16 }}>
          <div className="mtitle" id="upload-modal-title">Subir archivos</div>
          <button className="ibtn" onClick={() => setUploadFolder(undefined)} aria-label="Cerrar"><X size={18} /></button>
        </div>
        {/* Nace privado siempre: quien sube decide después, desde Editar, si
            el archivo pasa a verlo toda la empresa. */}
        <AttachmentUpload
          value={attachments}
          onValueChange={setAttachments}
          onFilesAdded={addAttachments}
          onFilesRejected={(files, reason) =>
            addToast(
              reason === 'too-large'
                ? `${files.length === 1 ? 'Ese archivo supera' : 'Esos archivos superan'} el límite de 50 MB.`
                : 'Ya llegaste al máximo de archivos por tanda.',
              'err',
            )
          }
          onRetry={(item) => {
            patchAttachment(item.id, { error: undefined })
            startTransition(() => uploadAttachment(item, uploadFolder ?? null))
          }}
          maxFileSize={MAX_BYTES}
          description="Cualquier formato, hasta 50 MB por archivo"
        />
      </MorphingModal>

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

/** Badge SVG → etiqueta legible en la columna Tipo. */
const TYPE_LABEL: Record<string, string> = {
  pdf: 'PDF',
  docx: 'Word',
  doc: 'Word',
  csv: 'CSV',
  img: 'Imagen',
  pptx: 'PPT',
}

function DocTable({
  rows, canWrite, busy, reviewing, indexing, onEdit, onPreview, onShare, onDelete, onDownload, onReview, onIndex,
}: {
  rows: DocumentoRow[]
  canWrite: boolean
  busy: boolean
  /** Id of the row whose review is running, or null. */
  reviewing: string | null
  indexing: string | null
  onEdit: (d: DocumentoRow) => void
  onPreview: (d: DocumentoRow) => void
  onShare: (d: DocumentoRow) => void
  onDelete: (d: DocumentoRow) => void
  onDownload: (d: DocumentoRow) => void
  onReview: (d: DocumentoRow) => void
  onIndex: (d: DocumentoRow) => void
}) {
  // Id de la fila con el menú líquido abierto — uno solo en toda la tabla.
  const [openActionsId, setOpenActionsId] = useState<string | null>(null)
  return (
    <div className="tblwrap">
      <table className="tbl">
        <thead><tr><th scope="col">Documento</th><th scope="col">Tipo</th><th scope="col">Subido por</th><th scope="col">Tamaño</th><th scope="col">Fecha</th><th scope="col"></th></tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={6}><div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
              {canWrite ? 'Todavía no hay documentos aquí. Sube el primero.' : 'Todavía no hay documentos aquí.'}
            </div></td></tr>
          ) : rows.map((d) => {
            const icon = documentIconSrc(d.mimeType, d.storagePath)
            const fileType = icon?.split('/').pop()?.replace('.svg', '')
            return (
            <tr className="trow" key={d.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  {icon ? (
                    // eslint-disable-next-line @next/next/no-img-element -- SVG local de tamaño fijo: next/image no optimiza SVG y exigiría `dangerouslyAllowSVG`.
                    <img src={icon} alt="" width={24} height={24} style={{ flexShrink: 0, marginTop: 1 }} />
                  ) : (
                    <FileText size={18} style={{ flexShrink: 0, marginTop: 2, color: 'var(--ink3)' }} />
                  )}
                  <div style={{ minWidth: 0 }}>
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
                  </div>
                </div>
              </td>
              {/* Tipo como chip con su badge SVG; la visibilidad vive aquí y
                  solo cuando importa (privada), no como chip permanente bajo
                  el nombre de cada fila. */}
              <td>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <span className="typechip">
                    {icon ? (
                      // eslint-disable-next-line @next/next/no-img-element -- SVG local de tamaño fijo: next/image no optimiza SVG y exigiría `dangerouslyAllowSVG`.
                      <img src={icon} alt="" width={15} height={15} />
                    ) : (
                      <FileText size={13} style={{ color: 'var(--ink3)' }} />
                    )}
                    {TYPE_LABEL[fileType ?? ''] ?? d.kind}
                  </span>
                  {d.visibility === 'Privada' && (
                    <span className="vlock" data-tip="Privada">
                      <Lock size={12} />
                    </span>
                  )}
                </div>
              </td>
              {/* Quién lo subió es un hecho de la sesión que lo creó; el
                  responsable puede ser otra persona, o nadie. Son dos
                  columnas porque son dos preguntas distintas. */}
              <td className="muted">{d.uploaderName ?? '—'}</td>
              <td className="muted mono" style={{ fontSize: 12 }}>{humanSize(d.sizeBytes)}</td>
              <td className="muted mono" style={{ fontSize: 12 }}>{MONTH.format(new Date(d.createdAt))}</td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <LiquidRowActions
                  name={d.name}
                  open={openActionsId === d.id}
                  onToggle={() => setOpenActionsId((current) => (current === d.id ? null : d.id))}
                  actions={[
                    ...(d.storagePath
                      ? ([
                          {
                            key: 'preview',
                            label: 'Vista previa',
                            icon: <Eye size={13} />,
                            run: () => onPreview(d),
                          },
                        ] as RowAction[])
                      : []),
                    ...(canWrite
                      ? ([
                          {
                            key: 'review',
                            label: d.aiCheckedAt ? 'Revisar de nuevo con IA' : 'Revisar con IA',
                            icon: <Sparkles size={13} />,
                            disabled: busy || reviewing !== null || indexing !== null,
                            busy: reviewing === d.id,
                            run: () => onReview(d),
                          },
                          {
                            key: 'index',
                            label: 'Indexar para la IA',
                            icon: <RotateCcw size={13} />,
                            disabled: busy || reviewing !== null || indexing !== null,
                            busy: indexing === d.id,
                            run: () => onIndex(d),
                          },
                          {
                            key: 'edit',
                            label: 'Editar',
                            icon: <PenLine size={13} />,
                            run: () => onEdit(d),
                          },
                          {
                            key: 'share',
                            label: 'Compartir',
                            icon: <Share2 size={13} />,
                            run: () => onShare(d),
                          },
                          {
                            key: 'delete',
                            label: 'Eliminar',
                            icon: <Trash2 size={13} />,
                            danger: true,
                            disabled: busy,
                            run: () => onDelete(d),
                          },
                        ] as RowAction[])
                      : []),
                  ]}
                />
              </td>
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Acciones líquidas por fila                                         */
/* ------------------------------------------------------------------ */

type RowAction = {
  key: string
  label: string
  icon: React.ReactNode
  danger?: boolean
  disabled?: boolean
  busy?: boolean
  run: () => void
}

/**
 * Menú gooey de acciones: cerrado es un solo botón "+"; al abrir los círculos
 * se separan en abanico hacia la izquierda con stagger. Optimización clave:
 * los iconos solo se montan con el menú abierto — cerrados los círculos se
 * funden en una sola gota sin contenido apilado visible.
 */
function LiquidRowActions({
  name,
  open,
  onToggle,
  actions,
}: {
  name: string
  /** Controlado desde la tabla: solo un menú abierto en toda la lista. */
  open: boolean
  onToggle: () => void
  actions: RowAction[]
}) {
  return (
    <div className={`doc-actions${open ? ' is-open' : ''}`}>
      {/* Grupo siempre montado: cerrado es un solo círculo "+"; la librería
          duerme en reposo, así que el costo idle es cero. */}
      <Liquid
        blur={5}
        contrast={13}
        // Superficie como los botones de la app: fondo suave sin sombra, solo
        // el anillo interior (`inset`) que hace de borde sobre la silueta.
        fill="var(--bg2)"
        shadow="inset 0 0 0 1px var(--line)"
        // El filtro vive en una caja del tamaño del grupo + padding; el abanico
        // se estira ~260px a la izquierda y sin este margen se recorta.
        filterPadding={320}
        // Caja explícita: los hijos son absolutos, sin esto el grupo mide 0.
        style={{ position: 'absolute', left: 0, top: 0, width: 30, height: 30 }}
      >
          {actions.map((action, index) => (
            <Liquid.Item
              key={action.key}
              x={open ? -(index + 1) * 38 : 0}
              transition="bouncy"
              delay={open ? index * 35 : (actions.length - index) * 18}
              style={{ position: 'absolute', left: 0, top: 0 }}
            >
              <button
                type="button"
                className={`round-btn${action.danger ? ' danger' : ''}`}
                disabled={action.disabled}
                aria-busy={action.busy}
                aria-label={`${action.label} ${name}`}
                data-tip={action.label}
                onClick={() => {
                  onToggle()
                  action.run()
                }}
              >
                {/* Icono montado solo abierto: cerrado la gota no enseña nada. */}
                {open ? action.icon : null}
              </button>
            </Liquid.Item>
          ))}
          <Liquid.Item style={{ position: 'absolute', left: 0, top: 0 }}>
            <button
              type="button"
              className="round-btn"
              aria-expanded={open}
              aria-label={open ? `Cerrar acciones de ${name}` : `Acciones de ${name}`}
              onClick={onToggle}
            >
              <Plus
                size={14}
                style={{
                  transform: open ? 'rotate(45deg)' : 'none',
                  transition: 'transform .2s ease',
                }}
              />
            </button>
          </Liquid.Item>
        </Liquid>
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
    visibility: (typeof DOCUMENT_VISIBILITIES)[number]
  }) => void
}) {
  const [form, setForm] = useState({
    name: doc.name,
    kind: doc.kind as (typeof DOCUMENT_KINDS)[number],
    folderId: doc.folderId ?? '',
    status: doc.status as (typeof DOCUMENT_STATUSES)[number],
    expiresOn: doc.expiresOn ?? '',
    visibility: doc.visibility,
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
          {/* La opción dice a quién alcanza, no cómo se llama la columna:
              «Pública» a secas se lee como pública en internet, y no lo es. */}
          <div className="flabel">Quién puede verlo</div>
          <Select
            value={form.visibility}
            onChange={(v) => setForm((f) => ({ ...f, visibility: v as (typeof DOCUMENT_VISIBILITIES)[number] }))}
            options={[
              { value: 'Privada', label: 'Solo yo y con quien lo comparta' },
              { value: 'Pública', label: 'Toda la empresa' },
            ]}
          />
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
              visibility: form.visibility,
            })}
          ><Check size={15} />{busy ? 'Guardando…' : 'Guardar'}</button>
        </div></div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Share                                                              */
/* ------------------------------------------------------------------ */
function ShareModal({ doc, canWrite, onClose }: {
  doc: DocumentoRow
  canWrite: boolean
  onClose: () => void
}) {
  const confirm = useConfirm()
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()
  const [shares, setShares] = useState<DocumentShare[] | null>(null)
  const [email, setEmail] = useState('')
  const [access, setAccess] = useState<(typeof SHARE_ACCESSES)[number]>('Puede ver')

  useEffect(() => {
    let live = true
    fetchDocumentShares(doc.id).then((result) => {
      if (!live) return
      if (!result.ok) { addToast(result.error, 'err'); return }
      setShares(result.data)
    })
    return () => { live = false }
  }, [doc.id, addToast])

  function add() {
    if (!email.trim()) { addToast('Indica el correo de la persona.', 'err'); return }
    startTransition(async () => {
      const result = await shareDocument({ documentId: doc.id, email: email.trim(), employeeId: null, access })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setShares(result.data)
      setEmail('')
      addToast('Acceso compartido', 'ok')
    })
  }

  async function revoke(share: DocumentShare) {
    const who = share.employeeName ?? share.email ?? 'esa persona'
    if (!(await confirm({ title: `¿Quitar el acceso de ${who}?`, tone: 'danger' }))) return
    startTransition(async () => {
      const result = await revokeShare(share.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setShares(result.data)
      addToast('Acceso revocado', 'info')
    })
  }

  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead"><div className="mtitle">Compartir documento</div><button className="ibtn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></div>
        <div className="mbody">
          <div className="elsub" style={{ marginTop: 0 }}>{doc.name}</div>

          {shares === null ? (
            <div className="dempty" style={{ padding: '14px 0' }}>Cargando accesos…</div>
          ) : shares.length === 0 ? (
            <div className="dempty" style={{ padding: '14px 0' }}>Todavía no hay accesos compartidos.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {shares.map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="eltxt" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.employeeName ?? s.email ?? '—'}</div>
                    <div className="elsub">{s.employeeName && s.email ? s.email : `Compartido ${MONTH.format(new Date(s.createdAt))}`}</div>
                  </div>
                  <span className={`badge b-${SHARE_TONE[s.access] ?? 'neu'}`}><span className="bd" />{s.access}</span>
                  {canWrite && (
                    <button className="ibtn" style={{ width: 28, height: 28, color: 'var(--redd)' }} data-tip="Quitar acceso" disabled={pending} onClick={() => revoke(s)} aria-label="Quitar acceso">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {canWrite && (
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <input
                className="field"
                style={{ flex: 1, minWidth: 0 }}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@empresa.co"
                aria-label="Correo de la persona"
              />
              <div style={{ width: 150 }}>
                <Select
                  value={access}
                  onChange={(v) => setAccess(v as (typeof SHARE_ACCESSES)[number])}
                  options={SHARE_ACCESSES.map((a) => ({ value: a, label: a }))}
                />
              </div>
              <button className="btn pri" onClick={add} disabled={pending || !email.trim()} aria-busy={pending}>
                <Share2 size={14} />Compartir
              </button>
            </div>
          )}
        </div>
        <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
          <button className="btn" onClick={onClose} disabled={pending}>Cerrar</button>
        </div></div>
      </div>
    </div>
  )
}
