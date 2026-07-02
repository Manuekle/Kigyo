import type { StatusTone } from './types'
import * as XLSX from 'xlsx'

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

export function exportExcel(rows: Record<string, unknown>[], filename: string): void {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export function clsx(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export { clsx as cn }

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
