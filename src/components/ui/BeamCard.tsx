'use client'

import { type ReactNode } from 'react'
import { BorderBeam, type BorderBeamSize } from 'border-beam'
import { useTheme } from '@/lib/context/ThemeContext'

/**
 * The halo around a card that needs to be the one you look at first.
 *
 * `pulse-outside` rather than the travelling beam the buttons use: on an
 * element this large a light running the perimeter reads as a loading state.
 * A slow bloom just past the edge says "this one" without implying progress.
 *
 * Two things that preset needs and gets here:
 *   - an opaque child, because the glow renders behind the content and only
 *     the part spilling past the edge should show. `.card` is opaque.
 *   - its own 1px border, which the preset rides instead of painting a second
 *     hairline. `.card` has one.
 *
 * The wrapper is `overflow: visible`, so whatever contains it needs room for
 * the bloom to spill into — a grid gap is enough.
 */
export default function BeamCard({
  children,
  size = 'pulse-outside',
  borderRadius,
  strength,
  className = '',
  ...rest
}: {
  children: ReactNode
  size?: BorderBeamSize
  borderRadius?: number
  strength?: number
  className?: string
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>) {
  const { theme } = useTheme()

  return (
    <BorderBeam
      size={size}
      colorVariant="mono"
      staticColors
      theme={theme}
      borderRadius={borderRadius}
      strength={strength}
      // `beam-cell` carries the grid-cell height down to the card, which would
      // otherwise stop at this wrapper and leave a short column.
      className={`beam-cell ${className}`}
      {...rest}
    >
      {children}
    </BorderBeam>
  )
}
