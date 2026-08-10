'use client'

import { useState } from 'react'

interface FolderProps {
  color?: string
  size?: number
  items?: React.ReactNode[]
  className?: string
}

function darkenColor(hex: string, percent: number): string {
  let color = hex.startsWith('#') ? hex.slice(1) : hex
  if (color.length === 3) color = color.split('').map(c => c + c).join('')
  const num = parseInt(color, 16)
  let r = (num >> 16) & 0xff
  let g = (num >> 8) & 0xff
  let b = num & 0xff
  r = Math.max(0, Math.min(255, Math.floor(r * (1 - percent))))
  g = Math.max(0, Math.min(255, Math.floor(g * (1 - percent))))
  b = Math.max(0, Math.min(255, Math.floor(b * (1 - percent))))
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
}

export default function Folder({ color = '#5227FF', size = 1, items = [], className = '' }: FolderProps) {
  const maxItems = 3
  const papers = items.slice(0, maxItems)
  while (papers.length < maxItems) papers.push(null)

  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const [paperOffsets, setPaperOffsets] = useState<{ x: number; y: number }[]>(
    Array.from({ length: maxItems }, () => ({ x: 0, y: 0 }))
  )

  const folderBackColor = darkenColor(color, 0.08)
  const paper1 = darkenColor('#ffffff', 0.1)
  const paper2 = darkenColor('#ffffff', 0.05)
  const paper3 = '#ffffff'

  const handleClick = () => {
    setOpen(prev => !prev)
    if (open) setPaperOffsets(Array.from({ length: maxItems }, () => ({ x: 0, y: 0 })))
  }

  const handlePaperMouseMove = (e: React.MouseEvent<HTMLDivElement>, index: number) => {
    if (!open) return
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    setPaperOffsets(prev => {
      const next = [...prev]
      next[index] = { x: (e.clientX - cx) * 0.15, y: (e.clientY - cy) * 0.15 }
      return next
    })
  }

  const handlePaperMouseLeave = (_e: React.MouseEvent<HTMLDivElement>, index: number) => {
    setPaperOffsets(prev => {
      const next = [...prev]
      next[index] = { x: 0, y: 0 }
      return next
    })
  }

  const getOpenTransform = (index: number) => {
    if (index === 0) return 'translate(-120%, -70%) rotate(-15deg)'
    if (index === 1) return 'translate(10%, -70%) rotate(15deg)'
    if (index === 2) return 'translate(-50%, -100%) rotate(5deg)'
    return ''
  }

  const scaleStyle: React.CSSProperties = { transform: `scale(${size})`, transformOrigin: 'top left' }

  /* paper sizes — Tailwind w-[70%] h-[80%] etc */
  const paperSize = (i: number) => {
    if (i === 0) return { w: '70%', h: open ? '80%' : '80%' }
    if (i === 1) return { w: '80%', h: open ? '80%' : '70%' }
    return { w: '90%', h: open ? '80%' : '60%' }
  }

  return (
    <div style={scaleStyle} className={className}>
      <div
        onClick={handleClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() } }}
        tabIndex={0}
        role="button"
        aria-expanded={open}
        aria-label={open ? 'Close folder' : 'Open folder'}
        style={{
          position: 'relative',
          // Only the lift is animated — `all` would sweep in any property
          // that happens to change later, including layout ones.
          transition: 'transform 180ms ease-out',
          cursor: 'pointer',
          outline: 'none',
          transform: open ? 'translateY(-8px)' : hover ? 'translateY(-8px)' : undefined,
        }}
      >
        {/* folder body */}
        <div
          style={{
            position: 'relative',
            width: 100, height: 80,
            borderRadius: '0 10px 10px 10px',
            backgroundColor: folderBackColor,
          }}
        >
          {/* tab */}
          <span
            style={{
              position: 'absolute',
              zIndex: 0,
              bottom: '98%',
              left: 0,
              width: 30,
              height: 10,
              borderRadius: '5px 5px 0 0',
              backgroundColor: folderBackColor,
            }}
          />

          {/* papers */}
          {papers.map((item, i) => {
            const sz = paperSize(i)
            const tOpen = getOpenTransform(i) + ` translate(${paperOffsets[i].x}px, ${paperOffsets[i].y}px)`
            return (
              <div
                key={i}
                onMouseMove={e => handlePaperMouseMove(e, i)}
                onMouseLeave={e => handlePaperMouseLeave(e, i)}
                style={{
                  position: 'absolute',
                  zIndex: 20,
                  bottom: '10%',
                  left: '50%',
                  width: sz.w,
                  height: sz.h,
                  backgroundColor: i === 0 ? paper1 : i === 1 ? paper2 : paper3,
                  borderRadius: 10,
                  transform: open
                    ? tOpen
                    : `translate(-50%, ${10 - i * 6}%)`,
                  transition: 'transform var(--resize-dur) var(--resize-ease)',
                  ...(open && { zIndex: 20 + (hover ? 1 : 0) }),
                }}
              >
                {item}
              </div>
            )
          })}

          {/* front flap left */}
          <div
            style={{
              position: 'absolute',
              zIndex: 30,
              width: '100%',
              height: '100%',
              transformOrigin: 'bottom center',
              backgroundColor: color,
              borderRadius: '5px 10px 10px 10px',
              transition: 'transform var(--resize-dur) var(--resize-ease)',
              ...(open && { transform: 'skew(15deg) scaleY(0.6)' }),
              ...(!open && hover && { transform: 'skew(15deg) scaleY(0.6)' }),
            }}
          />

          {/* front flap right */}
          <div
            style={{
              position: 'absolute',
              zIndex: 30,
              width: '100%',
              height: '100%',
              transformOrigin: 'bottom center',
              backgroundColor: color,
              borderRadius: '5px 10px 10px 10px',
              transition: 'transform var(--resize-dur) var(--resize-ease)',
              ...(open && { transform: 'skew(-15deg) scaleY(0.6)' }),
              ...(!open && hover && { transform: 'skew(-15deg) scaleY(0.6)' }),
            }}
          />
        </div>
      </div>
    </div>
  )
}
