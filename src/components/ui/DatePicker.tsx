'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight } from '@/lib/icons'
import { DROPDOWN_CLOSE_MS, dropdownClass, useExitTransition } from '@/lib/hooks/use-exit-transition'
import Select from '@/components/ui/Select'

/**
 * Date (and optionally time) field with an in-app calendar.
 *
 * Replaces `<input type="date">` / `<input type="datetime-local">`. The native
 * control is painted by the platform, not by this stylesheet: it ignores the
 * pill radius, the Saans stack and the theme tokens, ships a Chrome-blue
 * focus ring and a calendar glyph in the OS's own colour, and renders its
 * popup grid in a widget the page cannot style at all. Next to a `Select` in
 * the same `.fg2` row the mismatch is the first thing you see.
 *
 * The value contract is deliberately identical to the input it replaces, so
 * call sites keep their existing state and their existing parse on submit:
 *
 *   withTime === false  →  "YYYY-MM-DD"
 *   withTime === true   →  "YYYY-MM-DDTHH:mm"
 *
 * Both are local wall-clock strings with no zone suffix, exactly as the native
 * controls produce them.
 */

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  /** Renders the hour/minute row and switches the value format. */
  withTime?: boolean
  placeholder?: string
  /** Earliest selectable day, as "YYYY-MM-DD". */
  min?: string
  disabled?: boolean
  className?: string
  /** Accessible name, when the visible `.flabel` is not associated. */
  ariaLabel?: string
}

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
// Five-minute granularity. Nothing in this app books a meeting at 10:37, and
// 60 options is a scroll rather than a choice.
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))
const MONTH_YEAR = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })
const MONTH_SHORT = new Intl.DateTimeFormat('es-CO', { month: 'short' })

const pad = (n: number) => String(n).padStart(2, '0')

/** "YYYY-MM-DD" for a local date, without going through UTC. */
function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Splits the stored value into its date and time halves. Both may be empty. */
function parse(value: string): { date: string; time: string } {
  const [date = '', time = ''] = value.split('T')
  return { date, time: time.slice(0, 5) }
}

/** Local midnight for a "YYYY-MM-DD" key. `new Date(key)` would parse it as UTC. */
function fromKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

export default function DatePicker({
  value, onChange, withTime = false, placeholder, min, disabled, className = '', ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLButtonElement>(null)
  const menu = useExitTransition(open, DROPDOWN_CLOSE_MS)

  const { date, time } = parse(value)
  const selected = fromKey(date)

  // The month on screen. Seeded from the value, and re-seeded whenever the
  // panel is opened so reopening a field never lands on last month's grid.
  const [cursor, setCursor] = useState(() => selected ?? new Date())

  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)

  const grid = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const lead = (new Date(year, month, 1).getDay() + 6) % 7
    const days = new Date(year, month + 1, 0).getDate()
    const cells: Array<number | null> = Array.from({ length: lead }, () => null)
    for (let d = 1; d <= days; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return { year, month, cells }
  }, [cursor])

  const todayKey = toKey(new Date())

  // Placed against the viewport, in a portal: the field lives inside `.mbody`
  // and `.drawer`, both of which scroll and clip, so an absolutely positioned
  // panel would be cut off by its own form.
  const place = () => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const height = withTime ? 372 : 316
    const width = 272
    const below = window.innerHeight - r.bottom
    const top = below < height + 12 && r.top > height ? r.top - height - 6 : r.bottom + 6
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
    setPos({ top, left })
  }

  useLayoutEffect(() => {
    if (open) place()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); ref.current?.focus() }
    }
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('keydown', onKey, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Picking a day on an empty datetime field must not produce a dangling "T",
  // so a missing time falls back to the next round hour — the same default the
  // scheduling forms already use, wrapping to 09:00 rather than past midnight.
  const fallbackTime = useMemo(() => {
    const next = new Date().getHours() + 1
    return `${pad(next > 23 ? 9 : next)}:00`
  }, [])

  const [hh = '', mm = ''] = time.split(':')

  function commitDate(key: string) {
    if (!withTime) { onChange(key); setOpen(false); ref.current?.focus(); return }
    onChange(`${key}T${time || fallbackTime}`)
  }

  function commitTime(nextHh: string, nextMm: string) {
    onChange(`${date || todayKey}T${nextHh}:${nextMm}`)
  }

  const minKey = min ?? ''
  // "10 ago 2026 · 15:00", not the locale's "10 de agosto de 2026": these
  // fields are half-width inside `.fg2`, and the long form ellipsised away the
  // time — the half of the value the user had just picked.
  const label = selected
    ? [
        `${selected.getDate()} ${MONTH_SHORT.format(selected).replace('.', '')} ${selected.getFullYear()}`,
        withTime && time ? time : '',
      ].filter(Boolean).join(' · ')
    : ''

  return (
    <div className={`dpick ${className}`}>
      <button
        type="button"
        ref={ref}
        disabled={disabled}
        className={`dpick-trigger${open ? ' open' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => {
          if (!v) setCursor(selected ?? new Date())
          return !v
        })}
      >
        <span className={label ? '' : 'ph'}>
          {label || placeholder || (withTime ? 'Elegir fecha y hora' : 'Elegir fecha')}
        </span>
        <Calendar size={15} />
      </button>

      {menu.render && mounted && pos && createPortal(
        <>
          {/* Its own catcher, below `.nselect-catch`: the hour and minute
              menus portal out at 149/150, so sharing that layer would put the
              dismiss surface on top of the menu it has to stay under. */}
          <div className="dpick-catch" onClick={() => setOpen(false)} />
          <div
            className={`dpick-panel ${dropdownClass(menu.shown, menu.closing)}`}
            role="dialog"
            aria-label={ariaLabel ?? 'Seleccionar fecha'}
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="dpick-head">
              <button
                type="button"
                className="ibtn"
                aria-label="Mes anterior"
                onClick={() => setCursor(new Date(grid.year, grid.month - 1, 1))}
              ><ChevronLeft size={15} /></button>
              <span className="dpick-month cap-first">{MONTH_YEAR.format(new Date(grid.year, grid.month, 1))}</span>
              <button
                type="button"
                className="ibtn"
                aria-label="Mes siguiente"
                onClick={() => setCursor(new Date(grid.year, grid.month + 1, 1))}
              ><ChevronRight size={15} /></button>
            </div>

            <div className="dpick-grid">
              {DOW.map((d) => <span className="dpick-dow" key={d}>{d}</span>)}
              {grid.cells.map((day, i) => {
                if (day == null) return <span className="dpick-day is-empty" key={i} />
                const key = `${grid.year}-${pad(grid.month + 1)}-${pad(day)}`
                const blocked = minKey !== '' && key < minKey
                return (
                  <button
                    type="button"
                    key={i}
                    disabled={blocked}
                    aria-pressed={key === date}
                    className={`dpick-day${key === date ? ' is-sel' : ''}${key === todayKey ? ' is-today' : ''}`}
                    onClick={() => commitDate(key)}
                  >{day}</button>
                )
              })}
            </div>

            {/* Hour and minute go through the app's own `Select` rather than
                `<input type="time">`, which drags in the same OS-painted
                widget the calendar half was replaced to get away from. */}
            {withTime && (
              <div className="dpick-time">
                <span className="dpick-timelabel">Hora</span>
                <Select
                  className="dpick-timesel"
                  value={hh || fallbackTime.slice(0, 2)}
                  onChange={(v) => commitTime(v, mm || '00')}
                  options={HOURS}
                />
                <span className="dpick-colon">:</span>
                <Select
                  className="dpick-timesel"
                  value={mm || '00'}
                  onChange={(v) => commitTime(hh || fallbackTime.slice(0, 2), v)}
                  options={MINUTES}
                />
              </div>
            )}

            <div className="dpick-foot">
              <button type="button" className="dpick-quick" onClick={() => { setCursor(new Date()); commitDate(todayKey) }}>
                Hoy
              </button>
              <button
                type="button"
                className="dpick-quick"
                onClick={() => { onChange(''); setOpen(false); ref.current?.focus() }}
              >Borrar</button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}
