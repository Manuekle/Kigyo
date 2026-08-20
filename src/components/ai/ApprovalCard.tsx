'use client'

import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, HelpCircle, Loader, X } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { AgentDisclosure } from './AgentDisclosure'
import { EASE_OUT, SPRING_SWAP } from './motion-tokens'

export type ApprovalCardStatus = 'pending' | 'submitting' | 'approved' | 'rejected' | 'failed'

const STATUS_LABEL: Record<ApprovalCardStatus, string> = {
  pending: 'Requiere tu visto bueno',
  submitting: 'Ejecutando',
  approved: 'Aprobado',
  rejected: 'Descartado',
  failed: 'No se pudo ejecutar',
}

function StatusIcon({ status }: { status: ApprovalCardStatus }) {
  const reduce = useReducedMotion() ?? false

  if (status === 'submitting') return <Loader size={15} className={reduce ? '' : 'animate-spin'} />
  if (status === 'pending') return <HelpCircle size={15} />
  if (status === 'rejected' || status === 'failed') return <X size={15} />
  return <Check size={15} />
}

/**
 * Una acción que el asistente propone y que solo ocurre si la persona la aprueba.
 *
 * El modelo nunca escribe en la base de datos: propone, y este bloque es el
 * único lugar donde esa propuesta se convierte en una escritura real. Por eso
 * el resumen de lo que va a pasar está desplegado desde el principio en vez
 * de detrás de un "ver detalles" — aprobar sin haber leído no debería ser el
 * camino cómodo.
 *
 * El bloque no desaparece al resolverse: se convierte en el registro de qué
 * se propuso y qué se decidió, que es lo que la conversación necesita
 * conservar.
 */
export function ApprovalCard({
  title = 'Acción propuesta',
  description,
  children,
  status = 'pending',
  onApprove,
  onReject,
  approveLabel = 'Aprobar',
  rejectLabel = 'Descartar',
  result,
  className,
}: {
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  status?: ApprovalCardStatus
  onApprove?: () => void
  onReject?: () => void
  approveLabel?: ReactNode
  rejectLabel?: ReactNode
  /** Qué pasó, una vez resuelta. Sustituye a la etiqueta de estado. */
  result?: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion() ?? false
  const pending = status === 'pending'
  const busy = status === 'submitting'
  const interactive = pending || busy

  return (
    <motion.div
      data-state={status}
      aria-busy={busy}
      layout={reduce ? false : 'position'}
      transition={reduce ? { duration: 0 } : SPRING_SWAP}
      className={cn(
        'w-full overflow-hidden rounded-2xl border border-border bg-muted/50 p-4 text-[13px]',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'grid size-5 shrink-0 place-items-center',
            pending || busy ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          <StatusIcon status={status} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-3">
            <h3 className="min-w-0 flex-1 text-[15px] font-medium leading-5 text-foreground">
              {title}
            </h3>
            <span
              className={cn(
                'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
                interactive
                  ? 'border-border text-muted-foreground'
                  : 'border-transparent bg-foreground text-[color:var(--bg)]',
              )}
            >
              {STATUS_LABEL[status]}
            </span>
          </div>

          {description ? (
            <p className="mt-1 leading-5 text-muted-foreground">{description}</p>
          ) : null}
          {children ? <div className="mt-3">{children}</div> : null}

          <AgentDisclosure open={interactive}>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn dark"
                disabled={busy}
                onClick={onApprove}
                data-cuelume-press="press"
              >
                {busy ? <Loader size={14} className={reduce ? '' : 'animate-spin'} /> : null}
                {approveLabel}
              </button>
              {onReject ? (
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy}
                  onClick={onReject}
                  data-cuelume-press="tick"
                >
                  {rejectLabel}
                </button>
              ) : null}
            </div>
          </AgentDisclosure>

          <AnimatePresence initial={false}>
            {!interactive ? (
              <motion.p
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT }}
                className="mt-1 text-muted-foreground"
              >
                {result ?? STATUS_LABEL[status]}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
