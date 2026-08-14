/**
 * The one list.
 *
 * A module used to be described in five places, and all five had to agree:
 *
 *   · `MODULES` in lib/modules.ts        — key, label, description, group
 *   · `PERMISSIONS` in lib/auth/permissions.ts — `<module>:<action>`
 *   · `NAV` / `META` / `META_SUB` / `ROUTE_MAP` in lib/data/nav.ts
 *   · `insert into public.permissions` in the migrations
 *   · `app.valid_module_keys()` in the migrations
 *
 * They happened to be in sync, which is not the same as being kept in sync.
 * Two of the five had a test watching them; `valid_module_keys` had nothing at
 * all, so adding a module and forgetting that function produced an opaque
 * `check_violation` when an administrator saved their module selection — a
 * failure with no obvious cause, in a place nobody would look.
 *
 * Everything is derived from this file now. `MODULES`, `PERMISSIONS`, `NAV`,
 * `ROUTE_MAP`, `ROUTE_PERMISSIONS` and the label maps are all projections of
 * the array below, and the SQL side is generated from it — `npm run
 * db:module-sql` prints `app.valid_module_keys()` and the `public.permissions`
 * rows to paste into a migration — and pinned by registry.test.ts in both
 * directions.
 *
 * ─── What belongs here and what does not ───────────────────────────────────
 *
 * This is the *catalogue*: what a module is called, what it does, which route
 * it lives at, which actions it defines. It is not the answer to whether any
 * particular company has it switched on — that is `enabled_modules`, resolved
 * in lib/modules.ts — and it is not the answer to whether a person may open it,
 * which is `role_permissions`.
 *
 * The catalogue stays in TypeScript rather than moving into the database, even
 * though the sector list is moving the other way. The difference is who edits
 * them: a sector is data a product person adds, and adding one should not need
 * a deploy; a module is code — it has a route, a query file, a mutations file
 * and a screen — so its catalogue entry belongs beside them, where the compiler
 * can see it.
 */

/**
 * The headings a module can sit under, in their default order.
 *
 * «Colaboración» used to be the fourth, and it had become the drawer everything
 * that was not obviously people, operations or sales got put in: Canales,
 * Tickets, Firmas, Documentos, Contratos, Calendario, Consultoría and the AI
 * assistant. Two of those were plainly somewhere else — a contract is a
 * commercial instrument, not a conversation — and the rest are simply the tools
 * a team shares, which is what «Equipo» says without pretending to be a theme.
 *
 * This is the *default* order and the vocabulary the Configuración → Módulos
 * list uses, where a flat, stable catalogue is the right thing. The sidebar
 * reorders it per sector and renames «Sectoriales» after the business, because
 * a heading is a promise about what matters and a clinic's does not read the
 * same as a builder's. See `navFor` in lib/data/nav.ts.
 */
export const MODULE_GROUPS = [
  'Personas', 'Operación', 'Comercial', 'Equipo', 'Sectoriales',
] as const
export type ModuleGroup = (typeof MODULE_GROUPS)[number]

export type ModuleAction = 'read' | 'write' | 'manage' | 'use'

/**
 * A second route that resolves to the same module.
 *
 * `ordenes-compra` is the only one today: it is its own screen with its own nav
 * entry, but it is part of Compras and gated on `compras:read`. Modelling it as
 * an alias rather than a module keeps it out of the plan catalogue and out of
 * `enabled_modules`, where it would have been a toggle that did nothing.
 */
export interface ModuleAlias {
  key: string
  label: string
  icon: string
  route: string
  title: string
  subtitle: string
}

export interface ModuleEntry {
  key: string
  /** Name in the sidebar and the module catalogue. */
  label: string
  /** One line, written for an administrator deciding whether to switch it on. */
  description: string
  /**
   * The sidebar heading it sits under, or `null` for the shell.
   *
   * `dashboard` and `configuracion` have no group because they are not modules
   * in the sense the rest of the list means: they cannot be switched off, they
   * belong to no plan, and Configuración especially — switching it off would
   * remove the only screen that could switch it back on.
   */
  group: ModuleGroup | null
  /** Key into ICON_MAP in the sidebar. `null` for screens with no nav entry. */
  icon: string | null
  route: string
  /** The actions this module defines. Becomes `<key>:<action>` permissions. */
  actions: readonly ModuleAction[]
  /**
   * Name in the permission matrix, when the sidebar's is too long for a column
   * header. «Centro de Riesgos» is a good nav item and a bad table heading.
   */
  shortLabel?: string
  /**
   * The noun the permission wording uses, when it is not the label lowercased.
   *
   * `inmobiliario` grants «Ver inmuebles», not «Ver inmobiliario» — the module
   * is named after the sector and the permission after the thing being read.
   * `HSEQ` keeps its capitals.
   */
  permissionNoun?: string
  /**
   * Whole permission labels, for the ones no formula produces.
   *
   * `ia:use` is «Usar el asistente de IA», and `configuracion:manage` is
   * «Administrar la organización» — which is what the permission actually
   * means, and deliberately not «Administrar configuración».
   */
  permissionLabels?: Partial<Record<ModuleAction, string>>
  /** Page heading. */
  title: string
  /** Page subheading. */
  subtitle: string
  /**
   * The sector this module exists for, when it has one.
   *
   * Stated rather than derived, because the two vocabularies do not line up:
   * `salud` runs on `pacientes`, `alimentos` on `restaurante`, `educacion` on
   * `estudiantes`. Only some of them happen to share a name, which is exactly
   * enough for `key === key` to look correct in a spot check and be wrong for
   * the rest.
   */
  vertical?: string
  aliases?: readonly ModuleAlias[]
}

export const REGISTRY: readonly ModuleEntry[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'El resumen de la empresa. Parte de la carcasa, nunca conmutable.',
    group: null,
    icon: 'LayoutDashboard',
    route: '/dashboard',
    actions: ['read'],
    title: 'Dashboard',
    subtitle: 'Resumen general de personas, documentos y actividad.',
  },
  {
    key: 'empleados',
    label: 'Empleados',
    description: 'Directorio del equipo, perfiles y organigrama.',
    group: 'Personas',
    icon: 'Users',
    route: '/dashboard/empleados',
    actions: ['read', 'write'],
    title: 'Empleados',
    subtitle: 'Directorio y gestión del equipo.',
  },
  {
    key: 'asistencia',
    label: 'Asistencia',
    description: 'Ausencias, incapacidades, horas extra y vacaciones.',
    group: 'Personas',
    icon: 'Clock',
    route: '/dashboard/asistencia',
    actions: ['read', 'write'],
    title: 'Asistencia',
    subtitle: 'Ausencias, incapacidades, horas extra y vacaciones.',
  },
  {
    key: 'nomina',
    label: 'Nómina',
    description: 'Costo de nómina, desprendibles y evolución salarial.',
    group: 'Personas',
    icon: 'Wallet',
    route: '/dashboard/nomina',
    actions: ['read', 'write'],
    title: 'Nómina',
    subtitle: 'Costo de nómina, beneficios y evolución salarial.',
  },
  {
    key: 'riesgos',
    label: 'Centro de Riesgos',
    description: 'Riesgos de personas, equipos y áreas con seguimiento.',
    group: 'Personas',
    icon: 'ShieldAlert',
    route: '/dashboard/riesgos',
    actions: ['read', 'write'],
    shortLabel: 'Riesgos',
    permissionNoun: 'riesgos',
    title: 'Centro de Riesgos',
    subtitle: 'Identificación y gestión de riesgos de personas, equipos y áreas.',
  },
  {
    key: 'reclutamiento',
    label: 'Reclutamiento',
    description: 'Vacantes, postulantes y el embudo de selección.',
    group: 'Personas',
    icon: 'UserSearch',
    route: '/dashboard/reclutamiento',
    actions: ['read', 'write'],
    title: 'Reclutamiento',
    subtitle: 'Vacantes abiertas, postulantes y avance del embudo de selección.',
  },
  {
    key: 'capacitacion',
    label: 'Capacitación',
    description: 'Cursos, inscripciones y certificados del equipo.',
    group: 'Personas',
    icon: 'GraduationCap',
    route: '/dashboard/capacitacion',
    actions: ['read', 'write'],
    title: 'Capacitación',
    subtitle: 'Cursos, inscripciones, asistencia y certificados del equipo.',
  },
  {
    key: 'desempeno',
    label: 'Desempeño',
    description: 'Ciclos de evaluación, objetivos y calificaciones.',
    group: 'Personas',
    icon: 'Target',
    route: '/dashboard/desempeno',
    actions: ['read', 'write'],
    title: 'Desempeño',
    subtitle: 'Ciclos de evaluación, objetivos y calificaciones por persona.',
  },
  {
    key: 'proyectos',
    label: 'Proyectos',
    description: 'Obras y trabajos en campo con estado, cliente y presupuesto.',
    group: 'Operación',
    icon: 'Kanban',
    route: '/dashboard/proyectos',
    actions: ['read', 'write'],
    title: 'Proyectos',
    subtitle: 'Gestión de proyectos de instalación, mantenimiento y expansión.',
  },
  {
    key: 'hseq',
    label: 'HSEQ',
    description: 'Seguridad, calidad y ambiente con acciones correctivas.',
    group: 'Operación',
    icon: 'ShieldCheck',
    route: '/dashboard/hseq',
    actions: ['read', 'write'],
    permissionNoun: 'HSEQ',
    title: 'HSEQ',
    subtitle: 'Reportes de seguridad, calidad y ambiente con seguimiento de acciones correctivas.',
  },
  {
    key: 'inventario',
    label: 'Inventario',
    description: 'Activos y existencias con asignación por persona.',
    group: 'Operación',
    icon: 'Package',
    route: '/dashboard/inventario',
    actions: ['read', 'write'],
    title: 'Inventario',
    subtitle: 'Activos, pedidos de compra y facturación.',
  },
  {
    key: 'mantenimiento',
    label: 'Mantenimiento',
    description: 'Órdenes de trabajo preventivas y correctivas sobre equipos.',
    group: 'Operación',
    icon: 'Wrench',
    route: '/dashboard/mantenimiento',
    actions: ['read', 'write'],
    title: 'Mantenimiento',
    subtitle: 'Órdenes de trabajo preventivas y correctivas sobre equipos y activos.',
  },
  {
    key: 'flota',
    label: 'Flota',
    description: 'Vehículos, servicios, combustible y documentos por vencer.',
    group: 'Operación',
    icon: 'Car',
    route: '/dashboard/flota',
    actions: ['read', 'write'],
    title: 'Flota',
    subtitle: 'Vehículos, servicios, consumo de combustible y documentos por vencer.',
  },
  {
    key: 'produccion',
    label: 'Producción',
    description: 'Órdenes de producción, avance por etapa y merma.',
    group: 'Operación',
    icon: 'Factory',
    route: '/dashboard/produccion',
    actions: ['read', 'write'],
    title: 'Producción',
    subtitle: 'Órdenes de producción, avance por etapa, rendimiento y merma.',
  },
  {
    key: 'trazabilidad',
    label: 'Trazabilidad',
    description: 'Registro de auditoría de toda la actividad de la cuenta.',
    group: 'Operación',
    icon: 'Activity',
    route: '/dashboard/trazabilidad',
    actions: ['read'],
    title: 'Trazabilidad',
    subtitle: 'Registro de auditoría de toda la actividad.',
  },
  {
    key: 'clientes',
    label: 'Clientes',
    description: 'Cuentas, contactos e interacciones comerciales.',
    group: 'Comercial',
    icon: 'Building2',
    route: '/dashboard/clientes',
    actions: ['read', 'write'],
    title: 'Clientes',
    subtitle: 'Cuentas, contactos e historial de interacciones comerciales.',
  },
  {
    key: 'cotizaciones',
    label: 'Cotizaciones',
    description: 'Propuestas comerciales, seguimiento y pipeline.',
    group: 'Comercial',
    icon: 'Receipt',
    route: '/dashboard/cotizaciones',
    actions: ['read', 'write'],
    title: 'Cotizaciones',
    subtitle: 'Genera propuestas comerciales, seguimiento de clientes y pipeline.',
  },
  {
    key: 'facturacion',
    label: 'Facturación',
    description: 'Facturas, pagos recibidos y cartera vencida.',
    group: 'Comercial',
    icon: 'DollarSign',
    route: '/dashboard/facturacion',
    actions: ['read', 'write'],
    title: 'Facturación',
    subtitle: 'Facturas emitidas, pagos recibidos y cartera vencida.',
  },
  {
    key: 'compras',
    label: 'Compras y órdenes',
    description: 'Requisiciones, aprobaciones y órdenes de compra.',
    group: 'Comercial',
    icon: 'ShoppingCart',
    route: '/dashboard/compras',
    actions: ['read', 'write'],
    shortLabel: 'Compras',
    permissionNoun: 'compras',
    title: 'Compras',
    subtitle: 'Solicitudes de compra, aprobaciones y órdenes en un solo lugar.',
    aliases: [
      {
        key: 'ordenes-compra', label: 'Órdenes Compra', icon: 'FileCheck2',
        route: '/dashboard/ordenes-compra', title: 'Órdenes de Compra',
        subtitle: 'Órdenes de compra generadas desde requisiciones aprobadas.',
      },
    ],
  },
  {
    key: 'catalogos',
    label: 'Catálogos',
    description: 'Productos, precios, costos y fichas técnicas.',
    group: 'Comercial',
    icon: 'Tag',
    route: '/dashboard/catalogos',
    actions: ['read', 'write'],
    title: 'Catálogos',
    subtitle: 'Productos, precios, costos y specs del inventario técnico.',
  },
  {
    key: 'caja',
    label: 'Caja',
    description: 'Turnos de caja, arqueo, ingresos y egresos del día.',
    group: 'Comercial',
    icon: 'Cashier',
    route: '/dashboard/caja',
    actions: ['read', 'write'],
    title: 'Caja',
    subtitle: 'Turnos de caja, arqueo del día e ingresos y egresos en efectivo.',
  },
  {
    key: 'pos',
    label: 'Punto de venta',
    description: 'Venta de mostrador: cobra, descuenta existencias y da recibo.',
    group: 'Comercial',
    icon: 'Store',
    route: '/dashboard/pos',
    actions: ['read', 'write'],
    shortLabel: 'POS',
    permissionNoun: 'ventas de mostrador',
    title: 'Punto de venta',
    subtitle: 'Venta de mostrador con descuento de existencias y cierre contra caja.',
  },
  {
    key: 'tienda',
    label: 'Tienda virtual',
    description: 'Catálogo de venta con carrito y generación de pedido.',
    group: 'Comercial',
    icon: 'LayoutGrid',
    route: '/dashboard/tienda',
    actions: ['read', 'write'],
    shortLabel: 'Tienda',
    permissionNoun: 'tienda',
    title: 'Tienda Virtual',
    subtitle: 'Catálogo de productos, precios y carrito virtual.',
  },
  {
    key: 'ecommerce',
    label: 'Ecommerce',
    description: 'Pedidos en línea, envíos y cupones de la tienda pública.',
    group: 'Comercial',
    icon: 'Truck',
    route: '/dashboard/ecommerce',
    actions: ['read', 'write'],
    title: 'Ecommerce',
    subtitle: 'Pedidos en línea, estado de envío y cupones de la tienda pública.',
  },
  {
    key: 'canales',
    label: 'Canales',
    description: 'Conversaciones del equipo por tema, obra o área.',
    group: 'Equipo',
    icon: 'MessageSquare',
    route: '/dashboard/canales',
    actions: ['read', 'write'],
    title: 'Canales',
    subtitle: 'Conversaciones por canal, asignación de proyectos y comunicación del equipo.',
  },
  {
    key: 'tickets',
    label: 'Tickets',
    description: 'Solicitudes internas por área: TI, Nómina, Personas, Legal.',
    group: 'Equipo',
    icon: 'Ticket',
    route: '/dashboard/tickets',
    actions: ['read', 'write'],
    title: 'Tickets',
    subtitle: 'Solicitudes de soporte por área: TI, Nómina, Personas, Finanzas y Legal.',
  },
  {
    key: 'firmas',
    label: 'Firmas',
    description: 'Envío de documentos a firma electrónica y su seguimiento.',
    group: 'Equipo',
    icon: 'PenLine',
    route: '/dashboard/firmas',
    actions: ['read', 'write'],
    title: 'Firmas',
    subtitle: 'Sube documentos y solicita firmas electrónicas.',
  },
  {
    key: 'documentos',
    label: 'Documentos',
    description: 'Repositorio documental con análisis por IA.',
    group: 'Equipo',
    icon: 'FileText',
    route: '/dashboard/documentos',
    actions: ['read', 'write'],
    title: 'Documentos',
    subtitle: 'Repositorio documental con análisis por IA.',
  },
  {
    key: 'contratos',
    label: 'Contratos',
    description: 'Vigencias, renovaciones y hitos de cada contrato.',
    // Commercial, not collaborative. A contract is what a quote becomes once
    // somebody says yes, and it sits next to Clientes and Facturación in every
    // conversation about it — it was under «Colaboración» because it involves
    // signatures, which is a description of one step, not of the thing.
    group: 'Comercial',
    icon: 'Handshake',
    route: '/dashboard/contratos',
    actions: ['read', 'write'],
    title: 'Contratos',
    subtitle: 'Vigencias, renovaciones, hitos y valor de cada contrato.',
  },
  {
    key: 'calendario',
    label: 'Calendario',
    description: 'Entrevistas, onboarding, 1:1s y sesiones de consultoría.',
    group: 'Equipo',
    icon: 'Calendar',
    route: '/dashboard/calendario',
    actions: ['read', 'write'],
    title: 'Calendario',
    subtitle: 'Entrevistas, onboarding, 1:1s y sesiones de consultoría.',
  },
  {
    key: 'consultoria',
    label: 'Consultoría',
    description: 'Asesoría laboral y de cumplimiento.',
    group: 'Equipo',
    icon: 'BookOpen',
    route: '/dashboard/consultoria',
    actions: ['read', 'write'],
    title: 'Consultoría',
    subtitle: 'Asesoría laboral y de cumplimiento.',
  },
  {
    key: 'ia',
    label: 'Asistente de IA',
    description: 'Consulta en lenguaje natural sobre los datos de la cuenta.',
    group: 'Equipo',
    icon: 'Sparkles',
    route: '/dashboard/ia',
    actions: ['use'],
    permissionLabels: { use: 'Usar el asistente de IA' },
    title: 'Asistente IA',
    subtitle: 'Chat inteligente con acceso a los datos de tu organización.',
  },
  {
    key: 'pacientes',
    label: 'Pacientes',
    description: 'Historia clínica, consultas y seguimiento asistencial.',
    group: 'Sectoriales',
    icon: 'Stethoscope',
    route: '/dashboard/pacientes',
    actions: ['read', 'write'],
    title: 'Pacientes',
    subtitle: 'Historia clínica, consultas y seguimiento asistencial.',
  },
  {
    key: 'estudiantes',
    label: 'Estudiantes',
    description: 'Matrículas, programas académicos y calificaciones.',
    group: 'Sectoriales',
    icon: 'School',
    route: '/dashboard/estudiantes',
    actions: ['read', 'write'],
    title: 'Estudiantes',
    subtitle: 'Matrículas, programas académicos, asistencia y calificaciones.',
  },
  {
    key: 'restaurante',
    label: 'Restaurante',
    description: 'Menú, mesas y comandas del servicio en salón.',
    group: 'Sectoriales',
    icon: 'Restaurant',
    route: '/dashboard/restaurante',
    actions: ['read', 'write'],
    title: 'Restaurante',
    subtitle: 'Menú, mesas y comandas del servicio en salón.',
  },
  {
    key: 'agro',
    label: 'Agro',
    description: 'Lotes, ciclos de cultivo y cosechas por hectárea.',
    group: 'Sectoriales',
    icon: 'Sprout',
    route: '/dashboard/agro',
    actions: ['read', 'write'],
    title: 'Agro',
    subtitle: 'Lotes, ciclos de cultivo, labores y cosechas por hectárea.',
  },
  {
    key: 'inmobiliario',
    label: 'Inmobiliario',
    description: 'Inmuebles, contratos de arriendo y recaudo mensual.',
    group: 'Sectoriales',
    icon: 'Home',
    route: '/dashboard/inmobiliario',
    actions: ['read', 'write'],
    permissionNoun: 'inmuebles',
    title: 'Inmuebles',
    subtitle: 'Inmuebles, contratos de arriendo, inquilinos y recaudo mensual.',
  },
  {
    key: 'hoteleria',
    label: 'Hotelería',
    description: 'Habitaciones, reservas y ocupación por noche.',
    group: 'Sectoriales',
    icon: 'Bed',
    route: '/dashboard/hoteleria',
    actions: ['read', 'write'],
    title: 'Hotelería',
    subtitle: 'Habitaciones, reservas, ocupación y tarifas por noche.',
  },
  {
    key: 'socios',
    label: 'Socios',
    description: 'Socios, membresías, clases, reservas y control de entrada.',
    group: 'Sectoriales',
    icon: 'UserCheck',
    route: '/dashboard/socios',
    actions: ['read', 'write'],
    permissionNoun: 'socios',
    title: 'Socios',
    subtitle: 'Socios, membresías vigentes, clases y entradas al centro.',
  },
  {
    key: 'tiempos',
    label: 'Tiempos',
    description: 'Horas facturables por persona, proyecto y tarifa.',
    group: 'Operación',
    icon: 'Clock',
    route: '/dashboard/tiempos',
    actions: ['read', 'write'],
    permissionNoun: 'horas registradas',
    title: 'Tiempos',
    subtitle: 'Horas por persona y proyecto, facturables a una tarifa.',
  },
  {
    key: 'configuracion',
    label: 'Configuración',
    description: 'Preferencias de la cuenta, módulos, roles y permisos.',
    group: null,
    // No icon: Configuración is not a nav item. It is reachable from the user
    // menu (and by direct route), while `group: null` marks it as unswitchable
    // shell — the screen that decides which modules the whole company sees and
    // what each role may open cannot itself be switched off.
    icon: null,
    route: '/dashboard/configuracion',
    actions: ['read', 'manage'],
    permissionLabels: { manage: 'Administrar la organización' },
    title: 'Configuración',
    subtitle: 'Preferencias de tu cuenta y de la organización.',
  },
]

/**
 * The shell: always on, owned by no plan and by no toggle.
 *
 * Derived from `group === null` rather than listed separately, so a module
 * cannot be core in one place and switchable in another.
 */
export const CORE_MODULES = REGISTRY.filter((m) => m.group === null).map((m) => m.key)

/** Switchable modules — everything that is not the shell. */
export const SWITCHABLE = REGISTRY.filter((m) => m.group !== null)

export function registryEntry(key: string): ModuleEntry | null {
  return REGISTRY.find((m) => m.key === key) ?? null
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Dependencies
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface ModuleDependency {
  module: string
  requires: string
  /**
   * `hard` — the module does not work without it, so enabling one enables both
   *          and disabling the dependency is refused while the dependent is on.
   * `soft` — it works, but badly enough to be worth offering. The screen
   *          proposes it, pre-ticked, and the customer may untick it. That
   *          difference is the whole reason there are two kinds: a product that
   *          treats every relationship as mandatory ends up switching on
   *          modules nobody asked for.
   */
  kind: 'hard' | 'soft'
}

/**
 * Mirrors the seed in migration 29. Pinned against it by registry.test.ts, for
 * the same reason `plan_limits` is: two copies of a rule, both consulted, is a
 * rule that can disagree with itself.
 */
export const MODULE_DEPENDENCIES: readonly ModuleDependency[] = [
  { module: 'tienda', requires: 'catalogos', kind: 'hard' },
  { module: 'tienda', requires: 'inventario', kind: 'soft' },
  { module: 'ecommerce', requires: 'tienda', kind: 'hard' },

  // `invoices.client_id` is nullable and `client_name` carries a walk-in
  // customer, so a restaurant can bill without keeping a client directory.
  // The schema already said this; declaring it hard was the mistake.
  { module: 'facturacion', requires: 'clientes', kind: 'soft' },
  { module: 'cotizaciones', requires: 'clientes', kind: 'soft' },
  { module: 'cotizaciones', requires: 'catalogos', kind: 'soft' },
  { module: 'contratos', requires: 'clientes', kind: 'soft' },

  { module: 'nomina', requires: 'empleados', kind: 'hard' },
  { module: 'asistencia', requires: 'empleados', kind: 'hard' },
  { module: 'desempeno', requires: 'empleados', kind: 'hard' },
  { module: 'capacitacion', requires: 'empleados', kind: 'soft' },
  { module: 'reclutamiento', requires: 'empleados', kind: 'soft' },
  { module: 'tiempos', requires: 'empleados', kind: 'soft' },
  { module: 'tiempos', requires: 'proyectos', kind: 'soft' },

  { module: 'produccion', requires: 'inventario', kind: 'hard' },
  { module: 'produccion', requires: 'catalogos', kind: 'soft' },
  { module: 'mantenimiento', requires: 'inventario', kind: 'soft' },
  { module: 'flota', requires: 'mantenimiento', kind: 'soft' },

  { module: 'restaurante', requires: 'catalogos', kind: 'soft' },
  { module: 'restaurante', requires: 'inventario', kind: 'soft' },
  { module: 'hoteleria', requires: 'clientes', kind: 'soft' },
  { module: 'inmobiliario', requires: 'contratos', kind: 'soft' },
  { module: 'pacientes', requires: 'calendario', kind: 'soft' },
  { module: 'estudiantes', requires: 'calendario', kind: 'soft' },

  // A till with nothing to sell is an empty drawer, so the catalogue is hard.
  // Selling *without* opening a till is legitimate — a spa that charges by
  // transfer never counts cash — so that one is soft and merely proposed.
  { module: 'pos', requires: 'catalogos', kind: 'hard' },
  { module: 'pos', requires: 'caja', kind: 'soft' },
  { module: 'pos', requires: 'inventario', kind: 'soft' },

  // A class is scheduled and a membership is billed. Both soft: a studio can
  // run on the class timetable alone before it starts charging through Kigyo,
  // and refusing to switch Socios on until it also takes Facturación would be
  // the product telling a gym how to sell.
  { module: 'socios', requires: 'calendario', kind: 'soft' },
  { module: 'socios', requires: 'facturacion', kind: 'soft' },
]

/** What a module needs, at the given strength. */
export function dependenciesOf(module: string, kind?: 'hard' | 'soft'): string[] {
  return MODULE_DEPENDENCIES.filter(
    (d) => d.module === module && (kind === undefined || d.kind === kind),
  ).map((d) => d.requires)
}

/** Which enabled modules would break if this one were switched off. */
export function dependentsOf(module: string, enabled: ReadonlySet<string>): string[] {
  return MODULE_DEPENDENCIES.filter(
    (d) => d.requires === module && d.kind === 'hard' && enabled.has(d.module),
  ).map((d) => d.module)
}

/**
 * Everything a selection needs but does not include, following hard
 * dependencies transitively.
 *
 * Transitive because they chain: `ecommerce` needs `tienda`, which needs
 * `catalogos`. Resolving one level would accept a selection that is still
 * incoherent — a storefront with nothing in it — and the customer would find
 * out by opening an empty screen.
 */
export function missingHardDependencies(selection: Iterable<string>): string[] {
  const have = new Set(selection)
  const missing = new Set<string>()
  const queue = [...have]

  while (queue.length > 0) {
    const key = queue.pop() as string
    for (const required of dependenciesOf(key, 'hard')) {
      if (have.has(required) || missing.has(required)) continue
      missing.add(required)
      queue.push(required)
    }
  }
  return [...missing]
}
