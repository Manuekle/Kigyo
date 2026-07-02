import type { Meeting, Ausencia, Vacacion } from '../types'

export const MEETINGS: Meeting[] = [
  { id: 1, title: 'Revisión Q3 Budget', type: 'Interna', day: '2024-07-15', time: '09:00', dur: '1h', with: ['Camila Restrepo', 'Valentina Torres'], loc: 'Sala A' },
  { id: 2, title: 'One-on-one Diego', type: '1:1', day: '2024-07-15', time: '11:00', dur: '30m', with: ['Diego Vargas'], loc: 'Virtual' },
  { id: 3, title: 'Entrevista Juan Pablo Castro', type: 'Reclutamiento', day: '2024-07-16', time: '14:00', dur: '1h', with: ['Juan Pablo Castro'], loc: 'Virtual' },
  { id: 4, title: 'Stand-up Tecnología', type: 'Interna', day: '2024-07-17', time: '09:30', dur: '15m', with: ['Andrés Morales', 'Diego Vargas'], loc: 'Virtual' },
  { id: 5, title: 'Presentación beneficios', type: 'Interna', day: '2024-07-18', time: '10:00', dur: '2h', with: ['Todos'], loc: 'Auditorio' },
  { id: 6, title: 'Revisión disciplinaria Mateo', type: 'Confidencial', day: '2024-07-19', time: '16:00', dur: '1h', with: ['Mateo Herrera', 'Sara Jiménez'], loc: 'Sala B' },
  { id: 7, title: 'Cierre nómina julio', type: 'Interna', day: '2024-07-22', time: '08:00', dur: '30m', with: ['Camila Restrepo'], loc: 'Sala A' },
  { id: 8, title: 'Kick-off plan capacitación H2', type: 'Interna', day: '2024-07-24', time: '09:00', dur: '1.5h', with: ['Todos los líderes'], loc: 'Sala A' },
]

export const AUSENCIAS: Ausencia[] = [
  { id: 1, name: 'Lucía Gómez', type: 'Incapacidad', from: '2024-07-08', to: '2024-07-12', days: 5, st: 'Aprobado' },
  { id: 2, name: 'Felipe Rodríguez', type: 'Permiso personal', from: '2024-07-15', to: '2024-07-15', days: 1, st: 'Aprobado' },
  { id: 3, name: 'Mateo Herrera', type: 'Suspensión', from: '2024-07-18', to: '2024-07-19', days: 2, st: 'Pendiente' },
  { id: 4, name: 'Camila Restrepo', type: 'Cita médica', from: '2024-07-22', to: '2024-07-22', days: 1, st: 'Aprobado' },
]

export const VACACIONES: Vacacion[] = [
  { id: 1, name: 'Valentina Torres', from: '2024-08-05', to: '2024-08-16', days: 10, st: 'Aprobado', saldo: 2 },
  { id: 2, name: 'Andrés Morales', from: '2024-08-19', to: '2024-08-30', days: 10, st: 'Aprobado', saldo: 5 },
  { id: 3, name: 'Diego Vargas', from: '2024-09-02', to: '2024-09-13', days: 10, st: 'Pendiente', saldo: 12 },
  { id: 4, name: 'Camila Restrepo', from: '2024-07-22', to: '2024-07-26', days: 5, st: 'Aprobado', saldo: 7 },
  { id: 5, name: 'Lucía Gómez', from: '2024-10-01', to: '2024-10-11', days: 10, st: 'Pendiente', saldo: 10 },
  { id: 6, name: 'Felipe Rodríguez', from: '2024-12-23', to: '2025-01-03', days: 10, st: 'Pendiente', saldo: 15 },
]

export const HEATMAP_JUNE = Array.from({ length: 35 }, (_, i) => {
  const dayOfMonth = i - 5
  if (dayOfMonth < 1 || dayOfMonth > 30) return { day: 0, level: 0 as const, val: 0, empty: true }
  const level = (Math.floor(Math.random() * 5)) as 0 | 1 | 2 | 3 | 4
  return { day: dayOfMonth, level, val: level * 2 + Math.floor(Math.random() * 2), empty: false }
})
