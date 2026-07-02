import type { NavSection } from '../types'

// Matches the original nucleo-rh.jsx NAV: ungrouped Dashboard, then two
// groups — "Personas" and "Operación". Configuración is NOT in the sidebar;
// it is reached from the user menu in the sidebar footer.
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
      { key: 'riesgos', label: 'Centro de Riesgos', icon: 'ShieldAlert', badge: 2, badgeTone: 'r' },
    ],
  },
  {
    label: 'Operación',
    items: [
      { key: 'proyectos', label: 'Proyectos', icon: 'Kanban', badge: 4, badgeTone: 'a' },
      { key: 'cotizaciones', label: 'Cotizaciones', icon: 'Receipt' },
      { key: 'compras', label: 'Compras', icon: 'ShoppingCart' },
      { key: 'ordenes-compra', label: 'Órdenes Compra', icon: 'FileCheck2' },
      { key: 'tienda', label: 'Tienda Virtual', icon: 'LayoutGrid' },
      { key: 'firmas', label: 'Firmas', icon: 'PenLine', badge: 3, badgeTone: 'a' },
      { key: 'catalogos', label: 'Catálogos', icon: 'Tag' },
      { key: 'inventario', label: 'Inventario', icon: 'Package' },
      { key: 'documentos', label: 'Documentos', icon: 'FileText' },
      { key: 'consultoria', label: 'Consultoría', icon: 'MessageSquare' },
      { key: 'hseq', label: 'HSEQ', icon: 'ShieldCheck', badge: 2, badgeTone: 'a' },
      { key: 'tickets', label: 'Tickets', icon: 'Ticket', badge: 5, badgeTone: 'a' },
      { key: 'canales', label: 'Canales', icon: 'MessageSquare', badge: 3, badgeTone: 'a' },
      { key: 'calendario', label: 'Calendario', icon: 'Calendar' },
      { key: 'trazabilidad', label: 'Trazabilidad', icon: 'Activity' },
      { key: 'ia', label: 'Asistente IA', icon: 'Sparkles' },
    ],
  },
]

// [title, subtitle] — mirrors the original META tuples. The subtitle is shown
// under each page heading (.psub).
export const META: Record<string, string> = {
  dashboard: 'Dashboard',
  empleados: 'Empleados',
  asistencia: 'Asistencia',
  nomina: 'Nómina',
  riesgos: 'Centro de Riesgos',
  proyectos: 'Proyectos',
  cotizaciones: 'Cotizaciones',
  compras: 'Compras',
  'ordenes-compra': 'Órdenes de Compra',
  tienda: 'Tienda Virtual',
  firmas: 'Firmas',
  catalogos: 'Catálogos',
  inventario: 'Inventario',
  documentos: 'Documentos',
  consultoria: 'Consultoría',
  hseq: 'HSEQ',
  tickets: 'Tickets',
  canales: 'Canales',
  calendario: 'Calendario',
  trazabilidad: 'Trazabilidad',
  ia: 'Asistente IA',
  configuracion: 'Configuración',
}

export const META_SUB: Record<string, string> = {
  dashboard: 'Resumen general de personas, documentos y actividad.',
  empleados: 'Directorio y gestión del equipo.',
  asistencia: 'Ausencias, incapacidades, horas extra y vacaciones.',
  nomina: 'Costo de nómina, beneficios y evolución salarial.',
  riesgos: 'Identificación y gestión de riesgos de personas, equipos y áreas.',
  proyectos: 'Gestión de proyectos de instalación, mantenimiento y expansión solar.',
  cotizaciones: 'Genera propuestas comerciales, seguimiento de clientes y pipeline.',
  compras: 'Solicitudes de compra, aprobaciones y órdenes en un solo lugar.',
  'ordenes-compra': 'Órdenes de compra generadas desde requisiciones aprobadas.',
  tienda: 'Catálogo de productos, precios y carrito virtual.',
  firmas: 'Sube documentos y solicita firmas electrónicas.',
  catalogos: 'Productos, precios, costos y specs del inventario técnico.',
  inventario: 'Activos, pedidos de compra y facturación.',
  documentos: 'Repositorio documental con análisis por IA.',
  consultoria: 'Asesoría laboral y de cumplimiento.',
  hseq: 'Reportes de seguridad, calidad y ambiente con seguimiento de acciones correctivas.',
  tickets: 'Solicitudes de soporte por área: TI, Nómina, Personas, Finanzas y Legal.',
  canales: 'Conversaciones por canal, asignación de proyectos y comunicación del equipo.',
  calendario: 'Entrevistas, onboarding, 1:1s y sesiones de consultoría.',
  trazabilidad: 'Registro de auditoría de toda la actividad.',
  ia: 'Chat inteligente con acceso a los datos de Whitebox.',
  configuracion: 'Preferencias de tu cuenta y de la organización.',
}

export const ROLES = ['Administrador', 'Líder de equipo', 'Empleado'] as const

export const PERMS_DEFAULT: Record<string, Record<string, boolean>> = {
  Administrador: {
    ver_empleados: true, editar_empleados: true,
    ver_firmas: true, gestionar_firmas: true,
    ver_nomina: true, gestionar_nomina: true,
    ver_inventario: true, gestionar_inventario: true,
    ver_documentos: true, gestionar_documentos: true,
    ver_tickets: true, gestionar_tickets: true,
    ver_riesgos: true,
    ver_ia: true,
    ver_configuracion: true, gestionar_configuracion: true,
  },
  'Líder de equipo': {
    ver_empleados: true, editar_empleados: false,
    ver_firmas: true, gestionar_firmas: false,
    ver_nomina: false, gestionar_nomina: false,
    ver_inventario: true, gestionar_inventario: false,
    ver_documentos: true, gestionar_documentos: false,
    ver_tickets: true, gestionar_tickets: true,
    ver_riesgos: true,
    ver_ia: true,
    ver_configuracion: false, gestionar_configuracion: false,
  },
  Empleado: {
    ver_empleados: true, editar_empleados: false,
    ver_firmas: false, gestionar_firmas: false,
    ver_nomina: false, gestionar_nomina: false,
    ver_inventario: false, gestionar_inventario: false,
    ver_documentos: true, gestionar_documentos: false,
    ver_tickets: true, gestionar_tickets: false,
    ver_riesgos: false,
    ver_ia: true,
    ver_configuracion: false, gestionar_configuracion: false,
  },
}
