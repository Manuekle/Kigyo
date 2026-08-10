/**
 * Which modules an organization actually uses, and the company sector that
 * proposes a starting set.
 *
 * Kigyo ships thirty-five modules spanning five very different jobs: people
 * (empleados, nómina, reclutamiento), field operations (proyectos, HSEQ,
 * mantenimiento), commerce (clientes, facturación, tienda), collaboration
 * (canales, tickets, firmas) and one module per industry that needs its own
 * vocabulary (pacientes, estudiantes, restaurante…). No single customer wants
 * all of them. A consultancy has no warehouse; a retailer runs no HSEQ
 * programme; a clinic has patients and a school has students and neither has
 * the other.
 *
 * Three questions decide whether a module is visible, and they are kept apart
 * because they have three different answers and three different fixes:
 *
 *   · `plan`             — did this company buy it?   Org-wide, see lib/plans.ts
 *   · `enabled_modules`  — does it use it?            Org-wide, admin toggles
 *   · `role_permissions` — may this person open it?   Per role
 *
 * A module is visible only when all three say yes, and they are checked
 * outermost first, so the refusal names the gate that actually stopped you.
 *
 * Module keys are the same vocabulary as the `<module>` half of a permission
 * key (`proyectos:read` → `proyectos`), so the route guard can derive the
 * module it needs without a third mapping to keep in sync.
 */

import type { Tables } from '@/lib/supabase/types'

/**
 * The keys the `organizations.company_type` check constraint accepts.
 *
 * Taken from the generated database types rather than declared here, so the
 * list below and the constraint cannot drift: adding a sector in one place and
 * not the other stops compiling instead of failing on the INSERT.
 */
export type CompanyTypeKey = NonNullable<Tables<'organizations'>['company_type']>

export const MODULE_GROUPS = [
  'Personas', 'Operación', 'Comercial', 'Colaboración', 'Sectoriales',
] as const
export type ModuleGroup = (typeof MODULE_GROUPS)[number]

export interface ModuleDef {
  key: string
  label: string
  /** One line, written for an administrator deciding whether to switch it on. */
  description: string
  group: ModuleGroup
}

/**
 * `dashboard` and `configuracion` are deliberately absent: they are the shell,
 * not modules. Configuración especially — switching it off would remove the
 * only screen that can switch it back on.
 *
 * The `Sectoriales` group is not "advanced" or "extra". Those modules are the
 * *main* screen for the companies they were built for: a clinic lives in
 * `pacientes` the way a builder lives in `proyectos`. They are grouped apart
 * only because every one of them is noise to everybody else.
 */
export const MODULES: ModuleDef[] = [
  { key: 'empleados', label: 'Empleados', description: 'Directorio del equipo, perfiles y organigrama.', group: 'Personas' },
  { key: 'asistencia', label: 'Asistencia', description: 'Ausencias, incapacidades, horas extra y vacaciones.', group: 'Personas' },
  { key: 'nomina', label: 'Nómina', description: 'Costo de nómina, desprendibles y evolución salarial.', group: 'Personas' },
  { key: 'riesgos', label: 'Centro de Riesgos', description: 'Riesgos de personas, equipos y áreas con seguimiento.', group: 'Personas' },
  { key: 'reclutamiento', label: 'Reclutamiento', description: 'Vacantes, postulantes y el embudo de selección.', group: 'Personas' },
  { key: 'capacitacion', label: 'Capacitación', description: 'Cursos, inscripciones y certificados del equipo.', group: 'Personas' },
  { key: 'desempeno', label: 'Desempeño', description: 'Ciclos de evaluación, objetivos y calificaciones.', group: 'Personas' },

  { key: 'proyectos', label: 'Proyectos', description: 'Obras y trabajos en campo con estado, cliente y presupuesto.', group: 'Operación' },
  { key: 'hseq', label: 'HSEQ', description: 'Seguridad, calidad y ambiente con acciones correctivas.', group: 'Operación' },
  { key: 'inventario', label: 'Inventario', description: 'Activos y existencias con asignación por persona.', group: 'Operación' },
  { key: 'mantenimiento', label: 'Mantenimiento', description: 'Órdenes de trabajo preventivas y correctivas sobre equipos.', group: 'Operación' },
  { key: 'flota', label: 'Flota', description: 'Vehículos, servicios, combustible y documentos por vencer.', group: 'Operación' },
  { key: 'produccion', label: 'Producción', description: 'Órdenes de producción, avance por etapa y merma.', group: 'Operación' },
  { key: 'trazabilidad', label: 'Trazabilidad', description: 'Registro de auditoría de toda la actividad de la cuenta.', group: 'Operación' },

  { key: 'clientes', label: 'Clientes', description: 'Cuentas, contactos e interacciones comerciales.', group: 'Comercial' },
  { key: 'cotizaciones', label: 'Cotizaciones', description: 'Propuestas comerciales, seguimiento y pipeline.', group: 'Comercial' },
  { key: 'facturacion', label: 'Facturación', description: 'Facturas, pagos recibidos y cartera vencida.', group: 'Comercial' },
  { key: 'compras', label: 'Compras y órdenes', description: 'Requisiciones, aprobaciones y órdenes de compra.', group: 'Comercial' },
  { key: 'catalogos', label: 'Catálogos', description: 'Productos, precios, costos y fichas técnicas.', group: 'Comercial' },
  { key: 'tienda', label: 'Tienda virtual', description: 'Catálogo de venta con carrito y generación de pedido.', group: 'Comercial' },
  { key: 'ecommerce', label: 'Ecommerce', description: 'Pedidos en línea, envíos y cupones de la tienda pública.', group: 'Comercial' },

  { key: 'canales', label: 'Canales', description: 'Conversaciones del equipo por tema, obra o área.', group: 'Colaboración' },
  { key: 'tickets', label: 'Tickets', description: 'Solicitudes internas por área: TI, Nómina, Personas, Legal.', group: 'Colaboración' },
  { key: 'firmas', label: 'Firmas', description: 'Envío de documentos a firma electrónica y su seguimiento.', group: 'Colaboración' },
  { key: 'documentos', label: 'Documentos', description: 'Repositorio documental con análisis por IA.', group: 'Colaboración' },
  { key: 'contratos', label: 'Contratos', description: 'Vigencias, renovaciones y hitos de cada contrato.', group: 'Colaboración' },
  { key: 'calendario', label: 'Calendario', description: 'Entrevistas, onboarding, 1:1s y sesiones de consultoría.', group: 'Colaboración' },
  { key: 'consultoria', label: 'Consultoría', description: 'Asesoría laboral y de cumplimiento.', group: 'Colaboración' },
  { key: 'ia', label: 'Asistente de IA', description: 'Consulta en lenguaje natural sobre los datos de la cuenta.', group: 'Colaboración' },

  { key: 'pacientes', label: 'Pacientes', description: 'Historia clínica, consultas y seguimiento asistencial.', group: 'Sectoriales' },
  { key: 'estudiantes', label: 'Estudiantes', description: 'Matrículas, programas académicos y calificaciones.', group: 'Sectoriales' },
  { key: 'restaurante', label: 'Restaurante', description: 'Menú, mesas y comandas del servicio en salón.', group: 'Sectoriales' },
  { key: 'agro', label: 'Agro', description: 'Lotes, ciclos de cultivo y cosechas por hectárea.', group: 'Sectoriales' },
  { key: 'inmobiliario', label: 'Inmobiliario', description: 'Inmuebles, contratos de arriendo y recaudo mensual.', group: 'Sectoriales' },
  { key: 'hoteleria', label: 'Hotelería', description: 'Habitaciones, reservas y ocupación por noche.', group: 'Sectoriales' },
]

export const MODULE_KEYS: string[] = MODULES.map((m) => m.key)

/** Always on. Not offered as a toggle, and never filtered out of the nav. */
export const CORE_MODULES = ['dashboard', 'configuracion'] as const

export function isModuleKey(value: string): boolean {
  return MODULE_KEYS.includes(value)
}

export function moduleDef(key: string): ModuleDef | null {
  return MODULES.find((m) => m.key === key) ?? null
}

export interface CompanyTypeDef {
  key: CompanyTypeKey
  label: string
  /** How an administrator recognises their own company in the list. */
  description: string
  modules: string[]
}

/**
 * Starting sets, not cages. Picking a sector replaces the current selection
 * with its preset; every module stays individually switchable afterwards,
 * because the sector is a guess about the company and the toggles are the
 * company's own answer.
 */
const PEOPLE = ['empleados', 'asistencia', 'nomina']
const SPINE = ['canales', 'documentos', 'calendario', 'ia']
/** "Who buys from us, what did we promise, did they pay." Nearly universal. */
const COMMERCIAL = ['clientes', 'cotizaciones', 'facturacion']

/**
 * Presets lean *under*, not over.
 *
 * A preset that leaves thirty of thirty-five modules on has not made a
 * decision — it has restated the old behaviour with extra steps, and the
 * administrator still has to switch two dozen things off by hand. `tienda`,
 * `ecommerce` and `trazabilidad` in particular are deliberately absent almost
 * everywhere: selling to the public is a business model, not a default, and
 * the audit log is the kind of thing an organization should turn on knowingly.
 *
 * Turning a module on later costs one click. Turning twenty off costs twenty,
 * and most people will not bother — they will just live with a cluttered nav,
 * which is the problem this was built to fix.
 *
 * A sector's own vertical module always appears in its preset and in nobody
 * else's. That is the whole reason the vertical exists.
 */
export const COMPANY_TYPES: CompanyTypeDef[] = [
  {
    key: 'construccion',
    label: 'Construcción e infraestructura',
    description: 'Obra civil, montajes, instalaciones. Trabajo por proyecto en sitio.',
    modules: [...PEOPLE, 'riesgos', 'proyectos', 'hseq', 'inventario', 'mantenimiento', ...COMMERCIAL, 'compras', 'contratos', 'firmas', 'tickets', ...SPINE],
  },
  {
    key: 'energia',
    label: 'Energía y renovables',
    description: 'Solar, eólica, eficiencia energética. Instalación y mantenimiento.',
    modules: [...PEOPLE, 'riesgos', 'proyectos', 'hseq', 'inventario', 'mantenimiento', ...COMMERCIAL, 'compras', 'catalogos', 'contratos', 'firmas', 'tickets', ...SPINE],
  },
  {
    key: 'manufactura',
    label: 'Manufactura y producción',
    description: 'Planta propia, línea de producción, control de existencias.',
    modules: [...PEOPLE, 'riesgos', 'hseq', 'inventario', 'produccion', 'mantenimiento', ...COMMERCIAL, 'catalogos', 'compras', 'firmas', 'tickets', ...SPINE],
  },
  {
    key: 'comercio',
    label: 'Comercio y retail',
    description: 'Venta de producto, punto físico o en línea. Sin obra en campo.',
    modules: [...PEOPLE, 'inventario', 'catalogos', 'tienda', ...COMMERCIAL, 'compras', 'tickets', ...SPINE],
  },
  {
    key: 'ecommerce',
    label: 'Ecommerce y venta en línea',
    description: 'Tienda pública, pedidos por internet, despacho y devoluciones.',
    modules: [...PEOPLE, 'inventario', 'catalogos', 'tienda', 'ecommerce', ...COMMERCIAL, 'compras', 'tickets', ...SPINE],
  },
  {
    key: 'servicios',
    label: 'Servicios profesionales',
    description: 'Consultoría, contabilidad, legal, agencias. Se factura tiempo.',
    modules: [...PEOPLE, 'proyectos', ...COMMERCIAL, 'contratos', 'firmas', 'tickets', 'consultoria', ...SPINE],
  },
  {
    key: 'tecnologia',
    label: 'Tecnología y software',
    description: 'Producto digital o desarrollo a la medida.',
    modules: [...PEOPLE, 'proyectos', ...COMMERCIAL, 'contratos', 'reclutamiento', 'desempeno', 'tickets', ...SPINE],
  },
  {
    key: 'salud',
    label: 'Salud',
    description: 'IPS, consultorios, laboratorios. Pacientes, turnos y cumplimiento.',
    modules: [...PEOPLE, 'pacientes', 'riesgos', 'hseq', 'inventario', 'facturacion', 'clientes', 'firmas', 'tickets', 'consultoria', 'trazabilidad', ...SPINE],
  },
  {
    key: 'educacion',
    label: 'Educación',
    description: 'Colegios, institutos y academias. Matrículas y notas.',
    modules: [...PEOPLE, 'estudiantes', 'capacitacion', 'facturacion', 'clientes', 'inventario', 'firmas', 'contratos', 'tickets', ...SPINE],
  },
  {
    key: 'logistica',
    label: 'Logística y transporte',
    description: 'Flota, bodega, distribución.',
    modules: [...PEOPLE, 'riesgos', 'hseq', 'inventario', 'flota', 'mantenimiento', ...COMMERCIAL, 'compras', 'catalogos', 'tickets', ...SPINE],
  },
  {
    key: 'alimentos',
    label: 'Restaurantes y alimentos',
    description: 'Restaurantes, bares, catering y producción de alimentos.',
    modules: [...PEOPLE, 'restaurante', 'inventario', 'catalogos', 'compras', 'hseq', 'facturacion', 'tickets', ...SPINE],
  },
  {
    key: 'agro',
    label: 'Agro y agroindustria',
    description: 'Cultivos, fincas, ciclos productivos y cosecha.',
    modules: [...PEOPLE, 'agro', 'inventario', 'mantenimiento', 'flota', 'hseq', 'riesgos', ...COMMERCIAL, 'compras', 'tickets', ...SPINE],
  },
  {
    key: 'inmobiliario',
    label: 'Inmobiliario',
    description: 'Arriendo y administración de inmuebles, propiedad horizontal.',
    modules: [...PEOPLE, 'inmobiliario', 'contratos', ...COMMERCIAL, 'mantenimiento', 'firmas', 'tickets', ...SPINE],
  },
  {
    key: 'hoteleria',
    label: 'Hotelería y turismo',
    description: 'Hoteles, hostales y operadores turísticos. Reservas y ocupación.',
    modules: [...PEOPLE, 'hoteleria', 'restaurante', 'inventario', 'mantenimiento', 'facturacion', 'clientes', 'tickets', ...SPINE],
  },
  {
    key: 'financiero',
    label: 'Financiero y seguros',
    description: 'Cooperativas, corredoras, fintech. Cartera y cumplimiento.',
    modules: [...PEOPLE, ...COMMERCIAL, 'contratos', 'riesgos', 'firmas', 'trazabilidad', 'desempeno', 'tickets', 'consultoria', ...SPINE],
  },
  {
    key: 'mineria',
    label: 'Minería y extractivas',
    description: 'Operación en frente de trabajo, equipo pesado, alto riesgo.',
    modules: [...PEOPLE, 'riesgos', 'hseq', 'proyectos', 'inventario', 'mantenimiento', 'flota', 'compras', 'contratos', 'firmas', 'trazabilidad', 'tickets', ...SPINE],
  },
  {
    key: 'telecomunicaciones',
    label: 'Telecomunicaciones',
    description: 'Redes, instalación y soporte a suscriptores.',
    modules: [...PEOPLE, 'proyectos', 'inventario', 'mantenimiento', 'flota', ...COMMERCIAL, 'contratos', 'tickets', ...SPINE],
  },
  {
    key: 'seguridad',
    label: 'Seguridad y vigilancia',
    description: 'Empresas de vigilancia y control. Turnos, puestos y dotación.',
    modules: [...PEOPLE, 'riesgos', 'hseq', 'inventario', 'contratos', ...COMMERCIAL, 'firmas', 'capacitacion', 'tickets', 'trazabilidad', ...SPINE],
  },
  {
    key: 'medios',
    label: 'Medios y publicidad',
    description: 'Agencias, productoras y medios. Trabajo por campaña.',
    modules: [...PEOPLE, 'proyectos', ...COMMERCIAL, 'contratos', 'inventario', 'firmas', 'tickets', ...SPINE],
  },
  {
    key: 'ong',
    label: 'ONG y fundaciones',
    description: 'Sin ánimo de lucro. Proyectos, donantes y rendición de cuentas.',
    modules: [...PEOPLE, 'proyectos', 'clientes', 'contratos', 'capacitacion', 'firmas', 'trazabilidad', 'tickets', ...SPINE],
  },
  {
    key: 'gobierno',
    label: 'Sector público',
    description: 'Entidades y contratistas del Estado. Trazabilidad obligatoria.',
    modules: [...PEOPLE, 'proyectos', 'contratos', 'compras', 'firmas', 'hseq', 'riesgos', 'trazabilidad', 'tickets', ...SPINE],
  },
  {
    key: 'otro',
    label: 'Otro',
    description: 'Empieza con lo esencial y activa el resto a mano.',
    modules: [...PEOPLE, 'clientes', 'firmas', 'tickets', ...SPINE],
  },
]

export const COMPANY_TYPE_KEYS: CompanyTypeKey[] = COMPANY_TYPES.map((t) => t.key)

/** A type predicate, so a validated form value narrows to what the column takes. */
export function isCompanyType(value: string): value is CompanyTypeKey {
  return (COMPANY_TYPE_KEYS as string[]).includes(value)
}

export function companyType(key: string | null): CompanyTypeDef | null {
  if (!key) return null
  return COMPANY_TYPES.find((t) => t.key === key) ?? null
}

/** The preset for a company type, or every module when the type is unknown. */
export function presetFor(key: string | null): string[] {
  return companyType(key)?.modules ?? [...MODULE_KEYS]
}

/**
 * What an organization has switched on.
 *
 * An empty column means "never configured" rather than "everything off" —
 * every account created before this existed has one, and none of them should
 * wake up to an empty sidebar. Those fall back to the company type's preset,
 * and to the full set when there is no type either.
 *
 * `allowed` is the plan's allowlist, passed in rather than imported so this
 * module stays free of a dependency on lib/plans.ts — which imports
 * MODULE_KEYS from here, and a cycle between the access catalogue and the
 * billing catalogue is a load-order bug waiting to happen. Omitting it means
 * "no plan gate", which is what the pure catalogue tests want.
 */
export function resolveModules(
  enabled: readonly string[] | null | undefined,
  type: string | null,
  allowed?: ReadonlySet<string>,
): Set<string> {
  const list = enabled && enabled.length > 0 ? enabled : presetFor(type)
  const usable = list.filter((key) => isModuleKey(key) && (!allowed || allowed.has(key)))
  // Core modules are added after the filter on purpose: they are the shell, so
  // no plan and no selection can remove them. An account whose plan excludes
  // everything it had switched on still lands on a working dashboard and a
  // configuración screen that explains why.
  return new Set([...CORE_MODULES, ...usable])
}

/** Groups the catalog for rendering, preserving MODULE_GROUPS order. */
export function modulesByGroup(): Array<{ group: ModuleGroup; modules: ModuleDef[] }> {
  return MODULE_GROUPS.map((group) => ({
    group,
    modules: MODULES.filter((m) => m.group === group),
  }))
}
