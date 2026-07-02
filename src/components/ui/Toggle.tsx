'use client'

interface ToggleProps {
  on: boolean
  onChange: (on: boolean) => void
  disabled?: boolean
  label?: string
}

export default function Toggle({ on, onChange, disabled = false, label }: ToggleProps) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: disabled ? 'default' : 'pointer' }}>
      <button
        role="switch"
        aria-checked={on}
        disabled={disabled}
        className={`sw${on ? ' on' : ''}`}
        onClick={() => !disabled && onChange(!on)}
        type="button"
      />
      {label && <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>}
    </label>
  )
}
