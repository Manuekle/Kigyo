'use client'

import { useState } from 'react'
import { PANEL_CLOSE_MS, useExitTransition } from '@/lib/hooks/use-exit-transition'

interface DrawerProps<T> {
  /** The record the panel is showing, or `null` when it should be closed. */
  value: T | null
  onClose: () => void
  /** Rendered inside `.drawer`; receives the record, never null. */
  children: (value: T) => React.ReactNode
}

/**
 * The right-hand detail panel: scrim, sheet and the open/close transition.
 *
 * Every page that had one of these rendered `{selected && <>…</>}`, so the
 * panel animated in over --panel-open-dur and then disappeared in a single
 * frame — React unmounted it the moment the flag flipped, leaving the CSS
 * nothing to animate out of. This keeps the node mounted for
 * --panel-close-dur and drives `.drawer` / `.ovl` through `data-open`.
 *
 * That delay is also why `value` is latched: the body reads the record on
 * every line, and by the time the exit plays the page has already set it to
 * null. The panel animates out still showing what it showed when open.
 */
export default function Drawer<T>({ value, onClose, children }: DrawerProps<T>) {
  const open = value != null
  const { render, shown } = useExitTransition(open, PANEL_CLOSE_MS)
  const [latched, setLatched] = useState(value)

  if (value != null && value !== latched) setLatched(value)

  if (!render || latched == null) return null

  return (
    <>
      <div className="ovl" data-open={shown} onClick={onClose} />
      {/* Closing, the panel is still in the DOM but on its way out — `inert`
          is what keeps its controls off the tab order and unclickable while
          it fades. */}
      <aside className="drawer" data-open={shown} inert={!open}>
        {children(latched)}
      </aside>
    </>
  )
}
