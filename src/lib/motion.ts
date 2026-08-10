/**
 * Reads a motion token off `:root` as milliseconds.
 *
 * The tokens are authored in whichever unit reads best at the point of use, so
 * the same stylesheet holds both `80ms` and `2.8s`. `parseFloat` alone treats
 * the latter as 2.8ms — a three-second hold that expires before the next
 * frame — so the unit has to be honoured, not assumed.
 */
/**
 * The house easing — the same curve `--resize-ease`, `--panel-ease` and the
 * rest of the motion tokens carry. Exported for the few animations driven from
 * JS (Motion variants), so they read from one definition instead of repeating
 * the four control points.
 */
export const EASE_STANDARD = [0.22, 1, 0.36, 1] as const

/** Seconds, for Motion's API. Mirrors `--resize-dur` / `--page-slide-dur`. */
export const DUR_RESIZE_S = 0.25

export function cssDurationMs(name: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (!raw) return fallback
  const value = parseFloat(raw)
  if (!Number.isFinite(value)) return fallback
  return raw.endsWith('ms') ? value : value * 1000
}
