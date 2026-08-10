'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Slides between the steps of a linear flow instead of cutting between them,
 * so a wizard reads as one surface moving forward rather than four unrelated
 * screens.
 *
 * The steps are stacked absolutely (that is what lets the outgoing one keep
 * painting while the incoming one arrives), which leaves the container with no
 * height of its own — so it is measured from the active step and tweened with
 * the card-resize token. Without that the card would collapse to nothing.
 */
export default function PageSlide({
  page,
  children,
  className = '',
}: {
  /** 1-based index of the visible step. */
  page: number
  children: React.ReactNode[]
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)

  // Layout effect so the first paint already has the right height rather than
  // flashing a collapsed card.
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const active = root.querySelector<HTMLElement>(`.t-page[data-page-id="${page}"]`)
    if (active) setHeight(active.offsetHeight)
  }, [page, children])

  // Steps grow and shrink under the user — a validation message appears, a
  // resend countdown starts — so the height has to keep tracking, not just
  // settle once per step.
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const active = root.querySelector<HTMLElement>(`.t-page[data-page-id="${page}"]`)
    if (!active) return
    const ro = new ResizeObserver(() => setHeight(active.offsetHeight))
    ro.observe(active)
    return () => ro.disconnect()
  }, [page])

  return (
    <div
      ref={ref}
      className={`t-page-slide t-resize${className ? ` ${className}` : ''}`}
      data-page={page}
      style={height === null ? undefined : { height }}
    >
      {children.map((child, i) => (
        <section key={i} className="t-page" data-page-id={i + 1} aria-hidden={i + 1 !== page}>
          {child}
        </section>
      ))}
    </div>
  )
}
