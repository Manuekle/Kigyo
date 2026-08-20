'use client'

import { useIsPresent } from 'framer-motion'
import type { ReactNode } from 'react'

export interface PresenceGateRenderProps {
  /**
   * Falso desde el render que inicia la salida en adelante. Una capa que
   * `AnimatePresence` mantiene en el árbol sigue siendo lo más alto de la
   * página, así que todo lo que decida a partir de `open` seguirá siendo
   * cierto durante toda la salida; este es el booleano que ya sabe que se va.
   */
  isPresent: boolean
  /**
   * Se esparce sobre cada capa que recibe puntero mientras la superposición
   * está abierta. La interacción se suelta en el mismo commit que arranca la
   * salida, mientras la animación sigue: el puntero deja de aterrizar e
   * `inert` saca el subárbol del foco, del orden de tabulación y del árbol de
   * accesibilidad — un diálogo que se está yendo no es un diálogo en el que
   * todavía se pueda escribir.
   */
  gate: {
    inert: boolean
    style: { pointerEvents: 'auto' | 'none' }
  }
}

/**
 * Lee la presencia del subárbol que renderiza y la entrega hacia abajo.
 *
 * `useIsPresent` solo responde dentro del subárbol de `AnimatePresence`, y el
 * componente que posee la superposición es quien renderiza ese
 * `AnimatePresence`, así que el booleano hay que leerlo un nivel más abajo:
 * este es ese nivel, y la render prop es cómo llega a las capas.
 */
export function PresenceGate({
  children,
}: {
  children: (props: PresenceGateRenderProps) => ReactNode
}) {
  const isPresent = useIsPresent()

  return children({
    isPresent,
    gate: { inert: !isPresent, style: { pointerEvents: isPresent ? 'auto' : 'none' } },
  })
}
