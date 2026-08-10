import type { NavSection } from '../types'

/**
 * The sidebar, grouped exactly like `MODULE_GROUPS` in lib/modules.ts.
 *
 * It used to be two groups — "Personas" and everything else under
 * "Operación" — which was tolerable at sixteen items and unusable at
 * thirty-five: commerce, collaboration and the sector modules all landed in
 * one column with no heading to navigate by.
 *
 * The grouping is now the same vocabulary the Configuración → Módulos screen
 * renders, so a module switched on in a group appears under that same heading
 * in the nav. Configuración is still absent on purpose: it is reached from the
 * user menu in the sidebar footer.
 *
 * Nothing here decides visibility. `Sidebar` filters every item through
 * `member.can(...)`, which folds together the plan, the org's enabled modules
 * and the role's permission — so a company that does not run a restaurant
 * never sees the heading its module would have sat under.
 */
export const NAV: NavSection[] = [
  {
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    ],
  },
  {
    label: 'Personas',
    items: [
      { key: 'empleados', label: 'Empleados', icon: 'Users' },
      { key: 'asistencia', label: 'Asistencia', icon: 'Clock' },
      { key: 'nomina', label: 'Nómina', icon: 'Wallet' },
      { key: 'riesgos', label: 'Centro de Riesgos', icon: 'ShieldAlert' },
      { key: 'reclutamiento', label: 'Reclutamiento', icon: 'UserSearch' },
      { key: 'capacitacion', label: 'Capacitación', icon: 'GraduationCap' },
      { key: 'desempeno', label: 'Desempeño', icon: 'Target' },
    ],
  },
  {
    label: 'Operación',
    items: [
      { key: 'proyectos', label: 'Proyectos', icon: 'Kanban' },
      { key: 'hseq', label: 'HSEQ', icon: 'ShieldCheck' },
      { key: 'inventario', label: 'Inventario', icon: 'Package' },
      { key: 'mantenimiento', label: 'Mantenimiento', icon: 'Wrench' },
      { key: 'flota', label: 'Flota', icon: 'Car' },
      { key: 'produccion', label: 'Producción', icon: 'Factory' },
      { key: 'trazabilidad', label: 'Trazabilidad', icon: 'Activity' },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { key: 'clientes', label: 'Clientes', icon: 'Building2' },
      { key: 'cotizaciones', label: 'Cotizaciones', icon: 'Receipt' },
      { key: 'facturacion', label: 'Facturación', icon: 'DollarSign' },
      { key: 'compras', label: 'Compras', icon: 'ShoppingCart' },
      { key: 'ordenes-compra', label: 'Órdenes Compra', icon: 'FileCheck2' },
      { key: 'catalogos', label: 'Catálogos', icon: 'Tag' },
      { key: 'tienda', label: 'Tienda Virtual', icon: 'LayoutGrid' },
      { key: 'ecommerce', label: 'Ecommerce', icon: 'Truck' },
    ],
  },
  {
    label: 'Colaboración',
    items: [
      { key: 'canales', label: 'Canales', icon: 'MessageSquare' },
      { key: 'tickets', label: 'Tickets', icon: 'Ticket' },
      { key: 'firmas', label: 'Firmas', icon: 'PenLine' },
      { key: 'documentos', label: 'Documentos', icon: 'FileText' },
      { key: 'contratos', label: 'Contratos', icon: 'Handshake' },
      { key: 'calendario', label: 'Calendario', icon: 'Calendar' },
      { key: 'consultoria', label: 'Consultoría', icon: 'BookOpen' },
      { key: 'ia', label: 'Asistente IA', icon: 'Sparkles' },
    ],
  },
  {
    label: 'Sectoriales',
    items: [
      { key: 'pacientes', label: 'Pacientes', icon: 'Stethoscope' },
      { key: 'estudiantes', label: 'Estudiantes', icon: 'School' },
      { key: 'restaurante', label: 'Restaurante', icon: 'Restaurant' },
      { key: 'agro', label: 'Agro', icon: 'Sprout' },
      { key: 'inmobiliario', label: 'Inmuebles', icon: 'Home' },
      { key: 'hoteleria', label: 'Hotelería', icon: 'Bed' },
    ],
  },
]

/** Page heading per route key. */
export const META: Record<string, string> = {
  dashboard: 'Dashboard',
  empleados: 'Empleados',
  asistencia: 'Asistencia',
  nomina: 'Nómina',
  riesgos: 'Centro de Riesgos',
  reclutamiento: 'Reclutamiento',
  capacitacion: 'Capacitación',
  desempeno: 'Desempeño',
  proyectos: 'Proyectos',
  hseq: 'HSEQ',
  inventario: 'Inventario',
  mantenimiento: 'Mantenimiento',
  flota: 'Flota',
  produccion: 'Producción',
  trazabilidad: 'Trazabilidad',
  clientes: 'Clientes',
  cotizaciones: 'Cotizaciones',
  facturacion: 'Facturación',
  compras: 'Compras',
  'ordenes-compra': 'Órdenes de Compra',
  catalogos: 'Catálogos',
  tienda: 'Tienda Virtual',
  ecommerce: 'Ecommerce',
  canales: 'Canales',
  tickets: 'Tickets',
  firmas: 'Firmas',
  documentos: 'Documentos',
  contratos: 'Contratos',
  calendario: 'Calendario',
  consultoria: 'Consultoría',
  ia: 'Asistente IA',
  pacientes: 'Pacientes',
  estudiantes: 'Estudiantes',
  restaurante: 'Restaurante',
  agro: 'Agro',
  inmobiliario: 'Inmuebles',
  hoteleria: 'Hotelería',
  configuracion: 'Configuración',
}

export const META_SUB: Record<string, string> = {
  dashboard: 'Resumen general de personas, documentos y actividad.',
  empleados: 'Directorio y gestión del equipo.',
  asistencia: 'Ausencias, incapacidades, horas extra y vacaciones.',
  nomina: 'Costo de nómina, beneficios y evolución salarial.',
  riesgos: 'Identificación y gestión de riesgos de personas, equipos y áreas.',
  reclutamiento: 'Vacantes abiertas, postulantes y avance del embudo de selección.',
  capacitacion: 'Cursos, inscripciones, asistencia y certificados del equipo.',
  desempeno: 'Ciclos de evaluación, objetivos y calificaciones por persona.',
  proyectos: 'Gestión de proyectos de instalación, mantenimiento y expansión.',
  hseq: 'Reportes de seguridad, calidad y ambiente con seguimiento de acciones correctivas.',
  inventario: 'Activos, pedidos de compra y facturación.',
  mantenimiento: 'Órdenes de trabajo preventivas y correctivas sobre equipos y activos.',
  flota: 'Vehículos, servicios, consumo de combustible y documentos por vencer.',
  produccion: 'Órdenes de producción, avance por etapa, rendimiento y merma.',
  trazabilidad: 'Registro de auditoría de toda la actividad.',
  clientes: 'Cuentas, contactos e historial de interacciones comerciales.',
  cotizaciones: 'Genera propuestas comerciales, seguimiento de clientes y pipeline.',
  facturacion: 'Facturas emitidas, pagos recibidos y cartera vencida.',
  compras: 'Solicitudes de compra, aprobaciones y órdenes en un solo lugar.',
  'ordenes-compra': 'Órdenes de compra generadas desde requisiciones aprobadas.',
  catalogos: 'Productos, precios, costos y specs del inventario técnico.',
  tienda: 'Catálogo de productos, precios y carrito virtual.',
  ecommerce: 'Pedidos en línea, estado de envío y cupones de la tienda pública.',
  canales: 'Conversaciones por canal, asignación de proyectos y comunicación del equipo.',
  tickets: 'Solicitudes de soporte por área: TI, Nómina, Personas, Finanzas y Legal.',
  firmas: 'Sube documentos y solicita firmas electrónicas.',
  documentos: 'Repositorio documental con análisis por IA.',
  contratos: 'Vigencias, renovaciones, hitos y valor de cada contrato.',
  calendario: 'Entrevistas, onboarding, 1:1s y sesiones de consultoría.',
  consultoria: 'Asesoría laboral y de cumplimiento.',
  ia: 'Chat inteligente con acceso a los datos de tu organización.',
  pacientes: 'Historia clínica, consultas y seguimiento asistencial.',
  estudiantes: 'Matrículas, programas académicos, asistencia y calificaciones.',
  restaurante: 'Menú, mesas y comandas del servicio en salón.',
  agro: 'Lotes, ciclos de cultivo, labores y cosechas por hectárea.',
  inmobiliario: 'Inmuebles, contratos de arriendo, inquilinos y recaudo mensual.',
  hoteleria: 'Habitaciones, reservas, ocupación y tarifas por noche.',
  configuracion: 'Preferencias de tu cuenta y de la organización.',
}

export const ROLES = ['Administrador', 'Líder de equipo', 'Empleado'] as const

/**
 * Nav key → route. The one copy.
 *
 * There were two, in Sidebar.tsx and CommandPalette.tsx, and they had already
 * drifted: the palette's was missing proyectos, cotizaciones, compras,
 * ordenes-compra, tienda, catalogos, hseq and canales, so searching for any
 * of those and hitting Enter dropped you on /dashboard through the `??`
 * fallback. A second list of routes is a second list to forget to update.
 */
export const ROUTE_MAP: Record<string, string> = {
  dashboard: '/dashboard',
  empleados: '/dashboard/empleados',
  asistencia: '/dashboard/asistencia',
  nomina: '/dashboard/nomina',
  riesgos: '/dashboard/riesgos',
  reclutamiento: '/dashboard/reclutamiento',
  capacitacion: '/dashboard/capacitacion',
  desempeno: '/dashboard/desempeno',
  proyectos: '/dashboard/proyectos',
  hseq: '/dashboard/hseq',
  inventario: '/dashboard/inventario',
  mantenimiento: '/dashboard/mantenimiento',
  flota: '/dashboard/flota',
  produccion: '/dashboard/produccion',
  trazabilidad: '/dashboard/trazabilidad',
  clientes: '/dashboard/clientes',
  cotizaciones: '/dashboard/cotizaciones',
  facturacion: '/dashboard/facturacion',
  compras: '/dashboard/compras',
  'ordenes-compra': '/dashboard/ordenes-compra',
  catalogos: '/dashboard/catalogos',
  tienda: '/dashboard/tienda',
  ecommerce: '/dashboard/ecommerce',
  canales: '/dashboard/canales',
  tickets: '/dashboard/tickets',
  firmas: '/dashboard/firmas',
  documentos: '/dashboard/documentos',
  contratos: '/dashboard/contratos',
  calendario: '/dashboard/calendario',
  consultoria: '/dashboard/consultoria',
  ia: '/dashboard/ia',
  pacientes: '/dashboard/pacientes',
  estudiantes: '/dashboard/estudiantes',
  restaurante: '/dashboard/restaurante',
  agro: '/dashboard/agro',
  inmobiliario: '/dashboard/inmobiliario',
  hoteleria: '/dashboard/hoteleria',
  configuracion: '/dashboard/configuracion',
}
