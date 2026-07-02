'use client'

import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { useState } from 'react'
import {
  FileText,
  FileImage,
  FileSpreadsheet,
  File as FileIcon,
  ChevronRight,
} from 'lucide-react'

/* ---------- Tipos ---------- */
type DocType = 'pdf' | 'doc' | 'xls' | 'img' | 'txt'

export interface DocItem {
  id: string
  name: string
  type: DocType
  size: string
}

interface DocumentFolderProps {
  title?: string
  documents: DocItem[]
  onSelect?: (doc: DocItem) => void
}

/* ---------- Estética glass #1A1A1A ---------- */
const GLASS_BACK = 'rgba(26,26,26,.82)'   // #1A1A1A
const GLASS_FRONT = 'rgba(26,26,26,.86)'  // #1A1A1A
const SHADOW = '0 22px 45px -14px rgba(0,0,0,.55)'
const HL = 'rgba(255,255,255,.14)'

/* ---------- Estilo por tipo de archivo ---------- */
const typeStyles: Record<DocType, { bg: string; color: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = {
  pdf: { bg: 'rgba(239,68,68,.12)', color: '#ef4444', Icon: FileText },
  doc: { bg: 'rgba(59,130,246,.12)', color: '#3b82f6', Icon: FileText },
  xls: { bg: 'rgba(34,197,94,.12)', color: '#22c55e', Icon: FileSpreadsheet },
  img: { bg: 'rgba(168,85,247,.12)', color: '#a855f7', Icon: FileImage },
  txt: { bg: 'rgba(100,116,139,.14)', color: '#64748b', Icon: FileIcon },
}

/* ---------- Papeles (asoman al abrir) ---------- */
type PaperState = { rotate: number; y: number; scale: number }
const papers: { z: number; rest: PaperState; hover: PaperState; open: PaperState }[] = [
  { z: 1, rest: { rotate: -5, y: -6, scale: 0.88 }, hover: { rotate: -9, y: -30, scale: 0.88 }, open: { rotate: -14, y: -44, scale: 0.9 } },
  { z: 2, rest: { rotate: 5, y: -6, scale: 0.88 }, hover: { rotate: 9, y: -30, scale: 0.88 }, open: { rotate: 14, y: -44, scale: 0.9 } },
  { z: 3, rest: { rotate: 0, y: -6, scale: 0.92 }, hover: { rotate: 0, y: -34, scale: 0.92 }, open: { rotate: 0, y: -56, scale: 0.94 } },
]

/* ---------- Variants de la lista ---------- */
const listVariants: Variants = {
  hidden: { height: 0, opacity: 0 },
  show: {
    height: 'auto',
    opacity: 1,
    transition: { height: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }, staggerChildren: 0.06, delayChildren: 0.14 },
  },
  exit: { height: 0, opacity: 0, transition: { duration: 0.3, ease: [0.4, 0, 1, 1] } },
}
const rowVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
}

export function DocumentFolder({ title = 'Documentos', documents, onSelect }: DocumentFolderProps) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const phase = open ? 'open' : hover ? 'hover' : 'rest'

  return (
    <div className="w-[300px] select-none">
      {/* ===== Carpeta (#1A1A1A, glass) ===== */}
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onHoverStart={() => setHover(true)}
        onHoverEnd={() => setHover(false)}
        aria-expanded={open}
        aria-label={open ? 'Cerrar carpeta' : 'Abrir carpeta de documentos'}
        whileTap={{ scale: 1.04 }}
        className="relative block w-full cursor-pointer rounded-[1.8rem] outline-none focus-visible:ring-[3px] focus-visible:ring-[#1a1a1a]/70 focus-visible:ring-offset-[6px] focus-visible:ring-offset-transparent"
      >
        <div style={{ perspective: 1200 }} className="relative h-[184px]">
          {/* Cara trasera */}
          <div
            className="absolute inset-0"
            style={{
              borderRadius: '1.8rem',
              border: `1px solid ${HL}`,
              backgroundColor: GLASS_BACK,
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: SHADOW,
              transform: 'translateZ(0)',
            }}
          />

          {/* Papeles */}
          <div className="pointer-events-none absolute inset-0 -top-[14px] z-10 flex items-center justify-center">
            {papers.map((p, i) => (
              <motion.div
                key={i}
                className="absolute aspect-[4/3] w-[84%] rounded-[1.4rem] border border-black/5 bg-white"
                style={{ zIndex: p.z, transformOrigin: 'bottom center', boxShadow: '0 6px 16px rgba(0,0,0,.14)' }}
                animate={p[phase]}
                transition={{ type: 'spring', stiffness: 200, damping: 30 }}
              />
            ))}
          </div>

          {/* Cara frontal (se abre) */}
          <motion.div
            className="absolute inset-0 z-20 origin-bottom"
            style={{ transformStyle: 'preserve-3d' }}
            animate={{ rotateX: open ? -54 : hover ? -30 : 0, y: open ? 16 : hover ? 12 : 0 }}
            transition={{ type: 'spring', stiffness: 160, damping: 20 }}
          >
            <div
              className="relative flex h-full w-full flex-col justify-end overflow-hidden p-6"
              style={{
                borderRadius: '1.8rem',
                border: '1px solid rgba(255,255,255,.16)',
                backgroundColor: GLASS_FRONT,
                backdropFilter: 'blur(32px)',
                WebkitBackdropFilter: 'blur(32px)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,.10)',
                transform: 'translateZ(0)',
              }}
            >
              {/* brillo interior */}
              <motion.div
                className="pointer-events-none absolute inset-0"
                style={{ borderRadius: '1.8rem', background: 'radial-gradient(circle at 50% 100%, #fff, transparent 68%)' }}
                animate={{ opacity: open || hover ? 0.14 : 0 }}
                transition={{ duration: 0.4 }}
              />

              {/* 3 puntos */}
              <motion.div
                className="absolute right-6 top-6 z-10 flex gap-1"
                animate={{ scale: hover ? 1.1 : 1 }}
                transition={{ duration: 0.25 }}
              >
                <span className="h-1 w-1 rounded-full bg-white/30" />
                <span className="h-1 w-1 rounded-full bg-white/30" />
                <span className="h-1 w-1 rounded-full bg-white/30" />
              </motion.div>

              {/* contenido: solo nombre + conteo en mono */}
              <div className="relative z-10">
                <h3 className="text-[19px] font-semibold tracking-[-0.03em] text-white">{title}</h3>
                <p className="mt-1 font-mono text-xs tracking-[0.01em] text-white/50 tabular-nums">
                  {documents.length} {documents.length === 1 ? 'archivo' : 'archivos'}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.button>

      {/* ===== Lista de documentos ===== */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            key="doclist"
            variants={listVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="mt-4 flex flex-col gap-2.5 overflow-hidden"
          >
            {documents.map((doc) => {
              const s = typeStyles[doc.type]
              const { Icon } = s
              return (
                <motion.li key={doc.id} variants={rowVariants}>
                  <button
                    type="button"
                    onClick={() => onSelect?.(doc)}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-[#edf0f6] bg-white px-3.5 py-3 text-left shadow-[0_3px_10px_rgba(30,40,80,.05)] transition hover:translate-x-[3px] hover:border-[#dde4f2] hover:bg-[#fbfcff]"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: s.bg, color: s.color }}>
                      <Icon size={20} strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold tracking-[-0.02em] text-[#1e2536]">{doc.name}</span>
                      <span className="mt-0.5 block font-mono text-[11.5px] text-[#98a1b6] tabular-nums">{doc.size}</span>
                    </span>
                    <ChevronRight size={18} className="ml-auto shrink-0 text-[#c2cad9] transition group-hover:translate-x-[3px] group-hover:text-[#5b647a]" />
                  </button>
                </motion.li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ---------- Ejemplo de uso ----------

import { DocumentFolder, type DocItem } from '@/components/document-folder'

const docs: DocItem[] = [
  { id: '1', name: 'Contrato de servicios.pdf', type: 'pdf', size: 'PDF · 2,4 MB' },
  { id: '2', name: 'Informe trimestral.docx',   type: 'doc', size: 'Word · 1,1 MB' },
  { id: '3', name: 'Presupuesto 2026.xlsx',      type: 'xls', size: 'Excel · 486 KB' },
  { id: '4', name: 'Portada campaña.png',        type: 'img', size: 'Imagen · 3,2 MB' },
  { id: '5', name: 'Notas de reunión.txt',       type: 'txt', size: 'Texto · 12 KB' },
]

<DocumentFolder documents={docs} onSelect={(d) => console.log(d)} />

Notas:
- El conteo usa `font-mono` (Tailwind). Si quieres una mono concreta (ej. Geist Mono
  o JetBrains Mono), configúrala en tu tema y `font-mono` la tomará.
- El glass necesita un fondo con color/degradado detrás para que el blur se note.

------------------------------------------- */
