import type { Curso, Certificacion, Encuesta } from '../types'

export const CURSOS: Curso[] = [
  { id: 1, name: 'Liderazgo Transformacional', cat: 'Liderazgo', dur: '12h', enrolled: 4, comp: 2 },
  { id: 2, name: 'Excel Avanzado & Power BI', cat: 'Datos', dur: '8h', enrolled: 6, comp: 5 },
  { id: 3, name: 'SGSST — Actualización 2024', cat: 'Seguridad', dur: '4h', enrolled: 8, comp: 3 },
  { id: 4, name: 'Comunicación Asertiva', cat: 'Habilidades', dur: '6h', enrolled: 5, comp: 4 },
]

export const CERTIFICACIONES: Certificacion[] = [
  { id: 1, name: 'SHRM-CP', provider: 'SHRM', emp: 'Valentina Torres', date: '2025-03-15' },
  { id: 2, name: 'AWS Solutions Architect', provider: 'Amazon', emp: 'Andrés Morales', date: '2024-11-30' },
  { id: 3, name: 'NIIF — IFRS Foundation', provider: 'ACCA', emp: 'Camila Restrepo', date: '2024-10-01' },
]

export const ENPS_HIST = [38, 41, 44, 40, 46, 49]

export const ENCUESTAS: Encuesta[] = [
  { id: 1, name: 'eNPS Q2 2024', resp: 7, score: 49, date: '2024-06-28' },
  { id: 2, name: 'Clima Laboral Jun 2024', resp: 8, score: 74, date: '2024-06-20' },
]

export const AREA_GRAD: Record<string, string> = {
  'Tecnología': 'linear-gradient(135deg,#3b82f6,#7c5cd6)',
  'Ventas': 'linear-gradient(135deg,#e5484d,#bf8410)',
  'Finanzas': 'linear-gradient(135deg,#bf8410,#1f9d63)',
  'Operaciones': 'linear-gradient(135deg,#1f9d63,#3b82f6)',
  'Recursos Humanos': 'linear-gradient(135deg,#e5484d,#7c5cd6)',
  'Legal': 'linear-gradient(135deg,#9494a0,#5d5d68)',
  'Diseño': 'linear-gradient(135deg,#7c5cd6,#e5484d)',
  'Marketing': 'linear-gradient(135deg,#3b82f6,#1f9d63)',
}

export const DEPT_GRAD: Record<string, string> = {
  'Tecnología': '#3b82f6',
  'Ventas': '#e5484d',
  'Finanzas': '#bf8410',
  'Operaciones': '#1f9d63',
  'Recursos Humanos': '#7c5cd6',
  'Legal': '#9494a0',
  'Diseño': '#7c5cd6',
  'Marketing': '#3b82f6',
}
