import type { KeyboardEvent } from 'react'

/**
 * Makes a non-interactive element (a table row, a card) activate by keyboard.
 *
 * A `<tr onClick>` with no other affordance is unreachable without a mouse:
 * Tab skips it, and there is no way to open the record it represents. Adding a
 * tab stop plus Enter/Space activation is the smallest change that fixes that
 * while leaving table semantics intact — a `<tr role="button">` would tell a
 * screen reader the row is not a row.
 *
 * The label matters: "fila" tells a screen-reader user nothing, so pass
 * something that identifies the record.
 */
export function activatable(onActivate: () => void, label: string) {
  return {
    tabIndex: 0,
    'aria-label': label,
    onClick: onActivate,
    onKeyDown(event: KeyboardEvent) {
      // Ignore keys pressed inside a nested control — a button in a cell
      // handles its own Enter, and re-firing the row action would run both.
      if (event.target !== event.currentTarget) return
      if (event.key === 'Enter' || event.key === ' ') {
        // Space scrolls the page by default; Enter can submit a form.
        event.preventDefault()
        onActivate()
      }
    },
  } as const
}
