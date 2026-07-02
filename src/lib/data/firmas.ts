import type { Firma } from '../types'

export const FIRMAS: Firma[] = [
  { id: 1, name: 'Contrato Indefinido — Diego Vargas', who: 'Diego Vargas', type: 'Contrato', st: 'Pendiente', date: '2024-07-10', days: 2 },
  { id: 2, name: 'Acuerdo de Confidencialidad — Lucía Gómez', who: 'Lucía Gómez', type: 'NDA', st: 'Firmado', date: '2024-07-08' },
  { id: 3, name: 'Adenda Salarial — Camila Restrepo', who: 'Camila Restrepo', type: 'Adenda', st: 'Pendiente', date: '2024-07-12', days: 4 },
  { id: 4, name: 'Política de Uso — Felipe Rodríguez', who: 'Felipe Rodríguez', type: 'Política', st: 'Firmado', date: '2024-07-05' },
  { id: 5, name: 'Carta de Terminación — Mateo Herrera', who: 'Mateo Herrera', type: 'Terminación', st: 'Pendiente', date: '2024-07-15', days: 7 },
]
