import { initials } from '@/lib/utils'

// Monochrome palette — light grays on dark bg
const PALETTE = [
  'rgb(var(--ink-rgb) / .72)', 'rgb(var(--ink-rgb) / .55)', 'rgb(var(--ink-rgb) / .65)', 'rgb(var(--ink-rgb) / .45)',
  'rgb(var(--ink-rgb) / .60)', 'rgb(var(--ink-rgb) / .50)', 'rgb(var(--ink-rgb) / .70)', 'rgb(var(--ink-rgb) / .40)',
]

function pickColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

interface AvatarProps {
  name: string
  size?: number
  className?: string
}

export default function Avatar({ name, size = 32, className = '' }: AvatarProps) {
  const bg = pickColor(name)
  const fontSize = Math.round(size * 0.36)
  return (
    <span
      className={`av ${className}`}
      style={{ width: size, height: size, background: bg, fontSize }}
      title={name}
    >
      {initials(name)}
    </span>
  )
}
