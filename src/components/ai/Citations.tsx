'use client'

import { type ReactNode, useCallback, useId, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BookOpen, ChevronDown, ExternalLink, Globe } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { AgentDisclosure } from './AgentDisclosure'
import { EASE_OUT, SPRING_LAYOUT, SPRING_SWAP } from './motion-tokens'

export interface CitationItem {
  id: string
  title: ReactNode
  domain?: ReactNode
  url?: string
}

function targetId(prefix: string, id: string) {
  return `${prefix}-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

/** El dominio de una fuente, cuando la fuente es una URL y no un documento. */
export function citationDomain(url?: string): string | undefined {
  if (!url) return undefined
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

/**
 * Marca de fuente intercalada en el texto: `[1]`, ligada a su fila.
 *
 * Es un ancla real a la fila de la lista, no un número decorativo, así que el
 * teclado llega hasta la fuente y el navegador la desplaza a la vista.
 */
export function Citation({
  citationId,
  index,
  idPrefix,
}: {
  citationId: string
  index: number
  idPrefix: string
}) {
  return (
    <a
      href={`#${targetId(idPrefix, citationId)}`}
      aria-label={`Ver fuente ${index}`}
      className="mx-0.5 inline-flex min-w-4 -translate-y-0.5 items-center justify-center rounded-md bg-muted px-1 py-0.5 text-[10px] font-semibold leading-none text-muted-foreground no-underline outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {index}
    </a>
  )
}

/**
 * Glifo de la fuente.
 *
 * Los favicons remotos quedaron fuera a propósito: son una petición a un
 * tercero por cada respuesta, y aquí la mayoría de las fuentes son documentos
 * internos que no tienen ninguno. Un globo para lo que vive en la web y una
 * hoja para lo que vive en la organización dice lo mismo sin salir a la red.
 */
export function CitationGlyph({ url, className }: { url?: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground',
        className,
      )}
    >
      {url ? <Globe size={12} /> : <BookOpen size={12} />}
    </span>
  )
}

/** Pila de glifos superpuestos — el resumen de "de dónde salió esto". */
export function CitationStack({
  citations,
  limit = 3,
  className,
}: {
  citations: CitationItem[]
  limit?: number
  className?: string
}) {
  return (
    <span aria-hidden="true" className={cn('flex -space-x-1.5', className)}>
      {citations.slice(0, limit).map((citation) => (
        <CitationGlyph
          key={citation.id}
          url={citation.url}
          className="size-5 rounded-full ring-2 ring-background"
        />
      ))}
    </span>
  )
}

function CitationRow({
  citation,
  index,
  idPrefix,
}: {
  citation: CitationItem
  index: number
  idPrefix: string
}) {
  const content = (
    <>
      <CitationGlyph url={citation.url} />
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="truncate text-[13px] font-medium text-foreground/80 transition-colors group-hover/cita:text-foreground">
          {citation.title}
        </span>
        {citation.domain ? (
          <span className="min-w-0 truncate text-[11px] text-muted-foreground/60">
            {citation.domain}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="grid size-5 place-items-center rounded-md bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground">
          {index}
        </span>
        {citation.url ? (
          <ExternalLink
            size={13}
            className="text-muted-foreground/40 transition-colors group-hover/cita:text-muted-foreground"
          />
        ) : null}
      </span>
    </>
  )
  const className =
    'group/cita flex items-center gap-2 rounded-lg px-1.5 py-1 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring'
  const id = targetId(idPrefix, citation.id)

  return citation.url ? (
    <a id={id} href={citation.url} target="_blank" rel="noreferrer noopener" className={className}>
      {content}
    </a>
  ) : (
    <div id={id} className={className}>
      {content}
    </div>
  )
}

export function CitationList({
  citations,
  idPrefix,
  className,
}: {
  citations: CitationItem[]
  idPrefix?: string
  className?: string
}) {
  const reduce = useReducedMotion() ?? false
  const baseId = useId()
  const prefix = idPrefix ?? `cita-lista-${baseId.replace(/:/g, '')}`

  return (
    <div className={cn('grid gap-0.5', className)}>
      <AnimatePresence mode="popLayout">
        {citations.map((citation, index) => (
          <motion.div
            layout="position"
            key={citation.id}
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -3 }}
            transition={
              reduce
                ? { duration: 0 }
                : {
                    opacity: { duration: 0.18, ease: EASE_OUT },
                    y: SPRING_LAYOUT,
                    layout: SPRING_LAYOUT,
                  }
            }
          >
            <CitationRow citation={citation} index={index + 1} idPrefix={prefix} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/** Lista de fuentes plegada bajo su propio disparador. */
export function Citations({
  citations,
  title = 'Fuentes',
  open,
  defaultOpen = false,
  onOpenChange,
  idPrefix,
  className,
}: {
  citations: CitationItem[]
  title?: ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  idPrefix?: string
  className?: string
}) {
  const reduce = useReducedMotion() ?? false
  const baseId = useId()
  const contentId = `${baseId}-contenido`
  const prefix = idPrefix ?? `cita-${baseId.replace(/:/g, '')}`
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const currentOpen = open ?? internalOpen

  const setOpen = useCallback(
    (next: boolean) => {
      if (open === undefined) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange, open],
  )

  if (citations.length === 0) return null

  return (
    <div className={cn('w-full text-sm', className)}>
      <button
        type="button"
        aria-expanded={currentOpen}
        aria-controls={contentId}
        onClick={() => setOpen(!currentOpen)}
        className="group -ml-1 flex min-h-8 items-center gap-2 rounded-lg px-1 text-left text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BookOpen size={15} />
        <span className="text-[13px] font-medium">{title}</span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
          {citations.length}
        </span>
        <motion.span
          aria-hidden="true"
          animate={{ rotate: currentOpen ? 180 : 0 }}
          transition={reduce ? { duration: 0 } : SPRING_SWAP}
          className="inline-flex text-muted-foreground/60"
        >
          <ChevronDown size={13} />
        </motion.span>
      </button>

      <AgentDisclosure id={contentId} open={currentOpen}>
        <CitationList citations={citations} idPrefix={prefix} className="mt-1" />
      </AgentDisclosure>
    </div>
  )
}
