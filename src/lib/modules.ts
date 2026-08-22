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
import {
  CORE_MODULES as CORE,
  MODULE_GROUPS as GROUPS,
  REGISTRY,
  type ModuleEntry,
  type ModuleGroup,
} from '@/lib/modules/registry'

/**
 * The keys the `organizations.company_type` check constraint accepts.
 *
 * Taken from the generated database types rather than declared here, so the
 * list below and the constraint cannot drift: adding a sector in one place and
 * not the other stops compiling instead of failing on the INSERT.
 */
export type CompanyTypeKey = NonNullable<Tables<'organizations'>['company_type']>

export { MODULE_GROUPS, CORE_MODULES } from '@/lib/modules/registry'
export type { ModuleGroup } from '@/lib/modules/registry'

/**
 * A switchable module.
 *
 * The registry's entry, narrowed: `group` is non-null here, which is exactly
 * what makes it switchable. `dashboard` and `configuracion` are the shell and
 * are filtered out below, so nothing that iterates `MODULES` has to remember to
 * skip them.
 */
export type ModuleDef = ModuleEntry & { group: ModuleGroup }

/**
 * The catalogue, from the registry.
 *
 * `dashboard` and `configuracion` are deliberately absent: they are the shell,
 * not modules. Configuración especially — switching it off would remove the
 * only screen that can switch it back on. That is expressed as `group === null`
 * in the registry rather than as a second list here, so the two cannot disagree
 * about what is switchable.
 *
 * The `Sectoriales` group is not "advanced" or "extra". Those modules are the
 * *main* screen for the companies they were built for: a clinic lives in
 * `pacientes` the way a builder lives in `proyectos`. They are grouped apart
 * only because every one of them is noise to everybody else.
 */
export const MODULES: ModuleDef[] = REGISTRY.filter(
  (m): m is ModuleDef => m.group !== null,
)

export const MODULE_KEYS: string[] = MODULES.map((m) => m.key)

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
  /**
   * The module this sector exists for, when it has one.
   *
   * Stated rather than derived, because the two vocabularies do not line up:
   * `salud` runs on `pacientes`, `alimentos` on `restaurante`, `educacion` on
   * `estudiantes`. Only four of the seven happen to share a name, which is
   * exactly enough for `key === key` to look correct in a spot check and be
   * wrong for the rest — it had already put "Nómina" where the first-run panel
   * meant to say "Pacientes".
   *
   * Absent for the sectors built out of general modules: a consultancy's
   * central screen is `proyectos`, which belongs to no sector in particular.
   */
  vertical?: string
}

/**
 * What the sidebar looks like for a sector.
 *
 * Two questions, both about presentation and neither about access:
 *
 *   · `navLabel` — what to call the group holding this sector's own modules.
 *     «Sectoriales» is a word about the platform, not about the business. It is
 *     the right heading in Configuración → Módulos, where an administrator is
 *     reading a catalogue and needs to know which entries are industry
 *     specific. It is the wrong one in the nav, where a dentist should see
 *     «Clínica» above the screen they spend the day in.
 *
 *   · `groupOrder` — which headings come first. Every sector used to get
 *     `Personas · Operación · Comercial · Colaboración`, which puts Nómina
 *     above Producción for a factory and above Cotizaciones for an agency. The
 *     order is the product's opinion about what a day looks like, and one
 *     opinion cannot be right for twenty-two industries.
 *
 * A separate map rather than two more fields on `CompanyTypeDef`, for two
 * reasons: it keys off the sector string, so a sector that exists only in the
 * database (migrations 29 and 34 make that possible without a deploy) can be
 * given a shape here without also being given a TypeScript entry; and reading
 * the whole nav layout as one table is how you notice that six sectors all
 * disagree with each other for no reason.
 *
 * Groups left out of a `groupOrder` are appended in `MODULE_GROUPS` order, so a
 * partial list is legal and means "these first". A sector absent from the map
 * entirely gets the default order, which is right for the ones that really are
 * people-first.
 */
export interface SectorNav {
  navLabel?: string
  groupOrder?: readonly ModuleGroup[]
}

/** Operations-led: the work happens in the field, the plant or the kitchen. */
const OPS_FIRST = ['Operación', 'Comercial', 'Personas', 'Equipo'] as const
/** Sales-led: the day starts with what was quoted, sold or collected. */
const SALES_FIRST = ['Comercial', 'Operación', 'Personas', 'Equipo'] as const

export const SECTOR_NAV: Record<string, SectorNav> = {
  construccion:       { navLabel: 'Obra',        groupOrder: OPS_FIRST },
  energia:            { navLabel: 'Obra',        groupOrder: OPS_FIRST },
  mineria:            { navLabel: 'Obra',        groupOrder: OPS_FIRST },
  manufactura:        { groupOrder: OPS_FIRST },
  telecomunicaciones: { navLabel: 'Redes', groupOrder: OPS_FIRST },
  logistica:          { groupOrder: OPS_FIRST },
  tecnologia:         { groupOrder: OPS_FIRST },
  gobierno:           { navLabel: 'Contratación', groupOrder: OPS_FIRST },
  seguridad:          { navLabel: 'Puestos',     groupOrder: OPS_FIRST },

  comercio:           { groupOrder: SALES_FIRST },
  servicios:          { groupOrder: SALES_FIRST },
  medios:             { groupOrder: SALES_FIRST },
  ecommerce:          { navLabel: 'Venta en línea', groupOrder: SALES_FIRST },
  inmobiliario:       { navLabel: 'Inmuebles',      groupOrder: SALES_FIRST },

  // Money and people, in that order, and the shared tools last.
  financiero:         { groupOrder: ['Comercial', 'Personas', 'Operación', 'Equipo'] },
  // «Bienestar» rather than «Club»: it has to fit a gym, a pilates studio, a
  // spa and a therapy centre, and only one of those is a club.
  'fitness-bienestar':{ navLabel: 'Bienestar', groupOrder: ['Comercial', 'Personas', 'Operación', 'Equipo'] },

  // A clinic bills and schedules before it does anything else; the safety
  // programme and the warehouse are real but they are not the morning.
  salud:              { navLabel: 'Clínica',    groupOrder: ['Comercial', 'Equipo', 'Personas', 'Operación'] },
  // A school's shared tools *are* the operation: calendar, documents, channels.
  educacion:          { navLabel: 'Académico',  groupOrder: ['Equipo', 'Comercial', 'Personas', 'Operación'] },
  alimentos:          { navLabel: 'Servicio',   groupOrder: OPS_FIRST },
  agro:               { navLabel: 'Campo',      groupOrder: OPS_FIRST },
  hoteleria:          { navLabel: 'Alojamiento', groupOrder: OPS_FIRST },

  // An NGO reports before it sells; it usually is not selling at all.
  ong:                { groupOrder: ['Operación', 'Equipo', 'Personas', 'Comercial'] },

  // `otro` is deliberately absent: "Otro" has no opinion to express.
}

/** The nav shape for a sector, or the default one. */
export function sectorNav(key: string | null): SectorNav {
  return (key && SECTOR_NAV[key]) || {}
}

/**
 * Starting sets, not cages. Picking a sector replaces the current selection
 * with its preset; every module stays individually switchable afterwards,
 * because the sector is a guess about the company and the toggles are the
 * company's own answer.
 */
const PEOPLE = ['empleados', 'asistencia', 'nomina']
const SPINE = ['canales', 'documentos', 'calendario', 'ia', 'reportes', 'portal', 'marketing']
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
    modules: [...PEOPLE, 'riesgos', 'proyectos', 'obra', 'hseq', 'inventario', 'mantenimiento', ...COMMERCIAL, 'compras', 'contratos', 'firmas', 'tickets', ...SPINE],
    vertical: 'obra',
  },
  {
    key: 'energia',
    label: 'Energía y renovables',
    description: 'Solar, eólica, eficiencia energética. Instalación y mantenimiento.',
    modules: [...PEOPLE, 'riesgos', 'proyectos', 'obra', 'hseq', 'inventario', 'mantenimiento', ...COMMERCIAL, 'compras', 'catalogos', 'contratos', 'firmas', 'tickets', ...SPINE],
  },
  {
    key: 'manufactura',
    label: 'Manufactura y producción',
    description: 'Planta propia, línea de producción, control de existencias.',
    modules: [...PEOPLE, 'riesgos', 'hseq', 'inventario', 'produccion', 'calidad', 'mantenimiento', ...COMMERCIAL, 'catalogos', 'compras', 'firmas', 'tickets', ...SPINE],
  },
  {
    key: 'comercio',
    label: 'Comercio y retail',
    description: 'Venta de producto, punto físico o en línea. Sin obra en campo.',
    // `pos` y `caja` son el mostrador. Un retail vendía por `tienda`, que es un
    // catálogo web con carrito: sirve para que alguien pida desde el celular y
    // no para cobrarle a quien está parado enfrente.
    modules: [...PEOPLE, 'inventario', 'catalogos', 'pos', 'caja', 'tienda', ...COMMERCIAL, 'leads', 'compras', 'tickets', ...SPINE],
  },
  {
    key: 'ecommerce',
    label: 'Ecommerce y venta en línea',
    description: 'Tienda pública, pedidos por internet, despacho y devoluciones.',
    modules: [...PEOPLE, 'inventario', 'catalogos', 'tienda', 'ecommerce', ...COMMERCIAL, 'compras', 'tickets', ...SPINE],
    vertical: 'ecommerce',
  },
  {
    key: 'servicios',
    label: 'Servicios profesionales',
    description: 'Consultoría, contabilidad, legal, agencias. Se factura tiempo.',
    modules: [...PEOPLE, 'proyectos', 'tiempos', ...COMMERCIAL, 'leads', 'contratos', 'cartera', 'firmas', 'tickets', 'consultoria', ...SPINE],
  },
  {
    key: 'tecnologia',
    label: 'Tecnología y software',
    description: 'Producto digital o desarrollo a la medida.',
    modules: [...PEOPLE, 'proyectos', 'tiempos', ...COMMERCIAL, 'leads', 'contratos', 'suscripciones', 'reclutamiento', 'desempeno', 'tickets', ...SPINE],
  },
  {
    key: 'salud',
    label: 'Salud',
    description: 'IPS, consultorios, laboratorios. Pacientes, turnos y cumplimiento.',
    // `caja` sin `pos`: una clínica cobra copagos y particulares en efectivo y
    // necesita cuadrar el turno, pero no vende de mostrador — lo que factura
    // sale de la consulta, no de un catálogo.
    modules: [...PEOPLE, 'pacientes', 'riesgos', 'hseq', 'inventario', 'caja', 'facturacion', 'clientes', 'cartera', 'firmas', 'tickets', 'trazabilidad', 'notificaciones', ...SPINE],
    vertical: 'pacientes',
  },
  {
    key: 'educacion',
    label: 'Educación',
    description: 'Colegios, institutos y academias. Matrículas y notas.',
    modules: [...PEOPLE, 'estudiantes', 'capacitacion', 'facturacion', 'clientes', 'suscripciones', 'cartera', 'inventario', 'firmas', 'contratos', 'tickets', 'notificaciones', ...SPINE],
    vertical: 'estudiantes',
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
    // `caja` deja de vivir dentro de `restaurante` (migración 43) y pasa a ser
    // el módulo que también usan la clínica, el hotel y el gimnasio. El
    // restaurante no pierde nada: la misma tabla, el mismo arqueo.
    modules: [...PEOPLE, 'restaurante', 'inventario', 'catalogos', 'caja', 'compras', 'hseq', 'calidad', 'facturacion', 'tickets', ...SPINE],
    vertical: 'restaurante',
  },
  {
    key: 'agro',
    label: 'Agro y agroindustria',
    description: 'Cultivos, fincas, ciclos productivos y cosecha.',
    modules: [...PEOPLE, 'agro', 'calidad', 'inventario', 'mantenimiento', 'flota', 'hseq', 'riesgos', ...COMMERCIAL, 'compras', 'tickets', ...SPINE],
    vertical: 'agro',
  },
  {
    key: 'inmobiliario',
    label: 'Inmobiliario',
    description: 'Arriendo y administración de inmuebles, propiedad horizontal.',
    modules: [...PEOPLE, 'inmobiliario', 'contratos', ...COMMERCIAL, 'leads', 'suscripciones', 'mantenimiento', 'firmas', 'tickets', 'notificaciones', ...SPINE],
    vertical: 'inmobiliario',
  },
  {
    key: 'hoteleria',
    label: 'Hotelería y turismo',
    description: 'Hoteles, hostales y operadores turísticos. Reservas y ocupación.',
    modules: [...PEOPLE, 'hoteleria', 'restaurante', 'inventario', 'caja', 'mantenimiento', 'facturacion', 'clientes', 'tickets', 'notificaciones', ...SPINE],
    vertical: 'hoteleria',
  },
  {
    key: 'financiero',
    label: 'Financiero y seguros',
    description: 'Cooperativas, corredoras, fintech. Cartera y cumplimiento.',
    modules: [...PEOPLE, ...COMMERCIAL, 'leads', 'contratos', 'cartera', 'creditos', 'riesgos', 'firmas', 'trazabilidad', 'desempeno', 'tickets', 'consultoria', ...SPINE],
  },
  {
    key: 'mineria',
    label: 'Minería y extractivas',
    description: 'Operación en frente de trabajo, equipo pesado, alto riesgo.',
    modules: [...PEOPLE, 'riesgos', 'hseq', 'proyectos', 'obra', 'inventario', 'mantenimiento', 'flota', 'compras', 'contratos', 'firmas', 'trazabilidad', 'tickets', ...SPINE],
  },
  {
    key: 'telecomunicaciones',
    label: 'Telecomunicaciones',
    description: 'Redes, instalación y soporte a suscriptores.',
    modules: [...PEOPLE, 'proyectos', 'suscriptores', 'inventario', 'mantenimiento', 'flota', ...COMMERCIAL, 'contratos', 'tickets', ...SPINE],
    vertical: 'suscriptores',
  },
  {
    key: 'seguridad',
    label: 'Seguridad y vigilancia',
    description: 'Empresas de vigilancia y control. Turnos, puestos y dotación.',
    modules: [...PEOPLE, 'puestos', 'riesgos', 'hseq', 'inventario', 'contratos', ...COMMERCIAL, 'firmas', 'capacitacion', 'tickets', 'trazabilidad', ...SPINE],
    vertical: 'puestos',
  },
  {
    key: 'medios',
    label: 'Medios y publicidad',
    description: 'Agencias, productoras y medios. Trabajo por campaña.',
    modules: [...PEOPLE, 'proyectos', 'tiempos', ...COMMERCIAL, 'leads', 'contratos', 'inventario', 'firmas', 'tickets', ...SPINE],
  },
  {
    key: 'ong',
    label: 'ONG y fundaciones',
    description: 'Sin ánimo de lucro. Proyectos, donantes y rendición de cuentas.',
    modules: [...PEOPLE, 'proyectos', 'clientes', 'donantes', 'contratos', 'capacitacion', 'firmas', 'trazabilidad', 'tickets', ...SPINE],
  },
  {
    key: 'gobierno',
    label: 'Sector público',
    description: 'Entidades y contratistas del Estado. Trazabilidad obligatoria.',
    modules: [...PEOPLE, 'proyectos', 'contratacion', 'contratos', 'compras', 'firmas', 'hseq', 'riesgos', 'trazabilidad', 'tickets', ...SPINE],
    vertical: 'contratacion',
  },
  {
    key: 'otro',
    label: 'Otro',
    description: 'Empieza con lo esencial y activa el resto a mano.',
    modules: [...PEOPLE, 'clientes', 'firmas', 'tickets', ...SPINE],
  },
  {
    key: 'fitness-bienestar',
    label: 'Fitness y bienestar',
    description: 'Gimnasios, estudios y centros de bienestar. Socios, clases y planes.',
    // `socios` and `facturacion` arrive together in migration 42. The sector
    // shipped in migration 33 with neither, on the explicit decision to wait
    // for demand before building a vertical (M9) — which left a gym with
    // eleven modules and nowhere to record a member, a membership, a class or
    // somebody walking through the door. That is the whole business.
    modules: [...PEOPLE, 'socios', 'suscripciones', 'clientes', 'facturacion', 'caja', 'inventario', 'firmas', 'tickets', 'notificaciones', ...SPINE],
    vertical: 'socios',
  },
]

/**
 * What a subsector changes about its parent's proposal.
 *
 * A sector is the right grain for a first guess and the wrong grain for a good
 * one. «Salud» proposes the same eighteen modules to a solo dentist and to a
 * hospital; «Alimentos» the same to a bakery and to a bar. Subsectors existed
 * in the picker since migration 29 and changed nothing — the customer answered
 * a second question and got the same answer back, which is worse than not
 * asking.
 *
 * A delta, not a second preset. Written as «what does this kind of business
 * have that the rest of its industry does not, and what does it not have» —
 * the only form in which the arithmetic stays explainable:
 *
 *     preset(sector, sub) = (preset(sector) ∪ sub.add) − sub.remove
 *
 * Two rules the tests enforce, because breaking either produces a starting
 * point the product then silently corrects:
 *
 *   1. The result is closed under hard dependencies. Adding `tienda` without
 *      `catalogos` proposes a storefront with nothing in it.
 *   2. `remove` never takes a module something else in the result hard-depends
 *      on. Removing `inventario` while `produccion` stays is the same bug from
 *      the other direction.
 *
 * A subsector absent from this map is legitimate — it segments the customer
 * base without changing the proposal — but it is worth a second look: a
 * dropdown entry that costs a decision and returns nothing is one the customer
 * would rather not have been asked.
 */
export interface SectorDelta {
  add: readonly string[]
  remove: readonly string[]
}

export const SUBSECTOR_PRESETS: Record<string, SectorDelta> = {
  /* ─── Salud ─────────────────────────────────────────────────────────────── */
  // A single practice: no safety programme, no warehouse, no audit trail.
  'salud-consultorio':   { add: [], remove: ['hseq', 'riesgos', 'inventario', 'trazabilidad'] },
  // A clinic is a building with staff: equipment to service, people to review.
  'salud-ips':           { add: ['mantenimiento', 'desempeno'], remove: [] },
  // A lab sells a price list of tests and lives on traceability.
  'salud-laboratorio':   { add: ['catalogos'], remove: [] },
  // Treatment plans are quoted before they are done.
  'salud-odontologia':   { add: ['catalogos', 'cotizaciones'], remove: ['hseq', 'trazabilidad'] },
  'salud-estetica':      { add: ['catalogos', 'cotizaciones'], remove: ['hseq', 'riesgos', 'trazabilidad'] },
  // Vets sell food and medication over the counter, which is the one branch of
  // salud that really is a shop with a consulting room attached.
  'salud-veterinaria':   { add: ['catalogos', 'tienda', 'pos'], remove: ['trazabilidad'] },

  /* ─── Comercio ──────────────────────────────────────────────────────────── */
  // Over the counter: nobody quotes a shirt.
  'comercio-retail':     { add: [], remove: ['cotizaciones'] },
  // Sells to businesses, on contract, and delivers. No counter, so no till.
  'comercio-mayorista':  { add: ['contratos', 'flota'], remove: ['tienda', 'pos', 'caja'] },
  'comercio-ferreteria': { add: [], remove: ['tienda'] },
  // Controlled substances: what came in, what went out, to whom.
  'comercio-farmacia':   { add: ['trazabilidad'], remove: ['cotizaciones'] },
  'comercio-super':      { add: ['flota', 'mantenimiento'], remove: ['cotizaciones'] },

  /* ─── Restaurantes y alimentos ──────────────────────────────────────────── */
  'alimentos-salon':     { add: ['clientes'], remove: [] },
  // Delivery is the business, so the public storefront comes with it — and the
  // counter, because half of fast food is somebody standing at it.
  'alimentos-rapida':    { add: ['tienda', 'ecommerce', 'pos'], remove: [] },
  'alimentos-bar':       { add: ['clientes'], remove: ['hseq'] },
  // Every event is quoted, contracted and run like a small project. Nobody
  // walks into a catering company and buys a canapé, so no counter.
  'alimentos-catering':  { add: ['clientes', 'cotizaciones', 'contratos', 'proyectos'], remove: ['caja'] },
  // Bakes in batches, then sells them over a counter.
  'alimentos-panaderia': { add: ['produccion', 'pos'], remove: [] },

  /* ─── Hotelería y turismo ───────────────────────────────────────────────── */
  'hoteleria-hotel':     { add: ['hseq'], remove: [] },
  // Beds and a front desk, and not much else.
  'hoteleria-hostal':    { add: [], remove: ['restaurante', 'mantenimiento'] },
  // Sells trips, owns no rooms, and takes no cash across a counter.
  'hoteleria-finca':     { add: ['agro'], remove: [] },
  // Sells trips, owns no rooms. The vertical goes: it would be an empty screen.
  'hoteleria-operador':  {
    add: ['proyectos', 'cotizaciones', 'contratos'],
    remove: ['hoteleria', 'restaurante', 'inventario', 'mantenimiento', 'caja'],
  },

  /* ─── Educación ─────────────────────────────────────────────────────────── */
  'educacion-colegio':     { add: ['desempeno', 'reclutamiento'], remove: [] },
  'educacion-instituto':   { add: ['proyectos'], remove: [] },
  // Rented rooms, month-to-month students.
  'educacion-academia':    { add: [], remove: ['inventario', 'contratos'] },
  'educacion-universidad': { add: ['proyectos', 'desempeno', 'reclutamiento', 'trazabilidad'], remove: [] },

  /* ─── Construcción ──────────────────────────────────────────────────────── */
  'construccion-civil':    { add: ['flota'], remove: [] },
  'construccion-mep':      { add: ['catalogos'], remove: [] },
  'construccion-remodel':  { add: ['catalogos'], remove: ['hseq'] },
  // Supervises somebody else's work: no warehouse, no purchasing, all evidence.
  'construccion-interv':   {
    add: ['trazabilidad'],
    remove: ['inventario', 'mantenimiento', 'compras'],
  },

  /* ─── Agro ──────────────────────────────────────────────────────────────── */
  'agro-permanente':     { add: ['trazabilidad'], remove: [] },
  'agro-transitorio':    { add: ['produccion'], remove: [] },
  'agro-ganaderia':      { add: ['produccion', 'trazabilidad'], remove: [] },
  // Packing, grading and shipping what the field produced.
  'agro-poscosecha':     { add: ['produccion', 'catalogos', 'trazabilidad'], remove: [] },

  /* ─── Servicios profesionales ───────────────────────────────────────────── */
  'servicios-consultoria': { add: ['desempeno'], remove: [] },
  // Recurring engagements, not projects, and an evidence trail.
  'servicios-contable':    { add: ['trazabilidad'], remove: ['proyectos'] },
  'servicios-legal':       { add: ['trazabilidad'], remove: [] },
  'servicios-agencia':     { add: ['desempeno', 'reclutamiento'], remove: [] },
  'servicios-ti':          { add: ['inventario', 'desempeno'], remove: [] },

  /* ─── Logística ─────────────────────────────────────────────────────────── */
  'logistica-carga':     { add: ['contratos'], remove: ['catalogos'] },
  // Last mile is the delivery half of somebody's online store.
  'logistica-ultima':    { add: ['tienda', 'ecommerce'], remove: [] },
  'logistica-bodegaje':  { add: ['contratos'], remove: ['flota'] },

  /* ─── Inmobiliario ──────────────────────────────────────────────────────── */
  'inmobiliario-arriendo':  { add: [], remove: ['cotizaciones'] },
  // Common areas: safety, incidents and residents raising them.
  'inmobiliario-ph':        { add: ['hseq', 'riesgos', 'ph'], remove: ['cotizaciones'] },
  // Brokers close deals; they do not fix taps.
  'inmobiliario-corretaje': { add: ['desempeno'], remove: ['mantenimiento'] },

  /* ─── Manufactura ───────────────────────────────────────────────────────── */
  'manufactura-metal':     { add: ['proyectos'], remove: [] },
  'manufactura-plastico':  { add: ['trazabilidad'], remove: [] },
  // Sells its own line, often direct.
  'manufactura-textil':    { add: ['tienda'], remove: [] },
  'manufactura-alimentos': { add: ['trazabilidad'], remove: [] },

  /* ─── Fitness y bienestar ───────────────────────────────────────────────── */
  // A membership is a contract, and the machines need servicing.
  'fitness-gimnasio':    { add: ['contratos', 'mantenimiento'], remove: [] },
  'fitness-estudio':     { add: ['contratos', 'capacitacion'], remove: ['inventario'] },
  // A spa sells product at the desk on the way out.
  'fitness-spa':         { add: ['contratos', 'catalogos', 'cotizaciones', 'pos'], remove: [] },
  // Therapies with a record of who was seen and when.
  'fitness-centro':      { add: ['contratos', 'pacientes'], remove: [] },

  /* ─── Energía ───────────────────────────────────────────────────────────── */
  // The installer quotes what it builds; it sells no catalogue of products.
  'energia-solar':         { add: [], remove: ['catalogos'] },
  // A wind farm develops projects, and sells even less of a catalogue.
  'energia-eolica':        { add: [], remove: ['catalogos'] },
  // Audits live on evidence: what was measured, what was saved.
  'energia-eficiencia':    { add: ['trazabilidad'], remove: [] },
  // Operates somebody else's plant under availability contracts: services it,
  // bills it, and builds nothing.
  'energia-om':            { add: ['cartera'], remove: ['proyectos', 'obra'] },

  /* ─── Ecommerce ─────────────────────────────────────────────────────────── */
  // Sells on somebody else's platform, so it operates no storefront at all —
  // and `ecommerce` cannot stay once `tienda` goes, because it needs it.
  'ecommerce-marketplace':  { add: ['notificaciones'], remove: ['tienda', 'ecommerce'] },
  // The sector itself: the store is the business, and the customer hears about
  // the order.
  'ecommerce-tienda':       { add: ['notificaciones'], remove: [] },
  // Never touches the product: the supplier ships.
  'ecommerce-dropshipping': { add: [], remove: ['inventario'] },
  // Recurrence is the business model.
  'ecommerce-suscripcion':  { add: ['suscripciones'], remove: [] },

  /* ─── Tecnología ────────────────────────────────────────────────────────── */
  // A product company bills subscriptions, not hours.
  'tecnologia-saas':        { add: [], remove: ['tiempos'] },
  // A software factory sells hours, not recurrence.
  'tecnologia-medida':      { add: [], remove: ['suscripciones'] },
  // Resells hardware and infrastructure alongside the build.
  'tecnologia-integrador':  { add: ['inventario'], remove: ['suscripciones'] },

  /* ─── Financiero ────────────────────────────────────────────────────────── */
  // Savings walk in over a counter.
  'financiero-cooperativa': { add: ['caja'], remove: [] },
  // Places no credit: it intermediates somebody else's.
  'financiero-seguros':     { add: [], remove: ['creditos'] },
  // Product, not practice: it does not consult.
  'financiero-fintech':     { add: [], remove: ['consultoria'] },
  // Collects other people's debt; it never places its own.
  'financiero-cobranza':    { add: [], remove: ['creditos'] },

  /* ─── Minería ───────────────────────────────────────────────────────────── */
  // Tonnage out of the pit is production, not a project.
  'mineria-abierto':        { add: ['produccion'], remove: [] },
  // Underground adds constant rescue and ventilation training.
  'mineria-subterranea':    { add: ['produccion', 'capacitacion'], remove: [] },
  // Crushes and sells aggregate; it executes no projects and no civil works.
  'mineria-agregados':      { add: ['produccion'], remove: ['proyectos', 'obra'] },

  /* ─── Telecomunicaciones ────────────────────────────────────────────────── */
  // Subscribers pay their bill at a counter.
  'telecomunicaciones-isp':         { add: ['caja'], remove: [] },
  // Installs somebody else's network: no subscribers of its own.
  'telecomunicaciones-instalador':  { add: [], remove: ['suscriptores'] },
  // Corporate networks, not subscriber lines.
  'telecomunicaciones-integrador':  { add: [], remove: ['suscriptores'] },

  /* ─── Seguridad ─────────────────────────────────────────────────────────── */
  // Lives on monthly billing per guard post contract.
  'seguridad-vigilancia':  { add: ['cartera'], remove: [] },
  // Sells alarm equipment from a catalogue; the control room is no guard post.
  'seguridad-monitoreo':   { add: ['catalogos'], remove: ['puestos'] },
  // Moves with the principal: a vehicle, and no fixed post or warehouse.
  'seguridad-escoltas':    { add: ['flota'], remove: ['puestos', 'inventario'] },

  /* ─── Medios ────────────────────────────────────────────────────────────── */
  // A pure creative shop owns no equipment stock.
  'medios-agencia':        { add: [], remove: ['inventario'] },
  // Cameras and lights are assets that get serviced.
  'medios-productora':     { add: ['mantenimiento'], remove: [] },
  // Sells ad space and memberships, not campaigns run as projects.
  'medios-medio':          { add: ['suscripciones'], remove: ['proyectos', 'tiempos'] },

  /* ─── ONG ───────────────────────────────────────────────────────────────── */
  // Donor programmes are recurring by design.
  'ong-fundacion':         { add: ['suscripciones'], remove: [] },
  // Institutional agreements with disbursements to collect.
  'ong-cooperacion':       { add: ['cartera'], remove: [] },
  // Volunteers donate time; nobody is on payroll for it.
  'ong-voluntariado':      { add: [], remove: ['nomina'] },

  /* ─── Gobierno ──────────────────────────────────────────────────────────── */
  // The entity runs the process and evaluates the people who carry it out.
  'gobierno-entidad':      { add: ['desempeno'], remove: [] },
  // Executes somebody else's procurement; it does not run one.
  'gobierno-contratista':  { add: [], remove: ['contratacion'] },
  // A utility operates networks with subscribers, not procurement processes.
  'gobierno-servicios':    { add: ['suscriptores', 'flota', 'mantenimiento'], remove: ['contratacion'] },
}

export const COMPANY_TYPE_KEYS: CompanyTypeKey[] = COMPANY_TYPES.map((t) => t.key)

/** A type predicate, so a validated form value narrows to what the column takes. */
export function isCompanyType(value: string): value is CompanyTypeKey {
  return (COMPANY_TYPE_KEYS as string[]).includes(value)
}

export function companyType(key: string | null): CompanyTypeDef | null {
  if (!key) return null
  return COMPANY_TYPES.find((t) => t.key === key) ?? null
}

/**
 * Applies a subsector's amendment to its parent's proposal.
 *
 * Order matters and is the obvious one: add first, then remove. A module named
 * in both is removed, which is the reading that makes a delta safe to edit —
 * `remove` is the last word, so a subsector can always take something out
 * regardless of what the parent or a future edit puts in.
 *
 * Pure and exported so the same arithmetic runs over a delta from the database
 * (queries/sectors.ts) and over `SUBSECTOR_PRESETS`, rather than being written
 * twice and drifting.
 */
export function applySectorDelta(base: readonly string[], delta?: SectorDelta | null): string[] {
  if (!delta) return [...base]
  const result = new Set(base)
  for (const key of delta.add) result.add(key)
  for (const key of delta.remove) result.delete(key)
  return [...result]
}

/**
 * The preset for a company type, or every module when the type is unknown.
 *
 * The fallback is the *legacy* one, and it is deliberately generous: an
 * organization created before `enabled_modules` existed has an empty column and
 * no sector, and none of them should wake up to a blank sidebar. Opening
 * everything is the only safe answer to "we do not know what this account uses".
 *
 * It is emphatically NOT the answer for somebody who chose to configure
 * manually — see `MANUAL_START` — nor for a sector that exists in the database
 * and not here. That second case is what `presetFromCatalogue` in
 * server/queries/sectors.ts is for: a sector added as data proposes what its
 * rows say, and falls back to a small starting set rather than to everything.
 *
 * `subsector` amends the result. Passing one whose parent is not `key` is not
 * checked here — the database refuses that pairing on write, and the pickers
 * clear the subsector whenever the sector changes.
 */
export function presetFor(key: string | null, subsector?: string | null): string[] {
  const base = companyType(key)?.modules ?? [...MODULE_KEYS]
  return applySectorDelta(base, subsector ? SUBSECTOR_PRESETS[subsector] : null)
}

/**
 * Where "configurar manualmente" starts.
 *
 * `presetFor(null)` returns the whole catalogue, and for a long time that was
 * also what the manual path got — so the customer who explicitly declined a
 * sector, saying *I will choose*, was handed all thirty-five modules switched
 * on. The most opinionated choice in the product produced the least opinionated
 * result, and undoing it took thirty clicks.
 *
 * The two questions share a shape and nothing else:
 *
 *   · "we do not know what this account uses"  → open everything (legacy)
 *   · "I will decide myself"                    → open almost nothing (here)
 *
 * People, a place to talk, somewhere to put documents, a calendar. Enough to
 * sign in and find the product usable on the first day; little enough that
 * every further module is a decision the customer actually made.
 */
export const MANUAL_START: string[] = [
  'empleados', 'documentos', 'calendario', 'canales', 'tickets',
]

/**
 * What a new company starts with, given what it was asked.
 *
 * The one function the signup and "nueva empresa" paths should call. Passing a
 * sector gets its preset; passing null means the customer chose to configure
 * manually, which is a decision and is treated as one.
 */
export function startingModules(sector: string | null, subsector?: string | null): string[] {
  return sector ? presetFor(sector, subsector) : [...MANUAL_START]
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
  return new Set([...CORE, ...usable])
}

/**
 * What picking a sector actually gets you, split by whether the plan carries it.
 *
 * The split is the point. Every preset names modules the entry plan does not
 * include, and for most sectors the module that *defines* them is among those:
 * `salud` proposes `pacientes`, `agro` proposes `agro`, `alimentos` proposes
 * `restaurante`, and Starter carries none of the three. A signup screen that
 * showed the whole preset would promise a clinic a patient record it will not
 * find in its sidebar an hour later — the worst possible first day, and one
 * the product currently delivers in silence.
 *
 * So both halves are returned and both get said out loud. `allowed` is passed
 * in rather than read from lib/plans.ts, for the same reason `resolveModules`
 * takes it: plans.ts imports this module, and a cycle between the access
 * catalogue and the billing catalogue is a load-order bug waiting to happen.
 * Omitting it means "no plan gate", which is what the catalogue tests want.
 */
export function sectorStart(
  key: string | null,
  allowed?: ReadonlySet<string>,
): { included: ModuleDef[]; locked: ModuleDef[] } {
  const preset = presetFor(key)
  const included: ModuleDef[] = []
  const locked: ModuleDef[] = []
  for (const moduleKey of preset) {
    const def = moduleDef(moduleKey)
    if (!def) continue
    if (!allowed || allowed.has(moduleKey)) included.push(def)
    else locked.push(def)
  }
  return { included, locked }
}

/** Groups the catalog for rendering, preserving MODULE_GROUPS order. */
export function modulesByGroup(): Array<{ group: ModuleGroup; modules: ModuleDef[] }> {
  return GROUPS.map((group) => ({
    group,
    modules: MODULES.filter((m) => m.group === group),
  }))
}
