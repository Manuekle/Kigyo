'use client'

import { useEffect, useState } from 'react'

/**
 * Keeps a node mounted long enough for its exit transition to play.
 *
 * React unmounts as soon as the flag flips, which is why so many surfaces in
 * this app used to animate open and then vanish. This is the same mount /
 * reveal / linger sequence `Modal` runs, pulled out so every dropdown and
 * panel can share it:
 *
 *   - `render` — keep the node in the DOM (true through the whole close).
 *   - `shown`  — the enter state, set on the next frame so the browser has a
 *                painted "before" to transition from.
 *   - `closing`— the exit state, true for `closeMs` after `open` goes false.
 *
 * `closeMs` must match the CSS close duration for the surface, otherwise the
 * node is either yanked mid-transition or lingers invisible.
 */
export function useExitTransition(open: boolean, closeMs: number) {
  const [render, setRender] = useState(open)
  const [shown, setShown] = useState(false)
  const [prevOpen, setPrevOpen] = useState(open)

  // Sync during render (store-previous-state) rather than in an effect: the
  // node has to be mounted in the very same commit that opens it.
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setRender(true)
    else setShown(false)
  }

  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(raf)
    }
    if (render) {
      const t = setTimeout(() => setRender(false), closeMs)
      return () => clearTimeout(t)
    }
  }, [open, render, closeMs])

  return { render, shown, closing: render && !open }
}

/** Matches `--dropdown-close-dur`. */
export const DROPDOWN_CLOSE_MS = 150

/** Matches `--panel-close-dur`, the side drawer's exit. */
export const PANEL_CLOSE_MS = 350

/** `.t-dropdown` state classes for the current phase. */
export function dropdownClass(shown: boolean, closing: boolean) {
  return `t-dropdown${shown ? ' is-open' : closing ? ' is-closing' : ''}`
}
