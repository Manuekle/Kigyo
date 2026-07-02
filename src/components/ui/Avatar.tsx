import { initials } from '@/lib/utils'

// Monochrome palette — light grays on dark bg
const PALETTE = [
  'rgba(255,255,255,.72)', 'rgba(255,255,255,.55)', 'rgba(255,255,255,.65)', 'rgba(255,255,255,.45)',
  'rgba(255,255,255,.60)', 'rgba(255,255,255,.50)', 'rgba(255,255,255,.70)', 'rgba(255,255,255,.40)',
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
