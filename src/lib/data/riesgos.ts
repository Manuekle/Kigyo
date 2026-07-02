import type { Riesgo, HealthFactor, Recomendacion } from '../types'

export const RIESGOS_SEED: Riesgo[] = [
  { id: 1, tipo: 'Rotación', empleado: 'Mateo Herrera', area: 'Operaciones', sev: 'Alta', detalle: 'Bajo rendimiento y desconexión del equipo. Sin ascenso en 3 años.', accion: 'Reunión de seguimiento y plan de carrera' },
  { id: 2, tipo: 'Cumplimiento', empleado: 'Diego Vargas', area: 'Tecnología', sev: 'Media', detalle: 'Pendiente firma de NDA actualizado desde hace 45 días.', accion: 'Enviar recordatorio urgente' },
  { id: 3, tipo: 'Salud', empleado: 'Lucía Gómez', area: 'Diseño', sev: 'Media', detalle: 'Dos incapacidades en el último mes. Posible burnout.', accion: 'Revisión con programa de bienestar' },
  { id: 4, tipo: 'Rotación', empleado: 'Felipe Rodríguez', area: 'Ventas', sev: 'Media', detalle: 'No cumplió cuota Q2. Señales de desmotivación.', accion: 'Coaching y ajuste de objetivos' },
  { id: 5, tipo: 'Legal', empleado: 'Mateo Herrera', area: 'Operaciones', sev: 'Alta', detalle: 'Proceso disciplinario activo. Requiere documentación.', accion: 'Coordinar con área legal' },
  { id: 6, tipo: 'Desempeño', empleado: 'Sara Jiménez', area: 'Legal', sev: 'Baja', detalle: 'Sobrecarga de trabajo identificada en revisión Q2.', accion: 'Redistribuir tareas del equipo' },
  { id: 7, tipo: 'Sucesión', empleado: 'Valentina Torres', area: 'RR.HH.', sev: 'Alta', detalle: 'Rol crítico sin sucesor validado. Plan de contingencia necesario.', accion: 'Acelerar plan de sucesión' },
  { id: 8, tipo: 'Cumplimiento', empleado: 'Camila Restrepo', area: 'Finanzas', sev: 'Baja', detalle: 'Certificación NIIF por renovar en Q4.', accion: 'Inscribir en curso de actualización' },
  { id: 9, tipo: 'Desempeño', empleado: 'Andrés Morales', area: 'Tecnología', sev: 'Baja', detalle: 'Excelente desempeño. Posible headhunting externo.', accion: 'Proponer bono de retención' },
  { id: 10, tipo: 'Rotación', empleado: 'Lucía Gómez', area: 'Diseño', sev: 'Media', detalle: 'Recibió oferta de competidor hace 2 semanas.', accion: 'Revisar paquete de compensación' },
]

export const HEALTH_FACTORS: HealthFactor[] = [
  { nombre: 'Satisfacción general', score: 78, tone: 'grn' },
  { nombre: 'Liderazgo', score: 82, tone: 'grn' },
  { nombre: 'Balance vida-trabajo', score: 64, tone: 'amb' },
  { nombre: 'Compensación', score: 58, tone: 'amb' },
  { nombre: 'Desarrollo profesional', score: 71, tone: 'grn' },
  { nombre: 'Cultura organizacional', score: 85, tone: 'grn' },
]

export const RECOMENDACIONES_SEED: Recomendacion[] = [
  { id: 1, prioridad: 'Alta', cat: 'Retención', titulo: 'Plan de retención para Mateo Herrera', razon: 'Riesgo de rotación 82%. Costo de reemplazo estimado: COP $24M.', tone: 'red' },
  { id: 2, prioridad: 'Media', cat: 'Cumplimiento', titulo: 'Actualizar NDAs pendientes', razon: '3 empleados con acuerdos vencidos. Riesgo legal moderado.', tone: 'amb' },
  { id: 3, prioridad: 'Baja', cat: 'Desarrollo', titulo: 'Programa mentoring Tecnología', razon: 'Área con mayor potencial de crecimiento. 2 sucesores en formación.', tone: 'blu' },
]
