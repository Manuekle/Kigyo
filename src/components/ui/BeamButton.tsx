'use client'

import { type ReactNode } from 'react'
import { BorderBeam, type BorderBeamSize } from 'border-beam'
import { useTheme } from '@/lib/context/ThemeContext'

/**
 * The accent ring around a primary call to action.
 *
 * `mono` + `staticColors` on purpose: the rest of the site is a greyscale
 * system, and the hue-shift cycle every other variant runs would be the only
 * colour on the page. What is left is a light travelling around the edge of the
 * control, which is the part that was worth having.
 *
 * Unlike the shader this replaced, `BorderBeam` renders its layers as ordinary
 * absolutely-positioned pseudo-elements behind the child. There is nothing to
 * fall back from — the button is in the DOM and clickable whether or not the
 * animation runs — so this needs no capability detection, no error boundary and
 * no reveal watchdog.
 */
export default function BeamButton({
  children,
  size = 'sm',
  borderRadius,
  className,
}: {
  children: ReactNode
  size?: BorderBeamSize
  /**
   * The wrapped control is a pill, and auto-detection reads its literal
   * `999px`, which blows the glow's corner geometry out. Callers pass half the
   * control's height instead.
   */
  borderRadius?: number
  className?: string
}) {
  const { theme } = useTheme()

  return (
    <BorderBeam
      size={size}
      colorVariant="mono"
      staticColors
      // Passed explicitly rather than left on 'auto', which resolves against
      // the OS and would disagree once the visitor pins a theme.
      theme={theme}
      borderRadius={borderRadius}
      className={className}
    >
      {children}
    </BorderBeam>
  )
}
