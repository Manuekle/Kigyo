import { EASE_STANDARD } from '@/lib/motion'

/**
 * Física compartida por la superficie del asistente.
 *
 * La curva no se redefine aquí: es la misma `EASE_STANDARD` que ya usan los
 * tokens CSS de `globals.css`, así que una respuesta que aparece y un panel
 * que se abre viajan con el mismo gesto. Lo que sí vive aquí son los resortes,
 * porque solo existen para las animaciones dirigidas desde JS.
 */
export const EASE_OUT = EASE_STANDARD

/** Presión sobre un control — corto y sin rebote visible. */
export const SPRING_PRESS = {
  type: 'spring',
  stiffness: 500,
  damping: 30,
  mass: 0.6,
} as const

/** Intercambio de contenido dentro de un control (icono, cifra, etiqueta). */
export const SPRING_SWAP = {
  type: 'spring',
  stiffness: 460,
  damping: 30,
  mass: 0.55,
} as const

/** Reordenamiento de listas: filas que entran, salen o se desplazan. */
export const SPRING_LAYOUT = {
  type: 'spring',
  stiffness: 360,
  damping: 32,
  mass: 0.6,
} as const
