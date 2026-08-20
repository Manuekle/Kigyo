'use client'

import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion'
import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { EASE_OUT } from './motion-tokens'

export interface AgentDisclosureProps
  extends Omit<HTMLMotionProps<'div'>, 'animate' | 'initial'> {
  open: boolean
  openHeight?: CSSProperties['height']
}

/**
 * Apertura y cierre compartidos por todo lo plegable del asistente.
 *
 * La reveladura es un `clip-path`, no una altura animada: recortar no obliga
 * al navegador a re-maquetar en cada cuadro, y el contenido de estos paneles
 * (fuentes, pasos, tareas) cambia mientras la respuesta se transmite. Cerrar
 * es más rápido que abrir a propósito — abrir muestra algo que hay que leer,
 * cerrar solo lo quita de en medio.
 */
export function AgentDisclosure({
  open,
  openHeight = 'auto',
  className,
  style,
  transition,
  ...props
}: AgentDisclosureProps) {
  const reduce = useReducedMotion() ?? false

  return (
    <motion.div
      {...props}
      aria-hidden={!open}
      inert={!open}
      initial={false}
      animate={
        reduce
          ? { opacity: open ? 1 : 0 }
          : {
              opacity: open ? 1 : 0,
              clipPath: open ? 'inset(0 0 0% 0)' : 'inset(0 0 100% 0)',
              y: open ? 0 : -4,
            }
      }
      transition={transition ?? { duration: reduce ? 0 : open ? 0.22 : 0.14, ease: EASE_OUT }}
      className={cn('overflow-hidden', className)}
      style={{
        ...style,
        height: open ? openHeight : 0,
        pointerEvents: open ? undefined : 'none',
        transformOrigin: 'top',
      }}
    />
  )
}
