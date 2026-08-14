// ─── Domain models ───────────────────────────────────────────────────────────

export type StatusTone = 'grn' | 'amb' | 'red' | 'neu' | 'blu' | 'vio'
export type Priority = 'Alta' | 'Media' | 'Baja'

export interface Empleado {
  id: number
  name: string
  role: string
  dept: string
  loc: string
  st: string
  perm: string
  manager?: string
}

export interface Firma {
  id: number
  name: string
  who: string
  type: string
  st: string
  date: string
  days?: number
}

export interface Activo {
  id: number
  item: string
  cat: string
  who: string
  serial: string
  st: string
  date: string
}

export interface ItemFactura {
  activo: string
  cant: number
  precio: number
}

export interface Factura {
  id: number
  proveedor: string
  fecha: string
  st: string
  items: ItemFactura[]
}

export interface Pedido {
  id: number
  item: string
  proveedor: string
  cant: number
  precioEst: number
  fecha: string
  st: string
  quien: string
}

export interface Documento {
  id: number
  name: string
  type: string
  dept: string
  date: string
  st: string
  tags: string[]
  owner: string
  aiTag?: boolean
}

export interface Consulta {
  id: number
  q: string
  cat: string
  r: string
  fecha: string
}

export interface Ticket {
  id: number
  title: string
  area: string
  prio: Priority
  st: string
  req: string
  date: string
  tags: string[]
  assigned?: string
}

export interface Meeting {
  id: number
  title: string
  type: string
  day: string
  time: string
  dur: string
  with: string[]
  loc: string
}

export interface Riesgo {
  id: number
  tipo: string
  empleado: string
  area: string
  sev: string
  detalle: string
  accion: string
}

export interface HealthFactor {
  nombre: string
  score: number
  tone: StatusTone
}

export interface Recomendacion {
  id: number
  prioridad: string
  cat: string
  titulo: string
  razon: string
  tone: StatusTone
}

export interface SkillLevel {
  [skill: string]: number
}

export interface SucesionReady {
  name: string
  score: number
}

export interface Sucesion {
  rol: string
  titular: string
  critico: boolean
  ready: SucesionReady[]
}

export interface JourneyEvent {
  date: string
  ev: string
  tag: string
  tone: StatusTone
}

export interface JourneyStage {
  key: string
  label: string
  icon: string
  color: string
  count: number
}

export interface RotationRisk {
  name: string
  riesgo: number
  factores: string[]
}

export interface BenchArea {
  area: string
  desempeno: number
  clima: number
  rotacion: number
  capacitacion: number
}

export interface Vacante {
  id: number
  rol: string
  dept: string
  tipo: string
  st: string
  apps: number
}

export interface Candidato {
  id: number
  name: string
  rol: string
  stage: string
  score: number
  src: string
}

export interface Salida {
  id: number
  name: string
  dept: string
  motivo: string
  date: string
}

export interface RotacionArea {
  area: string
  rate: number
  prev: number
}

export interface Ausencia {
  id: number
  name: string
  type: string
  from: string
  to: string
  days: number
  st: string
}

export interface Vacacion {
  id: number
  name: string
  from: string
  to: string
  days: number
  st: string
  saldo: number
}

export interface NominaArea {
  area: string
  total: number
  emp: number
  avg: number
}

export interface Beneficio {
  id: number
  name: string
  tipo: string
  costo: number
  cov: number
}

export interface Evaluacion {
  id: number
  name: string
  evaluator: string
  score: number
  date: string
  st: string
}

export interface Curso {
  id: number
  name: string
  cat: string
  dur: string
  enrolled: number
  comp: number
}

export interface Certificacion {
  id: number
  name: string
  provider: string
  emp: string
  date: string
}

export interface Encuesta {
  id: number
  name: string
  resp: number
  score: number
  date: string
}

export interface HeatmapCell {
  day: number
  level: 0 | 1 | 2 | 3 | 4
  val: number
  empty?: boolean
}

export interface ActividadMes {
  mes: string
  val: number
}

export interface EventoTimeline {
  group: string
  items: EventoItem[]
}

export interface EventoItem {
  icon: string
  txt: string
  time: string
  color: string
}

// ─── App state ───────────────────────────────────────────────────────────────

export type ToastType = 'ok' | 'err' | 'info' | 'warn'

export interface Toast {
  id: number
  type: ToastType
  msg: string
  action?: string
  onAction?: () => void
}

// `Role` used to live here as a three-value union. Nothing imported it, and
// since migration 24 roles are rows the organization creates — see `RoleKey`
// and `SYSTEM_ROLES` in src/lib/auth/permissions.ts. Leaving a closed union
// here would be an invitation to reach for it and rediscover, at runtime, that
// «Médico» is a role too.

export interface Permission {
  label: string
  sub?: string
}

export type PermissionsMap = Record<string, Record<string, boolean>>

// ─── Navigation ──────────────────────────────────────────────────────────────

export interface NavItem {
  key: string
  label: string
  icon: string
  badge?: string | number
  badgeTone?: 'a' | 'g' | 'r'
  /**
   * Routes that belong to this one and are indented under it.
   *
   * `ordenes-compra` is the only case today. It is a second screen of Compras,
   * gated on the same permission, and it used to sit beside its parent as a
   * top-level entry — two lines for one module, which read as two features.
   */
  children?: Array<{ key: string; label: string; icon: string }>
}

export interface NavSection {
  label?: string
  items: NavItem[]
}

// ─── Notification ────────────────────────────────────────────────────────────

export interface Notif {
  icon: string
  tone: StatusTone
  title: string
  body: string
  time: string
}

// ─── Simulation ──────────────────────────────────────────────────────────────

export interface SimResult {
  label: string
  value: string
  delta: string
  dir: 'up' | 'dn' | 'neu'
  tone: StatusTone
}
