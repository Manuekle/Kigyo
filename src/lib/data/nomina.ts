import type { NominaArea, Beneficio } from '../types'

export const NOMINA_AREA: NominaArea[] = [
  { area: 'Ingeniería', total: 62000000, emp: 2, avg: 31000000 },
  { area: 'Comercial', total: 24000000, emp: 1, avg: 24000000 },
  { area: 'Finanzas', total: 22000000, emp: 1, avg: 22000000 },
  { area: 'Recursos Humanos', total: 36000000, emp: 2, avg: 18000000 },
  { area: 'Obras', total: 18000000, emp: 1, avg: 18000000 },
  { area: 'Legal', total: 15000000, emp: 1, avg: 15000000 },
]

export const NOMINA_HIST = [178, 182, 184, 188, 191, 184]

export const BENEFICIOS: Beneficio[] = [
  { id: 1, name: 'Seguro de Salud Colectivo', tipo: 'Salud', costo: 2800000, cov: 8 },
  { id: 2, name: 'Auxilio de Alimentación', tipo: 'Alimentación', costo: 600000, cov: 8 },
  { id: 3, name: 'Seguro de Vida', tipo: 'Seguro', costo: 420000, cov: 8 },
]

export const EVALUACIONES = [
  { id: 1, name: 'Valentina Torres', evaluator: 'Junta Directiva', score: 4.8, date: '2024-07-01', st: 'Completado' },
  { id: 2, name: 'Andrés Morales', evaluator: 'Valentina Torres', score: 4.6, date: '2024-07-02', st: 'Completado' },
  { id: 3, name: 'Diego Vargas', evaluator: 'Andrés Morales', score: 4.4, date: '2024-07-03', st: 'Completado' },
  { id: 4, name: 'Lucía Gómez', evaluator: 'Andrés Morales', score: 4.1, date: '2024-07-05', st: 'Completado' },
  { id: 5, name: 'Mateo Herrera', evaluator: 'Valentina Torres', score: 2.8, date: '2024-07-10', st: 'En revisión' },
]
