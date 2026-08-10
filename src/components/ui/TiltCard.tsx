'use client'

import { useRef, type ReactNode } from 'react'

/**
 * A card that rotates toward the pointer, with a glare that tracks it.
 *
 * The pointer maths run against the OUTER wrapper's rect, never the card's.
 * The card is mid-rotation while the pointer moves, so measuring it would feed
 * its own tilt back into the next frame and the rotation would wander instead
 * of tracking the cursor. The wrapper is flat and stays flat.
 *
 * Everything the animation needs is a CSS custom property, so the work per
 * pointer event is four `setProperty` calls — no React state, no re-render.
 */
export default function TiltCard({
  children,
  className = '',
  max = 5,
  radius,
  ...rest
}: {
  children: ReactNode
  className?: string
  /** Maximum rotation on each axis, in degrees. */
  max?: number
  /**
   * Corner radius, in px, for when this is a bare shell around a card rather
   * than the card itself. The glare inherits it, and without it the highlight
   * would be a sharp rectangle over rounded content.
   */
  radius?: number
} & React.HTMLAttributes<HTMLDivElement>) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  function track(e: React.PointerEvent<HTMLDivElement>) {
    const wrap = wrapRef.current
    const card = cardRef.current
    if (!wrap || !card) return

    const rect = wrap.getBoundingClientRect()
    // -1 … 1 from the centre of the card on each axis.
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height

    // rotateX is inverted: the pointer near the top edge should tip the card's
    // top away from the viewer, which is a negative X rotation.
    wrap.style.setProperty('--tilt-ry', `${(px * 2 - 1) * max}deg`)
    wrap.style.setProperty('--tilt-rx', `${(1 - py * 2) * max}deg`)
    wrap.style.setProperty('--tilt-gx', `${px * 100}%`)
    wrap.style.setProperty('--tilt-gy', `${py * 100}%`)

    wrap.classList.add('is-hover')
    card.classList.add('is-tilting')
  }

  function release() {
    const wrap = wrapRef.current
    const card = cardRef.current
    if (!wrap || !card) return
    // Dropping `is-tilting` first is what hands the card back to the long
    // return ease; clearing the angles then lets it settle flat under it.
    card.classList.remove('is-tilting')
    wrap.classList.remove('is-hover')
    wrap.style.setProperty('--tilt-rx', '0deg')
    wrap.style.setProperty('--tilt-ry', '0deg')
  }

  return (
    <div
      ref={wrapRef}
      className="t-tilt"
      onPointerMove={track}
      onPointerLeave={release}
      onPointerCancel={release}
      {...rest}
    >
      <div
        ref={cardRef}
        className={`t-tilt-card ${className}`}
        style={radius === undefined ? undefined : { borderRadius: radius }}
      >
        {children}
        <div className="t-tilt-glare" aria-hidden="true" />
      </div>
    </div>
  )
}
