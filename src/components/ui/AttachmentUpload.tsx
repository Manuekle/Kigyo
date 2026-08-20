'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, Check, Image as ImageIcon, Loader, Paperclip, RotateCcw, Upload, X } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { PresenceGate } from '@/components/ai/PresenceGate'
import { EASE_OUT, SPRING_LAYOUT, SPRING_PRESS } from '@/components/ai/motion-tokens'

export type AttachmentKind = 'file' | 'image'
export type AttachmentStatus = 'idle' | 'uploading' | 'complete' | 'failed'

export interface AttachmentItem {
  id: string
  name: string
  kind: AttachmentKind
  size?: number
  previewUrl?: string
  status?: AttachmentStatus
  error?: string
  file?: File
}

const ITEM_TRANSITION = { duration: 0.2, ease: EASE_OUT } as const
/** Cuánto dura el barrido de progreso simulado antes de que el estado real lo sustituya. */
const FAKE_PROGRESS_MS = 700
const REMOVE_PENDING_MS = 380

function useControllableList<T>({
  value,
  defaultValue,
  onValueChange,
}: {
  value?: T[]
  defaultValue?: T[]
  onValueChange?: (items: T[]) => void
}) {
  const [internal, setInternal] = useState(defaultValue ?? [])
  const controlled = value !== undefined
  const items = value ?? internal

  const setItems = useCallback(
    (next: T[]) => {
      if (!controlled) setInternal(next)
      onValueChange?.(next)
    },
    [controlled, onValueChange],
  )

  return [items, setItems] as const
}

function formatBytes(bytes: number | undefined): string | null {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes <= 0) return null
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`
}

function formatMaxSize(bytes: number): string {
  const megabytes = bytes / (1024 * 1024)
  return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`
}

function inferKind(file: File): AttachmentKind {
  return file.type.startsWith('image/') ? 'image' : 'file'
}

type RowActionState = 'idle' | 'uploading' | 'complete' | 'failed' | 'removing'

function RowAction({
  label,
  onClick,
  state,
  retryable,
  reduce,
}: {
  label: string
  onClick: () => void
  state: RowActionState
  retryable: boolean
  reduce: boolean
}) {
  if (state === 'uploading') return <span aria-hidden="true" className="size-9 shrink-0" />

  if (state === 'complete') {
    return (
      <span
        role="status"
        aria-label={`${label}: subido`}
        data-tip="Subido"
        className="grid size-9 shrink-0 place-items-center rounded-xl text-emerald-600 dark:text-emerald-400"
      >
        <motion.span
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.75 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={ITEM_TRANSITION}
        >
          <Check size={15} />
        </motion.span>
      </span>
    )
  }

  if (state === 'removing') {
    return (
      <span
        role="status"
        aria-label={`Quitando ${label}`}
        className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground"
      >
        <motion.span
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 0.7, ease: 'linear', repeat: Number.POSITIVE_INFINITY }}
          className="grid place-items-center"
        >
          <Loader size={15} />
        </motion.span>
      </span>
    )
  }

  if (state === 'failed') {
    if (!retryable) {
      return (
        <span
          role="status"
          aria-label={`Falló la subida de ${label}`}
          data-tip="No se pudo subir"
          className="grid size-9 shrink-0 place-items-center rounded-xl text-[color:var(--redd)]"
        >
          <AlertCircle size={15} />
        </span>
      )
    }
    return (
      <button
        type="button"
        aria-label={`Reintentar ${label}`}
        data-tip="Reintentar"
        onClick={onClick}
        className="grid size-9 shrink-0 place-items-center rounded-xl text-[color:var(--redd)] outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <RotateCcw size={14} />
      </button>
    )
  }

  return (
    <button
      type="button"
      aria-label={`Quitar ${label}`}
      data-tip="Quitar"
      onClick={onClick}
      className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <X size={15} />
    </button>
  )
}

function ImageThumbnail({
  item,
  layoutId,
  onPreview,
  reduce,
}: {
  item: AttachmentItem
  layoutId?: string
  onPreview: (item: AttachmentItem) => void
  reduce: boolean
}) {
  const src = item.previewUrl
  if (!src) {
    return (
      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <ImageIcon size={15} />
      </span>
    )
  }

  return (
    <motion.button
      type="button"
      aria-label={`Vista previa de ${item.name}`}
      data-tip="Vista previa"
      onClick={(event) => {
        event.currentTarget.blur()
        onPreview(item)
      }}
      whileTap={reduce ? undefined : { scale: 0.94 }}
      transition={SPRING_PRESS}
      className="group/image relative size-9 shrink-0 overflow-hidden rounded-[10px] bg-muted outline-none ring-1 ring-border focus-visible:ring-2 focus-visible:ring-ring"
    >
      <motion.img
        layoutId={layoutId}
        src={src}
        alt=""
        className="size-full object-cover"
        transition={{ layout: SPRING_LAYOUT }}
      />
    </motion.button>
  )
}

/**
 * Superposición de imagen a pantalla completa, abierta desde una miniatura.
 *
 * Se porta al final de `document.body` en vez de anidarse en el modal que la
 * abre: comparte `layoutId` con la miniatura para el zoom compartido, y ese
 * gesto se rompe si la imagen queda dentro del `overflow: hidden` del panel.
 */
function ImagePreviewOverlay({
  item,
  layoutId,
  onClose,
  reduce,
}: {
  item: AttachmentItem | null
  layoutId?: string
  onClose: () => void
  reduce: boolean
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!item) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [item, onClose])

  if (typeof document === 'undefined') return null

  const content =
    item && item.previewUrl ? (
      <PresenceGate key="attachment-preview">
        {({ isPresent, gate }) => (
          <div inert={!isPresent} className="pointer-events-none fixed left-0 top-0 z-[10000] size-0">
            <motion.button
              type="button"
              aria-label="Cerrar vista previa"
              tabIndex={-1}
              className="pointer-events-auto fixed inset-0 size-full cursor-default bg-black/45 backdrop-blur-xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: reduce ? 0.1 : 0.2, ease: EASE_OUT }}
              {...gate}
              onClick={onClose}
            />
            <div className="fixed inset-4 flex items-center justify-center sm:inset-8">
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={`Vista previa de ${item.name}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduce ? undefined : { opacity: 0 }}
                transition={ITEM_TRANSITION}
                {...gate}
                className="pointer-events-auto relative"
              >
                <motion.img
                  layoutId={reduce ? undefined : layoutId}
                  src={item.previewUrl}
                  alt={item.name}
                  className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
                  transition={{ layout: SPRING_LAYOUT }}
                />
                <motion.button
                  ref={closeRef}
                  type="button"
                  aria-label="Cerrar vista previa"
                  onClick={onClose}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduce ? undefined : { opacity: 0, scale: 0.8 }}
                  whileTap={reduce ? undefined : { scale: 0.92 }}
                  transition={SPRING_PRESS}
                  className="absolute -right-3 -top-3 grid size-9 place-items-center rounded-full bg-[var(--elevated)] text-foreground shadow-xl outline-none ring-1 ring-border transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X size={15} />
                </motion.button>
              </motion.div>
            </div>
          </div>
        )}
      </PresenceGate>
    ) : null

  return createPortal(reduce ? content : <AnimatePresence>{content}</AnimatePresence>, document.body)
}

function AttachmentRow({
  item,
  uploading,
  uploadComplete,
  failed,
  removing,
  arrivalIndex,
  imageLayoutId,
  onImagePreview,
  onRemove,
  onRetry,
  reduce,
}: {
  item: AttachmentItem
  uploading: boolean
  uploadComplete: boolean
  failed: boolean
  removing: boolean
  arrivalIndex: number
  imageLayoutId?: string
  onImagePreview: (item: AttachmentItem) => void
  onRemove: (item: AttachmentItem) => void
  onRetry?: (item: AttachmentItem) => void
  reduce: boolean
}) {
  const size = formatBytes(item.size)
  const actionState: RowActionState = removing
    ? 'removing'
    : uploading
      ? 'uploading'
      : uploadComplete
        ? 'complete'
        : failed
          ? 'failed'
          : 'idle'
  const arrivalDelay = Math.min(Math.max(arrivalIndex, 0), 5) * 0.055
  const rowTransition =
    !reduce && arrivalIndex >= 0
      ? { ...SPRING_LAYOUT, delay: arrivalDelay, opacity: { duration: 0.16, ease: EASE_OUT, delay: arrivalDelay } }
      : ITEM_TRANSITION
  const showProgress = uploading || uploadComplete

  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? { opacity: 0 } : arrivalIndex >= 0 ? { opacity: 0, y: -16, scale: 0.985 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? undefined : { opacity: 0, y: -4 }}
      transition={rowTransition}
      className="flex min-h-14 items-center gap-1 rounded-2xl bg-muted p-1"
    >
      <div className="relative isolate flex min-w-0 flex-1 items-center gap-3 self-stretch overflow-hidden rounded-xl bg-[var(--bg2)] px-2 py-1">
        {failed ? <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[var(--reds)]" /> : null}

        {item.kind === 'image' ? (
          <ImageThumbnail item={item} layoutId={imageLayoutId} onPreview={onImagePreview} reduce={reduce} />
        ) : (
          <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center text-muted-foreground">
            <Paperclip size={15} />
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{item.name}</span>
          {failed ? (
            <span className="block truncate text-[11px] text-[color:var(--redd)]">{item.error ?? 'No se pudo subir'}</span>
          ) : null}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{size}</span>

        {reduce ? (
          showProgress ? (
            <span
              role="progressbar"
              aria-label={`Subiendo ${item.name}`}
              className="pointer-events-none absolute inset-0 -z-10 bg-emerald-400/20 dark:bg-emerald-500/15"
            />
          ) : null
        ) : (
          <AnimatePresence>
            {showProgress ? (
              <motion.span
                role="progressbar"
                aria-label={`Subiendo ${item.name}`}
                className="pointer-events-none absolute inset-0 -z-10 origin-left bg-emerald-400/20 dark:bg-emerald-500/15"
                initial={{ opacity: 1, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0.1 : FAKE_PROGRESS_MS / 1000, ease: EASE_OUT }}
              />
            ) : null}
          </AnimatePresence>
        )}
      </div>

      <RowAction
        label={item.name}
        onClick={() => {
          if (actionState === 'failed') { onRetry?.(item); return }
          onRemove(item)
        }}
        state={actionState}
        retryable={onRetry !== undefined}
        reduce={reduce}
      />
    </motion.li>
  )
}

export interface AttachmentUploadProps {
  value?: AttachmentItem[]
  defaultValue?: AttachmentItem[]
  onValueChange?: (items: AttachmentItem[]) => void
  /** Los archivos recién soltados o elegidos, ya convertidos en filas. */
  onFilesAdded?: (items: AttachmentItem[], files: File[]) => void
  onFilesRejected?: (files: File[], reason: 'too-large' | 'max-files') => void
  onRemove?: (item: AttachmentItem) => void
  onRetry?: (item: AttachmentItem) => void
  accept?: string
  multiple?: boolean
  maxFiles?: number
  maxFileSize?: number
  disabled?: boolean
  title?: ReactNode
  description?: ReactNode
  attachmentsLabel?: ReactNode
  className?: string
}

/**
 * Zona para soltar o elegir archivos, con lista de filas y estado real por fila.
 *
 * El progreso de cada fila tiene dos capas independientes y con intención
 * distinta. Un barrido de 700ms corre siempre que la fila entra, sea cual sea
 * el tamaño del archivo — es lo que dice "esto se está moviendo" desde el
 * primer cuadro, sin esperar a que el llamador confirme nada. `item.status`
 * es la verdad: quien use el componente lo pone en `'uploading'` mientras la
 * transferencia real está en curso y en `'complete'` o `'failed'` cuando
 * termina, y esa marca sigue vigente aunque el barrido ya haya terminado su
 * animación. Así una subida de 30 segundos no muestra una barra que llegó al
 * final a los 700ms y luego se queda pegada — se queda "en curso" con razón.
 */
export function AttachmentUpload({
  value,
  defaultValue,
  onValueChange,
  onFilesAdded,
  onFilesRejected,
  onRemove,
  onRetry,
  accept,
  multiple = true,
  maxFiles = 20,
  maxFileSize = 50 * 1024 * 1024,
  disabled = false,
  title = 'Arrastra archivos o haz clic para elegirlos',
  description,
  attachmentsLabel = 'Archivos',
  className,
}: AttachmentUploadProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef(0)
  const ownedUrlsRef = useRef(new Set<string>())
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>())
  const reduce = useReducedMotion() ?? false
  const [dragging, setDragging] = useState(false)
  const [previewItem, setPreviewItem] = useState<AttachmentItem | null>(null)
  const [fakeUploadingIds, setFakeUploadingIds] = useState<Set<string>>(() => new Set())
  const [removingIds, setRemovingIds] = useState<Set<string>>(() => new Set())
  const [items, setItems] = useControllableList({ value, defaultValue, onValueChange })
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(
    () => () => {
      for (const url of ownedUrlsRef.current) URL.revokeObjectURL(url)
      ownedUrlsRef.current.clear()
      for (const timer of timersRef.current) clearTimeout(timer)
      timersRef.current.clear()
    },
    [],
  )

  const maxReached = items.length >= maxFiles
  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer)
      callback()
    }, delay)
    timersRef.current.add(timer)
  }, [])

  const addFiles = useCallback(
    (incoming: File[]) => {
      if (disabled || incoming.length === 0) return

      const availableSlots = Math.max(0, maxFiles - items.length)
      if (availableSlots === 0) {
        onFilesRejected?.(incoming, 'max-files')
        return
      }

      const selected = incoming.slice(0, multiple ? availableSlots : Math.min(1, availableSlots))
      const oversized = selected.filter((file) => file.size > maxFileSize)
      const accepted = selected.filter((file) => file.size <= maxFileSize)

      if (oversized.length > 0) onFilesRejected?.(oversized, 'too-large')
      if (incoming.length > selected.length) onFilesRejected?.(incoming.slice(selected.length), 'max-files')

      const added: AttachmentItem[] = accepted.map((file, index) => {
        const kind = inferKind(file)
        const previewUrl = kind === 'image' ? URL.createObjectURL(file) : undefined
        if (previewUrl) ownedUrlsRef.current.add(previewUrl)
        return { id: `${Date.now()}-${index}-${file.name}`, name: file.name, kind, size: file.size, previewUrl, file }
      })

      if (added.length === 0) return
      setItems([...items, ...added])
      const addedIds = added.map((item) => item.id)
      setFakeUploadingIds((current) => new Set([...current, ...addedIds]))
      schedule(() => {
        setFakeUploadingIds((current) => {
          const next = new Set(current)
          for (const id of addedIds) next.delete(id)
          return next
        })
      }, reduce ? 120 : FAKE_PROGRESS_MS)
      onFilesAdded?.(added, accepted)
    },
    [disabled, items, maxFileSize, maxFiles, multiple, onFilesAdded, onFilesRejected, reduce, schedule, setItems],
  )

  const finalizeRemove = useCallback(
    (item: AttachmentItem) => {
      if (item.previewUrl && ownedUrlsRef.current.has(item.previewUrl)) {
        URL.revokeObjectURL(item.previewUrl)
        ownedUrlsRef.current.delete(item.previewUrl)
      }
      setPreviewItem((current) => (current?.id === item.id ? null : current))
      setFakeUploadingIds((current) => {
        const next = new Set(current)
        next.delete(item.id)
        return next
      })
      setItems(itemsRef.current.filter((entry) => entry.id !== item.id))
      onRemove?.(item)
    },
    [onRemove, setItems],
  )

  const requestRemove = useCallback(
    (item: AttachmentItem) => {
      if (removingIds.has(item.id)) return
      setRemovingIds((current) => new Set(current).add(item.id))
      schedule(() => {
        finalizeRemove(item)
        setRemovingIds((current) => {
          const next = new Set(current)
          next.delete(item.id)
          return next
        })
      }, reduce ? 120 : REMOVE_PENDING_MS)
    },
    [finalizeRemove, reduce, removingIds, schedule],
  )

  const resetDrag = useCallback(() => {
    dragDepthRef.current = 0
    setDragging(false)
  }, [])
  const closePreview = useCallback(() => setPreviewItem(null), [])

  // Derivado, no un efecto: si la fila que la vista previa muestra se quita
  // de la lista (removida o reintentada bajo un id nuevo), la vista deja de
  // mostrarla en el mismo render en vez de un cuadro después.
  const livePreviewItem = previewItem && items.some((item) => item.id === previewItem.id) ? previewItem : null

  const uploadOrder = Array.from(fakeUploadingIds)
  const previewLayoutId = livePreviewItem ? `attachment-image-${livePreviewItem.id}` : undefined

  return (
    <LayoutGroup id={inputId}>
      <div className={cn('w-full', className)}>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          aria-label="Subir archivos"
          accept={accept}
          multiple={multiple}
          disabled={disabled || maxReached}
          tabIndex={-1}
          className="sr-only"
          onChange={(event) => {
            addFiles(Array.from(event.currentTarget.files ?? []))
            event.currentTarget.value = ''
          }}
        />

        <motion.button
          type="button"
          disabled={disabled || maxReached}
          data-dragging={dragging}
          animate={reduce ? undefined : { scale: dragging ? 1.006 : 1 }}
          whileTap={reduce ? undefined : { scale: 0.995 }}
          transition={SPRING_PRESS}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            if (disabled || maxReached) return
            event.preventDefault()
            dragDepthRef.current += 1
            setDragging(true)
          }}
          onDragOver={(event) => {
            if (disabled || maxReached) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
            setDragging(true)
          }}
          onDragLeave={(event) => {
            if (disabled || maxReached) return
            event.preventDefault()
            dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
            if (dragDepthRef.current === 0) setDragging(false)
          }}
          onDrop={(event) => {
            if (disabled || maxReached) return
            event.preventDefault()
            resetDrag()
            addFiles(Array.from(event.dataTransfer.files))
          }}
          className={cn(
            'group relative isolate flex min-h-44 w-full flex-col items-center justify-center overflow-hidden rounded-[1.8rem] bg-muted p-2 text-center outline-none',
            'transition-colors duration-200 hover:bg-[var(--hover)]',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            'disabled:pointer-events-none disabled:opacity-55',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'absolute inset-2 -z-10 rounded-[1.4rem] border border-dashed border-[var(--line)] bg-[var(--bg2)] transition-[border-color,background-color] duration-200 group-hover:border-[var(--ink3)]',
              dragging && 'border-foreground bg-muted',
            )}
          />
          <motion.span
            aria-hidden="true"
            animate={reduce ? undefined : { y: dragging ? -4 : 0, scale: dragging ? 1.08 : 1 }}
            transition={ITEM_TRANSITION}
            className={cn(
              'mb-3 grid size-11 place-items-center rounded-2xl bg-muted text-foreground transition-colors duration-200 group-hover:bg-[var(--active)]',
              dragging && 'bg-foreground text-[color:var(--bg)]',
            )}
          >
            <Upload size={17} />
          </motion.span>
          <span className="text-sm font-semibold tracking-[-0.01em] text-foreground">
            {maxReached ? 'Límite de archivos alcanzado' : title}
          </span>
          <span className="mt-1 text-xs leading-5 text-muted-foreground">
            {maxReached ? `${items.length} de ${maxFiles} archivos` : (description ?? `Hasta ${formatMaxSize(maxFileSize)} por archivo`)}
          </span>
        </motion.button>

        {items.length > 0 ? (
          <section className="mt-6" aria-labelledby={`${inputId}-attachments`}>
            <h3 id={`${inputId}-attachments`} className="text-sm font-semibold text-foreground">
              {attachmentsLabel}
            </h3>
            <ul className="mt-3 space-y-2">
              <AnimatePresence initial={uploadOrder.length > 0}>
                {items.map((item) => (
                  <AttachmentRow
                    key={item.id}
                    item={item}
                    uploading={fakeUploadingIds.has(item.id) || item.status === 'uploading'}
                    uploadComplete={item.status === 'complete'}
                    failed={item.status === 'failed'}
                    removing={removingIds.has(item.id)}
                    arrivalIndex={uploadOrder.indexOf(item.id)}
                    imageLayoutId={reduce ? undefined : `attachment-image-${item.id}`}
                    onImagePreview={setPreviewItem}
                    onRemove={requestRemove}
                    onRetry={onRetry}
                    reduce={reduce}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </section>
        ) : null}

        <ImagePreviewOverlay item={livePreviewItem} layoutId={reduce ? undefined : previewLayoutId} onClose={closePreview} reduce={reduce} />
      </div>
    </LayoutGroup>
  )
}
