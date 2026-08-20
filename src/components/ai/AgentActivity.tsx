'use client'

import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { ActivityRow } from './ActivityRow'
import { AgentDisclosure } from './AgentDisclosure'
import { ThinkingShimmer } from './TextShimmer'
import { EASE_OUT, SPRING_LAYOUT, SPRING_SWAP } from './motion-tokens'
import type {
  AgentActivityContentType,
  AgentActivityItem,
  AgentActivityStatus,
} from './agent-activity-types'

export type * from './agent-activity-types'

function formatDuration(duration: number) {
  const seconds = Math.max(0, Math.round(duration))
  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`
}

function getContentType(items: AgentActivityItem[]): AgentActivityContentType {
  const first = items[0]?.type
  return first && items.every((item) => item.type === first) ? first : 'mixed'
}

function getActiveLabel(type: AgentActivityContentType) {
  if (type === 'search') return 'Buscando en la base de conocimiento…'
  if (type === 'tool') return 'Consultando datos…'
  if (type === 'trace') return 'Resolviendo la consulta…'
  if (type === 'mixed') return 'Trabajando en ello…'
  return 'Pensando…'
}

function getSummary(
  type: AgentActivityContentType,
  items: AgentActivityItem[],
  duration: number,
): ReactNode {
  if (type === 'step' || type === 'text') {
    return (
      <>
        Pensó durante <span className="tabular-nums">{formatDuration(duration)}</span>
      </>
    )
  }
  if (type === 'search') return 'Buscó en la base de conocimiento'
  if (type === 'tool' || type === 'mixed') {
    return `Revisó ${items.length} ${items.length === 1 ? 'fuente' : 'fuentes'}`
  }
  return `Completó ${items.length} ${items.length === 1 ? 'paso' : 'pasos'}`
}

export interface AgentActivityProps {
  /** Entradas en orden cronológico. Se añaden o actualizan según llegan. */
  items: AgentActivityItem[]
  /** Qué se espera ver antes de que llegue la primera entrada. */
  contentType?: AgentActivityContentType
  status?: AgentActivityStatus
  /** Duración del turno en segundos, para el resumen. */
  duration?: number
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  collapseOnComplete?: boolean
  activeLabel?: string
  summary?: ReactNode
  /** Contenido propio para la fila de estado mientras el turno corre. */
  renderWorkingStatus?: (context: { label: string; duration: number }) => ReactNode
  maxHeight?: number
  className?: string
}

/**
 * Lo que el asistente está haciendo, mientras lo hace.
 *
 * Un turno que consulta cinco tablas antes de escribir la primera palabra se
 * ve, sin esto, exactamente igual que uno colgado. El bloque corre abierto y
 * se cierra solo al terminar: durante la ejecución la traza es la respuesta,
 * después es una nota al pie que casi nadie abre.
 *
 * La lista se desplaza con un `transform` sobre el contenido en lugar de con
 * `scrollTop`, porque mientras el turno corre nadie está desplazando a mano y
 * un `transform` no obliga a re-maquetar en cada entrada nueva.
 */
export function AgentActivity({
  items,
  contentType: initialContentType,
  status = 'working',
  duration = 0,
  open,
  defaultOpen = false,
  onOpenChange,
  collapseOnComplete = true,
  activeLabel,
  summary,
  renderWorkingStatus,
  maxHeight = 208,
  className,
}: AgentActivityProps) {
  const reduce = useReducedMotion() ?? false
  const baseId = useId()
  const triggerId = `${baseId}-disparador`
  const contentId = `${baseId}-contenido`
  const contentRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const previousStatus = useRef(status)
  const [contentHeight, setContentHeight] = useState(0)
  const [internalOpen, setInternalOpen] = useState(defaultOpen)

  const currentOpen = open ?? internalOpen
  const setOpen = useCallback(
    (next: boolean) => {
      if (open === undefined) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange, open],
  )

  const working = status === 'working'
  const expanded = working || currentOpen
  const contentType = items.length ? getContentType(items) : (initialContentType ?? 'mixed')
  // La ventana mide lo que mide el contenido hasta el tope, también mientras
  // el turno corre: fijarla en `maxHeight` deja un hueco vacío debajo de la
  // primera fila, que es justo el momento en que la traza tiene una sola.
  const viewportHeight = Math.min(contentHeight, Math.max(0, maxHeight))
  const capped = contentHeight > maxHeight
  const streamOffset = working ? Math.min(0, viewportHeight - contentHeight) : 0

  useLayoutEffect(() => {
    const node = contentRef.current
    if (!node) return

    const measure = () => setContentHeight(node.offsetHeight)
    measure()

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (previousStatus.current === 'working' && status === 'complete') {
      setOpen(!collapseOnComplete)
    }
    previousStatus.current = status
  }, [collapseOnComplete, setOpen, status])

  const toggle = () => {
    const next = !currentOpen
    setOpen(next)
    if (next) requestAnimationFrame(() => viewportRef.current?.scrollTo({ top: 0 }))
  }

  const liveLabel = activeLabel ?? getActiveLabel(contentType)
  const completedSummary = summary ?? getSummary(contentType, items, duration)
  // Difuminado en los bordes por los que la lista sigue: mientras corre solo
  // arriba, porque abajo es donde aparece lo nuevo y ahí nada debe apagarse.
  const maskImage = capped
    ? working
      ? 'linear-gradient(to bottom, transparent, black 12px)'
      : 'linear-gradient(to bottom, transparent, black 12px, black calc(100% - 12px), transparent)'
    : undefined

  return (
    <div
      data-state={working ? 'working' : expanded ? 'open' : 'closed'}
      data-content={contentType}
      aria-busy={working}
      className={cn('w-full text-[13px]', className)}
    >
      {working ? (
        <div
          id={triggerId}
          role="status"
          className="flex h-7 min-w-0 items-center text-muted-foreground"
        >
          {renderWorkingStatus ? (
            renderWorkingStatus({ label: liveLabel, duration })
          ) : (
            <ThinkingShimmer>{liveLabel}</ThinkingShimmer>
          )}
        </div>
      ) : (
        <button
          id={triggerId}
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={toggle}
          className="group flex h-7 min-w-0 items-center gap-1.5 rounded-lg text-left font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="truncate">{completedSummary}</span>
          <motion.span
            aria-hidden="true"
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={reduce ? { duration: 0 } : SPRING_SWAP}
            className="inline-flex shrink-0 text-muted-foreground/70 group-hover:text-foreground"
          >
            <ChevronDown size={13} />
          </motion.span>
        </button>
      )}

      <AgentDisclosure
        id={contentId}
        role="region"
        aria-labelledby={triggerId}
        open={expanded}
        openHeight={viewportHeight}
      >
        <div
          ref={viewportRef}
          className={cn(
            'scrollbar-hide pr-1',
            capped && expanded && !working ? 'overflow-y-auto' : 'overflow-y-hidden',
          )}
          style={{ height: viewportHeight, maskImage, WebkitMaskImage: maskImage }}
        >
          <motion.div
            ref={contentRef}
            role="list"
            initial={false}
            animate={{ y: streamOffset }}
            transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
            className="space-y-0.5 py-2"
          >
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <motion.div
                  layout="position"
                  key={item.id}
                  role="listitem"
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
                  <ActivityRow item={item} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </AgentDisclosure>
    </div>
  )
}
