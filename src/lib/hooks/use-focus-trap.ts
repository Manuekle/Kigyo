'use client'

import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableWithin(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null || el.getClientRects().length > 0,
  )
}

/**
 * Keeps keyboard focus inside an overlay while it is open, and returns it to
 * whatever opened it on close.
 *
 * Without this, Tab walks straight out of a modal into the page behind it: a
 * keyboard or screen-reader user ends up operating a dialog they can no longer
 * see, with no way back. Escape-to-close alone does not solve that.
 *
 * Attach the returned ref to the overlay's outermost element.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  active: boolean,
  options: { onEscape?: () => void; initialFocus?: 'first' | 'container' } = {},
) {
  const containerRef = useRef<T>(null)
  const { onEscape, initialFocus = 'first' } = options
  const onEscapeRef = useRef(onEscape)
  onEscapeRef.current = onEscape

  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    // Everything outside the overlay is hidden from assistive tech and made
    // unfocusable, so a screen reader cannot wander into the page behind.
    const siblings = [...document.body.children].filter(
      (child) => child !== container && !child.contains(container),
    ) as HTMLElement[]
    const previousInert = siblings.map((el) => el.inert)
    for (const el of siblings) el.inert = true

    const focusables = focusableWithin(container)
    if (initialFocus === 'container' || focusables.length === 0) {
      container.setAttribute('tabindex', '-1')
      container.focus({ preventScroll: true })
    } else {
      focusables[0].focus({ preventScroll: true })
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onEscapeRef.current?.()
        return
      }
      if (event.key !== 'Tab') return

      const current = focusableWithin(container as HTMLElement)
      if (current.length === 0) {
        event.preventDefault()
        return
      }

      const first = current[0]
      const last = current[current.length - 1]
      const activeElement = document.activeElement

      if (event.shiftKey && (activeElement === first || !container?.contains(activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      siblings.forEach((el, i) => {
        el.inert = previousInert[i]
      })
      // Returning focus matters as much as trapping it: otherwise focus falls
      // back to <body> and the next Tab restarts from the top of the page.
      previouslyFocused?.focus?.({ preventScroll: true })
    }
  }, [active, initialFocus])

  return containerRef
}
