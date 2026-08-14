'use client'

import { useState, type CSSProperties } from 'react'

interface ToggleProps {
  on: boolean
  onChange: (on: boolean) => void
  disabled?: boolean
  /** Visible text beside the switch. Labels the control on its own. */
  label?: string
  /** Use when the switch has no visible `label` of its own. */
  ariaLabel?: string
  /** `sm` is a real 36×20 track, not a scaled-down `md` — no soft edges. */
  size?: 'md' | 'sm'
  style?: CSSProperties
}

export default function Toggle({ on, onChange, disabled = false, label, ariaLabel, size = 'md', style }: ToggleProps) {
  // `is-init` arms the keyframes on first flip, so a switch that mounts already
  // on sits still instead of playing its bounce on first paint.
  const [init, setInit] = useState(false)

  const sw = (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label ? undefined : ariaLabel}
      disabled={disabled}
      className={`t-toggle${size === 'sm' ? ' sm' : ''}${init ? ' is-init' : ''}`}
      style={style}
      data-on={on ? 'true' : 'false'}
      onClick={() => {
        if (disabled) return
        setInit(true)
        onChange(!on)
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <span className="t-toggle-thumb" aria-hidden="true" />
    </button>
  )

  // Without a visible label there is nothing to wrap, and an empty <label>
  // around a switch only adds a click target that reads as blank to a screen
  // reader.
  if (!label) return sw

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: disabled ? 'default' : 'pointer' }}>
      {sw}
      <span style={{ fontSize: 13, fontWeight: 400 }}>{label}</span>
    </label>
  )
}
