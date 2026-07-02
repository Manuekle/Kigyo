import type { Notif } from '../types'

export const ACTIVIDAD = [
  { mes: 'Feb', val: 68 }, { mes: 'Mar', val: 74 }, { mes: 'Abr', val: 71 },
  { mes: 'May', val: 80 }, { mes: 'Jun', val: 76 }, { mes: 'Jul', val: 84 },
]

export const EVENTOS = [
  {
    group: 'Hoy',
    items: [
      { icon: 'user-plus', txt: '<b>Sebastián Cano</b> fue contratado como Desarrollador Full Stack', time: '09:15', color: 'grn' },
      { icon: 'file-text', txt: '<b>Contrato indefinido</b> enviado a firma a Diego Vargas', time: '10:32', color: 'blu' },
      { icon: 'alert-triangle', txt: 'Riesgo <b>Alto</b> detectado en perfil de Mateo Herrera', time: '11:07', color: 'red' },
    ],
  },
  {
    group: 'Ayer',
    items: [
      { icon: 'star', txt: 'Evaluación de <b>Andrés Morales</b> completada — Score 4.6/5', time: '16:20', color: 'amb' },
      { icon: 'award', txt: '<b>Carlos Peña</b> recibió oferta para Analista de Marketing', time: '14:05', color: 'vio' },
      { icon: 'calendar', txt: 'Vacaciones de <b>Camila Restrepo</b> aprobadas (Jul 22–26)', time: '09:48', color: 'grn' },
    ],
  },
]

export const NOTIFS: Notif[] = [
  { icon: 'file-signature', tone: 'amb', title: '3 contratos pendientes de firma', body: 'Última acción hace 2 días', time: 'Hace 2h' },
  { icon: 'alert-triangle', tone: 'red', title: 'Riesgo alto: Mateo Herrera', body: 'Riesgo de rotación 82% — requiere acción', time: 'Hace 3h' },
  { icon: 'calendar', tone: 'blu', title: 'Reunión en 30 minutos', body: 'One-on-one con Diego Vargas — Virtual', time: 'Hace 5h' },
  { icon: 'check-circle', tone: 'grn', title: 'Nómina julio procesada', body: 'COP $191M — 8 empleados liquidados', time: 'Ayer' },
]

export const PERIODS = ['6M', '1A', 'YTD', 'Todo']

export const BENCH_AREAS = [
  { area: 'Tecnología', desempeno: 88, clima: 74, rotacion: 18, capacitacion: 92 },
  { area: 'Ventas', desempeno: 72, clima: 61, rotacion: 24, capacitacion: 68 },
  { area: 'Finanzas', desempeno: 84, clima: 80, rotacion: 8, capacitacion: 77 },
  { area: 'Operaciones', desempeno: 76, clima: 70, rotacion: 15, capacitacion: 80 },
  { area: 'Legal', desempeno: 90, clima: 85, rotacion: 5, capacitacion: 88 },
]

export const JOURNEY_STAGES = [
  { key: 'postulacion', label: 'Postulación', icon: 'send', color: 'b-blu', count: 14 },
  { key: 'revision', label: 'Revisión', icon: 'search', color: 'b-vio', count: 8 },
  { key: 'entrevista', label: 'Entrevista', icon: 'video', color: 'b-amb', count: 4 },
  { key: 'oferta', label: 'Oferta', icon: 'file-text', color: 'b-grn', count: 2 },
  { key: 'contratado', label: 'Contratado', icon: 'check-circle', color: 'b-red', count: 1 },
]
