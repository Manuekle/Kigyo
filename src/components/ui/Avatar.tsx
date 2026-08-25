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
  /** Optional image URL. When present, the image renders instead of the initials. */
  src?: string | null
}

export default function Avatar({ name, size = 32, className = '', src }: AvatarProps) {
  const bg = pickColor(name)
  const fontSize = Math.round(size * 0.36)
  return (
    <span
      className={`av ${className}`}
      style={{ width: size, height: size, background: bg, fontSize }}
      title={name}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          width={size}
          height={size}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
        />
      ) : (
        initials(name)
      )}
    </span>
  )
}
