'use client'

import { cn } from '@/lib/utils'

/**
 * Etiqueta con un barrido de luz, para el estado "esto sigue vivo".
 *
 * Barrer no es latir: una opacidad que late dice "espera", una luz que
 * recorre el texto dice "avanza", y mientras el modelo trabaja lo segundo es
 * lo cierto. Reusa `.t-shimmer` de `globals.css` en lugar de traer el barrido
 * propio del registro — la casa ya tiene uno, con su regla de
 * `prefers-reduced-motion` puesta, y dos barridos distintos en la misma
 * pantalla se notan.
 *
 * El texto va también en `data-text` porque la capa de luz es un `::before`
 * que lee ese atributo, así que solo admite una cadena.
 */
export function ThinkingShimmer({
  children = 'Pensando…',
  className,
}: {
  children?: string
  className?: string
}) {
  return (
    <span className={cn('t-shimmer font-medium', className)} data-text={children}>
      {children}
    </span>
  )
}
