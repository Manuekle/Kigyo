'use client'

import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronDown, Copy, RotateCcw, ThumbsDown, ThumbsUp } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { AgentDisclosure } from './AgentDisclosure'
import { CitationList, CitationStack, type CitationItem } from './Citations'
import { EASE_OUT, SPRING_PRESS, SPRING_SWAP } from './motion-tokens'

export type StreamingResponseStatus = 'streaming' | 'complete' | 'error'
export type StreamingResponseFeedback = 'up' | 'down' | null

function ResponseAction({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  const reduce = useReducedMotion() ?? false

  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={label === 'Útil' || label === 'No me sirvió' ? active : undefined}
      onClick={onClick}
      whileTap={reduce ? undefined : { scale: 0.9 }}
      transition={SPRING_PRESS}
      className={cn(
        'grid size-7 place-items-center rounded-lg outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </motion.button>
  )
}

/**
 * El cuerpo de una respuesta del asistente, con lo que se puede hacer con ella.
 *
 * Las acciones no aparecen mientras el texto se transmite. Un botón de copiar
 * sobre una respuesta a medias copia una respuesta a medias, y el pulgar
 * arriba se pulsa sobre lo que se leyó, no sobre lo que todavía está
 * llegando; por eso entran cuando el turno termina, no antes.
 */
export function StreamingResponse({
  children,
  status = 'streaming',
  copyText,
  onCopy,
  onRetry,
  sources = [],
  onFeedbackChange,
  announce = true,
  className,
  contentClassName,
}: {
  children: ReactNode
  status?: StreamingResponseStatus
  /** Texto plano que se lleva el botón de copiar. */
  copyText?: string
  onCopy?: () => void | Promise<void>
  onRetry?: () => void
  sources?: CitationItem[]
  onFeedbackChange?: (feedback: StreamingResponseFeedback) => void
  /** En `false` cuando el registro de la conversación ya anuncia el texto. */
  announce?: boolean
  className?: string
  contentClassName?: string
}) {
  const reduce = useReducedMotion() ?? false
  const baseId = useId()
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<StreamingResponseFeedback>(null)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const copyTimer = useRef<number | undefined>(undefined)

  const streaming = status === 'streaming'
  const complete = status === 'complete'
  const canCopy = Boolean(copyText || onCopy)
  const hasSources = sources.length > 0
  const showActions = !streaming && (canCopy || Boolean(onRetry) || complete || hasSources)
  const sourcesContentId = `${baseId}-fuentes`
  const sourcePrefix = `respuesta-fuente-${baseId.replace(/:/g, '')}`

  useEffect(
    () => () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current)
    },
    [],
  )

  const handleCopy = useCallback(async () => {
    if (onCopy) await onCopy()
    else if (copyText) await navigator.clipboard?.writeText(copyText)

    setCopied(true)
    if (copyTimer.current) window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopied(false), 1600)
  }, [copyText, onCopy])

  const vote = (next: Exclude<StreamingResponseFeedback, null>) => {
    const value = feedback === next ? null : next
    setFeedback(value)
    onFeedbackChange?.(value)
  }

  return (
    <div data-state={status} aria-busy={streaming} className={cn('w-full', className)}>
      <div
        aria-live={announce ? 'polite' : 'off'}
        className={cn('ia-answer', contentClassName)}
      >
        {children}
      </div>

      <AnimatePresence initial={false}>
        {showActions ? (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.12 : 0.22, ease: EASE_OUT }}
            className="mt-2.5"
          >
            <div className="flex items-center gap-0.5">
              {canCopy ? (
                <ResponseAction label={copied ? 'Copiado' : 'Copiar respuesta'} onClick={handleCopy}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </ResponseAction>
              ) : null}
              {onRetry ? (
                <ResponseAction label="Volver a generar" onClick={onRetry}>
                  <RotateCcw size={13} />
                </ResponseAction>
              ) : null}
              {complete ? (
                <>
                  <ResponseAction label="Útil" active={feedback === 'up'} onClick={() => vote('up')}>
                    <ThumbsUp size={13} />
                  </ResponseAction>
                  <ResponseAction
                    label="No me sirvió"
                    active={feedback === 'down'}
                    onClick={() => vote('down')}
                  >
                    <ThumbsDown size={13} />
                  </ResponseAction>
                </>
              ) : null}
              {hasSources ? (
                <button
                  type="button"
                  aria-expanded={sourcesOpen}
                  aria-controls={sourcesContentId}
                  onClick={() => setSourcesOpen((value) => !value)}
                  className="group ml-1 inline-flex min-h-7 items-center gap-2 rounded-lg px-1.5 text-[11px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CitationStack citations={sources} />
                  <span className="tabular-nums">
                    {sources.length} {sources.length === 1 ? 'fuente' : 'fuentes'}
                  </span>
                  <motion.span
                    aria-hidden="true"
                    animate={{ rotate: sourcesOpen ? 180 : 0 }}
                    transition={reduce ? { duration: 0 } : SPRING_SWAP}
                    className="inline-flex text-muted-foreground/50 group-hover:text-muted-foreground"
                  >
                    <ChevronDown size={12} />
                  </motion.span>
                </button>
              ) : null}
            </div>

            {hasSources ? (
              <AgentDisclosure id={sourcesContentId} open={sourcesOpen}>
                <CitationList
                  citations={sources}
                  idPrefix={sourcePrefix}
                  className="mt-2 rounded-xl border border-border bg-muted/60 p-2"
                />
              </AgentDisclosure>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
