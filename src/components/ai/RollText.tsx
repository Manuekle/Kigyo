'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { SPRING_SWAP } from './motion-tokens'

/**
 * Cifra o etiqueta que rueda al cambiar de valor.
 *
 * Un contador que salta de 1/4 a 2/4 sin más no se distingue de un contador
 * que siempre estuvo en 2/4. El giro es lo que dice que algo acaba de
 * terminar, y por eso la altura queda fija: la fila no puede crecer mientras
 * el número gira o el bloque entero temblaría con cada tarea completada.
 */
export function RollText({ value, children }: { value: string; children: ReactNode }) {
  const reduce = useReducedMotion() ?? false

  if (reduce) return <span>{children}</span>

  return (
    <span className="relative inline-grid overflow-hidden align-bottom">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: '-100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={SPRING_SWAP}
          className="col-start-1 row-start-1"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
