import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { StatusTone } from './types'

export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function tone(st: string): StatusTone {
  const map: Record<string, StatusTone> = {
    Activo: 'grn',
    Completado: 'grn',
    Aprobado: 'grn',
    Recibido: 'grn',
    Pagada: 'grn',
    Firmado: 'grn',
    Asignado: 'grn',
    Disponible: 'grn',
    Oferta: 'blu',
    'En revisión': 'blu',
    Pendiente: 'amb',
    'En proceso': 'amb',
    'En tránsito': 'amb',
    Borrador: 'amb',
    Entrevista: 'vio',
    Expirado: 'red',
    Rechazado: 'red',
    Cancelado: 'red',
    Inactivo: 'neu',
    Archivado: 'neu',
    Salida: 'neu',
    'En ejecución': 'blu',
    Finalizado: 'grn',
    'En pausa': 'amb',
    Planificación: 'neu',
  }
  return map[st] ?? 'neu'
}

export function prioTone(p: string): StatusTone {
  if (p === 'Alta') return 'red'
  if (p === 'Media') return 'amb'
  return 'grn'
}

export function cop(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)
}

/**
 * Builds the workbook on the server and downloads the result.
 *
 * This used to run `xlsx` in the browser. That package is abandoned on npm and
 * carries unfixed high-severity advisories, and building the file client-side
 * meant the export ran with no authorization check at all. The route now
 * verifies the caller's `<module>:read` permission, rate limits, and escapes
 * cells that would otherwise be interpreted as formulas by Excel.
 *
 * Throws on failure so callers can surface a toast.
 */
export async function exportExcel(
  rows: Record<string, unknown>[],
  filename: string,
  module: string,
): Promise<void> {
  const response = await fetch('/api/v1/export', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ module, filename, rows }),
  })

  if (!response.ok) {
    const problem = await response.json().catch(() => null)
    throw new Error(problem?.detail ?? 'No se pudo generar el archivo.')
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * Une clases y resuelve los choques de Tailwind.
 *
 * Antes era un `filter(Boolean).join(' ')`. Eso alcanza mientras las clases no
 * compitan, pero en cuanto un componente escribe
 * `cn('text-muted-foreground', activo && 'text-foreground')` las dos llegan
 * juntas al DOM y gana la que Tailwind haya emitido más abajo en la hoja, no
 * la que el componente quería. `twMerge` descarta la perdedora por grupo de
 * utilidad, que es lo que hace que el estado condicional se vea.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

const COLORS: Record<string, string> = {
  'Recursos Humanos': 'rgba(255,255,255,.72)',
  Tecnología: 'rgba(255,255,255,.65)',
  Finanzas: 'rgba(255,255,255,.55)',
  Operaciones: 'rgba(255,255,255,.60)',
  Marketing: 'rgba(255,255,255,.50)',
  Legal: 'rgba(255,255,255,.45)',
  Diseño: 'rgba(255,255,255,.72)',
  Ventas: 'rgba(255,255,255,.65)',
}

export function deptColor(dept: string): string {
  return COLORS[dept] ?? 'rgba(255,255,255,.45)'
}
