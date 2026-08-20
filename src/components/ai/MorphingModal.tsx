'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { PresenceGate } from './PresenceGate'
import { EASE_OUT } from './motion-tokens'

/** Entrada de un panel invocado por el puntero. */
const SPRING_PANEL = { type: 'spring', stiffness: 420, damping: 40, mass: 0.5 } as const

/**
 * Diálogo que se transforma entre vistas en lugar de cerrarse y volver a abrirse.
 *
 * `viewId` es la vista visible y `null` cierra. Cambiarlo con el diálogo
 * abierto no lo remonta: el panel mide la vista nueva y se redimensiona hacia
 * ella mientras el contenido se cruza, que es lo que permite encadenar
 * confirmar → ejecutando → resultado sin que la caja parpadee.
 */
export function MorphingModal({
  viewId,
  onClose,
  children,
  placement = 'center',
  labelledBy,
  className,
}: {
  viewId: string | null
  onClose: () => void
  children: ReactNode
  /** `bottom` ancla al borde inferior; `center` centra verticalmente. */
  placement?: 'bottom' | 'center'
  labelledBy?: string
  className?: string
}) {
  const open = viewId !== null
  const reduce = useReducedMotion()
  const enterY = reduce ? 0 : placement === 'bottom' ? 40 : 20
  const enterScale = reduce ? 1 : 0.97

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  // Escape cierra: es lo que hace el `confirm` nativo que esto sustituye, y
  // una superposición que solo se cierra con el ratón es una trampa para
  // quien navega con teclado.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Mientras está abierto el marco son dos hermanos fijos y no un envoltorio:
  // el fondo cubre el borde del viewport y lleva el velo, y la capa que
  // coloca el panel va metida hacia dentro. Ambos cuelgan de `PresenceGate`,
  // así que la interacción se suelta cuando empieza la salida y no cuando
  // termina.
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <PresenceGate key="backdrop">
          {({ gate }) => (
            <motion.button
              type="button"
              aria-label="Cerrar"
              tabIndex={-1}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              {...gate}
              onClick={onClose}
              className="mm-backdrop"
            />
          )}
        </PresenceGate>
      ) : null}

      {open ? (
        <PresenceGate key="panel-layer">
          {({ isPresent, gate }) => (
            // La capa nunca recibe puntero, así que lleva `inert` sola: el
            // valor del gate sobrescribiría su propio `pointer-events: none`.
            <div
              inert={!isPresent}
              className={cn('mm-layer', placement === 'bottom' ? 'mm-layer-bottom' : null)}
            >
              <motion.div
                key="panel"
                layout
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
                initial={{ opacity: 0, y: enterY, scale: enterScale }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  y: enterY,
                  scale: reduce ? 1 : 0.98,
                  transition: { duration: 0.18, ease: EASE_OUT },
                }}
                transition={SPRING_PANEL}
                {...gate}
                className={cn('mm-panel', className)}
              >
                <motion.div layout="position" className="mm-body">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                      key={viewId}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: 'blur(4px)' }}
                      animate={
                        reduce
                          ? { opacity: 1, transition: { duration: 0.18, ease: EASE_OUT } }
                          : {
                              opacity: 1,
                              y: 0,
                              filter: 'blur(0px)',
                              transition: { duration: 0.24, ease: EASE_OUT },
                            }
                      }
                      exit={
                        reduce
                          ? { opacity: 0, transition: { duration: 0.14, ease: EASE_OUT } }
                          : {
                              opacity: 0,
                              y: -8,
                              filter: 'blur(4px)',
                              transition: { duration: 0.16, ease: EASE_OUT },
                            }
                      }
                    >
                      {children}
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            </div>
          )}
        </PresenceGate>
      ) : null}
    </AnimatePresence>
  )
}
