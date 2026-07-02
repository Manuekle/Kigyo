import type { Ticket } from '../types'

export const TICKETS: Ticket[] = [
  { id: 1, title: 'Actualizar contrato de Felipe', area: 'Contratos', prio: 'Alta', st: 'En proceso', req: 'Valentina Torres', date: '2024-07-10', tags: ['legal', 'urgente'], assigned: 'Sara Jiménez' },
  { id: 2, title: 'Onboarding nueva diseñadora', area: 'Onboarding', prio: 'Alta', st: 'Pendiente', req: 'Andrés Morales', date: '2024-07-12', tags: ['rh'], assigned: 'Valentina Torres' },
  { id: 3, title: 'Gestionar permiso de maternidad', area: 'Permisos', prio: 'Alta', st: 'En proceso', req: 'Lucía Gómez', date: '2024-07-08', tags: ['permisos', 'legal'] },
  { id: 4, title: 'Revisar nómina junio', area: 'Nómina', prio: 'Media', st: 'Completado', req: 'Camila Restrepo', date: '2024-07-01', tags: ['nómina'], assigned: 'Valentina Torres' },
  { id: 5, title: 'Capacitación SGSST obligatoria', area: 'Capacitación', prio: 'Media', st: 'Pendiente', req: 'Valentina Torres', date: '2024-07-15', tags: ['capacitación'] },
  { id: 6, title: 'Actualizar organigrama', area: 'Administración', prio: 'Baja', st: 'Pendiente', req: 'Valentina Torres', date: '2024-07-18', tags: [] },
  { id: 7, title: 'Renovar seguro médico colectivo', area: 'Beneficios', prio: 'Alta', st: 'En proceso', req: 'Camila Restrepo', date: '2024-07-09', tags: ['beneficios'], assigned: 'Valentina Torres' },
  { id: 8, title: 'Proceso disciplinario Mateo', area: 'Disciplinario', prio: 'Alta', st: 'En proceso', req: 'Valentina Torres', date: '2024-07-11', tags: ['legal', 'urgente'], assigned: 'Sara Jiménez' },
  { id: 9, title: 'Encuesta clima laboral Q2', area: 'Clima', prio: 'Media', st: 'Completado', req: 'Valentina Torres', date: '2024-06-28', tags: ['clima'], assigned: 'Valentina Torres' },
  { id: 10, title: 'Revisión de evaluaciones de desempeño', area: 'Evaluación', prio: 'Media', st: 'Pendiente', req: 'Valentina Torres', date: '2024-07-20', tags: ['evaluación'] },
  { id: 11, title: 'Solicitud certificado laboral — Diego', area: 'Certificados', prio: 'Baja', st: 'Completado', req: 'Diego Vargas', date: '2024-07-06', tags: [], assigned: 'Valentina Torres' },
  { id: 12, title: 'Ajuste de beneficios alimentación', area: 'Beneficios', prio: 'Baja', st: 'Pendiente', req: 'Felipe Rodríguez', date: '2024-07-22', tags: ['beneficios'] },
]

export const RECLUT_STAGES = ['Aplicación', 'Revisión', 'Entrevista', 'Oferta', 'Contratado']

export const VACANTES = [
  { id: 1, rol: 'Desarrollador Full Stack', dept: 'Tecnología', tipo: 'Tiempo completo', st: 'Activo', apps: 14 },
  { id: 2, rol: 'Analista de Marketing Digital', dept: 'Marketing', tipo: 'Tiempo completo', st: 'Activo', apps: 8 },
  { id: 3, rol: 'Diseñador de Producto', dept: 'Diseño', tipo: 'Contrato', st: 'Activo', apps: 6 },
  { id: 4, rol: 'Ejecutivo de Cuentas', dept: 'Ventas', tipo: 'Tiempo completo', st: 'Pausado', apps: 3 },
]

export const CANDIDATOS = [
  { id: 1, name: 'Juan Pablo Castro', rol: 'Desarrollador Full Stack', stage: 'Entrevista', score: 88, src: 'LinkedIn' },
  { id: 2, name: 'María Alejandra Ríos', rol: 'Desarrollador Full Stack', stage: 'Revisión', score: 74, src: 'Referido' },
  { id: 3, name: 'Carlos Peña', rol: 'Analista de Marketing Digital', stage: 'Oferta', score: 91, src: 'LinkedIn' },
  { id: 4, name: 'Laura Ospina', rol: 'Diseñador de Producto', stage: 'Aplicación', score: 62, src: 'Indeed' },
  { id: 5, name: 'Sebastián Cano', rol: 'Desarrollador Full Stack', stage: 'Contratado', score: 95, src: 'Referido' },
  { id: 6, name: 'Isabela Méndez', rol: 'Ejecutivo de Cuentas', stage: 'Revisión', score: 70, src: 'LinkedIn' },
]

export const SALIDAS = [
  { id: 1, name: 'Pedro Álvarez', dept: 'Tecnología', motivo: 'Renuncia voluntaria', date: '2024-06-30' },
  { id: 2, name: 'Natalia Ruiz', dept: 'Ventas', motivo: 'Mutuo acuerdo', date: '2024-06-15' },
  { id: 3, name: 'Julián Arango', dept: 'Operaciones', motivo: 'Vencimiento contrato', date: '2024-05-31' },
  { id: 4, name: 'Mariana Duque', dept: 'Finanzas', motivo: 'Renuncia voluntaria', date: '2024-05-10' },
]

export const ROTACION_AREA = [
  { area: 'Tecnología', rate: 18, prev: 12 },
  { area: 'Ventas', rate: 24, prev: 28 },
  { area: 'Operaciones', rate: 15, prev: 16 },
  { area: 'Finanzas', rate: 8, prev: 7 },
  { area: 'Recursos Humanos', rate: 5, prev: 6 },
]
