import type { Documento, Consulta } from '../types'

export const DOCS: Documento[] = [
  { id: 1, name: 'Contrato Marco de Servicios 2024', type: 'Contrato', dept: 'Legal', date: '2024-01-15', st: 'Vigente', tags: ['legal', 'contrato'], owner: 'Sara Jiménez' },
  { id: 2, name: 'Política de Trabajo Remoto', type: 'Política', dept: 'Recursos Humanos', date: '2024-02-20', st: 'Vigente', tags: ['rh', 'política'], owner: 'Valentina Torres' },
  { id: 3, name: 'Plan Estratégico Q3 2024', type: 'Plan', dept: 'Dirección', date: '2024-06-30', st: 'Borrador', tags: ['estrategia'], owner: 'Valentina Torres', aiTag: true },
  { id: 4, name: 'Manual de Onboarding', type: 'Manual', dept: 'Recursos Humanos', date: '2024-03-10', st: 'Vigente', tags: ['rh', 'onboarding'], owner: 'Valentina Torres' },
  { id: 5, name: 'Acuerdo de Confidencialidad (NDA)', type: 'Contrato', dept: 'Legal', date: '2024-01-08', st: 'Vigente', tags: ['legal', 'nda'], owner: 'Sara Jiménez' },
  { id: 6, name: 'Reglamento Interno de Trabajo', type: 'Política', dept: 'Legal', date: '2023-11-01', st: 'Archivado', tags: ['legal', 'rh'], owner: 'Sara Jiménez', aiTag: true },
]

export const CONSULTAS: Consulta[] = [
  { id: 1, q: '¿Cuántos días de vacaciones me quedan?', cat: 'Vacaciones', r: 'Tienes 12 días de vacaciones disponibles según el saldo acumulado al 30 de junio de 2024.', fecha: '2024-07-10' },
  { id: 2, q: '¿Cómo solicito un permiso?', cat: 'Permisos', r: 'Puedes solicitar permisos desde el módulo de Asistencia › Solicitudes. Adjunta la documentación de soporte.', fecha: '2024-07-08' },
  { id: 3, q: '¿Cuál es la política de trabajo remoto?', cat: 'Políticas', r: 'La política permite hasta 3 días de trabajo remoto por semana para roles administrativos. Consulta el documento "Política de Trabajo Remoto" en Documentos.', fecha: '2024-07-05' },
  { id: 4, q: '¿Quién aprueba las solicitudes de vacaciones?', cat: 'Vacaciones', r: 'Las vacaciones son aprobadas por tu líder directo. Si tu líder es la Directora de RR.HH., la aprobación es automática en 48 horas.', fecha: '2024-07-03' },
]
