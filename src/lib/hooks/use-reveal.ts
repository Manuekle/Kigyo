'use client'

import { useEffect } from 'react'

/**
 * Scroll-triggered reveal for marketing sections.
 *
 * Elements opt in with `data-reveal` (and an optional `data-reveal-delay` to
 * stagger siblings). They stay visible until this hook marks the document with
 * `js-reveal` — so if the bundle never loads, the page still reads. That
 * ordering is the whole point: a landing page that hides its own content
 * behind JavaScript is worse than one that does not animate.
 *
 * Elements are unobserved once shown; this is an entrance, not a scrubbing
 * effect that replays every time the section scrolls past.
 */
export function useReveal(scopeSelector = '[data-reveal]') {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(scopeSelector))
    if (nodes.length === 0) return

    const root = document.documentElement

    // Reduced motion still gets the class removed from the equation entirely:
    // the CSS guard would neutralise the transition, but not observing at all
    // is cheaper and has the same result.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

    root.classList.add('js-reveal')

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-shown')
          observer.unobserve(entry.target)
        }
      },
      // Positive bottom margin extends the observed area *below* the fold, so
      // an element starts its entrance while it is still off-screen and is
      // already settled by the time it scrolls into view. A negative value
      // here would do the opposite — hold the element blank until it is
      // well inside the viewport, which reads as content failing to load.
      { rootMargin: '0px 0px 14% 0px', threshold: 0 },
    )

    for (const node of nodes) observer.observe(node)

    return () => {
      observer.disconnect()
      root.classList.remove('js-reveal')
    }
  }, [scopeSelector])
}
