/**
 * The enumerated vocabularies the database `check` constraints enforce.
 *
 * These live here rather than beside the queries that read them because both
 * sides of the app need them: a Server Function validates against them, and a
 * client renders them as chips, tabs and selects. The query modules import
 * `server-only`, so a client pulling a status list out of one dragged
 * `next/headers` into the browser bundle and failed the build.
 *
 * Every list below must match the corresponding `check (... in (...))` in
 * supabase/migrations. A value here that the column rejects surfaces as an
 * opaque constraint violation at insert time; a value the column allows but
 * that is missing here simply cannot be chosen.
 */

/* ─── projects ─────────────────────────────────────────────────────────── */
export const PROJECT_STATUSES = [
  'Planificación', 'En ejecución', 'En pausa', 'Finalizado', 'Cancelado',
] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const PROJECT_KINDS = [
  'Instalación', 'Mantenimiento', 'Ampliación', 'Diagnóstico', 'Otro',
] as const
export type ProjectKind = (typeof PROJECT_KINDS)[number]

/* ─── tickets ──────────────────────────────────────────────────────────── */
export const TICKET_AREAS = [
  'TI', 'Nómina', 'Personas', 'Finanzas', 'Legal', 'Contratos', 'Onboarding',
  'Permisos', 'Capacitación', 'Administración', 'Beneficios', 'Otro',
] as const
export type TicketArea = (typeof TICKET_AREAS)[number]

export const TICKET_PRIORITIES = ['Alta', 'Media', 'Baja'] as const
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

export const TICKET_STATUSES = ['Abierto', 'En proceso', 'Resuelto', 'Cerrado'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

/* ─── employees ────────────────────────────────────────────────────────── */
export const EMPLOYEE_STATUSES = [
  'Activo', 'Inactivo', 'Onboarding', 'En licencia', 'Salida',
] as const
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number]

export const EMPLOYMENT_TYPES = [
  'Tiempo completo', 'Medio tiempo', 'Contrato', 'Prácticas',
] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

/* ─── absences ─────────────────────────────────────────────────────────── */
export const ABSENCE_KINDS = [
  'Vacaciones', 'Incapacidad', 'Permiso', 'Licencia', 'Cita médica', 'Otro',
] as const
export type AbsenceKind = (typeof ABSENCE_KINDS)[number]

export const ABSENCE_STATUSES = [
  'Programada', 'Activa', 'Finalizada', 'Resuelta', 'Rechazada',
] as const
export type AbsenceStatus = (typeof ABSENCE_STATUSES)[number]

/* ─── payroll ──────────────────────────────────────────────────────────── */
export const PAYROLL_STATUSES = ['Borrador', 'En revisión', 'Aprobada', 'Pagada'] as const
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number]

/* ─── risks ────────────────────────────────────────────────────────────── */
export const RISK_CATEGORIES = [
  'Contractual', 'Operacional', 'Cumplimiento', 'Financiero', 'Técnico', 'HSE',
  'Rotación', 'Desempeño', 'Sucesión', 'Salud', 'Legal', 'Otro',
] as const
export type RiskCategory = (typeof RISK_CATEGORIES)[number]

export const RISK_SEVERITIES = ['Alta', 'Media', 'Baja'] as const
export type RiskSeverity = (typeof RISK_SEVERITIES)[number]

export const RISK_STATUSES = ['Abierto', 'Mitigado', 'Cerrado'] as const
export type RiskStatus = (typeof RISK_STATUSES)[number]

/* ─── calendar ─────────────────────────────────────────────────────────── */
export const EVENT_KINDS = [
  'Interna', '1:1', 'Entrevista', 'Onboarding', 'Consultoría', 'Reclutamiento',
  'Confidencial', 'Otro',
] as const
export type EventKind = (typeof EVENT_KINDS)[number]

/* ─── products ─────────────────────────────────────────────────────────── */
export const PRODUCT_UNITS = ['UN', 'KIT', 'RL', 'KW', 'SERV', 'M', 'HR'] as const
export type ProductUnit = (typeof PRODUCT_UNITS)[number]

/* ─── quotes ───────────────────────────────────────────────────────────── */
export const QUOTE_KINDS = ['Comercial', 'Rural', 'Industrial', 'Residencial'] as const
export type QuoteKind = (typeof QUOTE_KINDS)[number]

export const QUOTE_STATUSES = [
  'Borrador', 'Enviada', 'Aceptada', 'Rechazada', 'Vencida',
] as const
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

/* ─── purchasing ───────────────────────────────────────────────────────── */
export const PURCHASE_CATEGORIES = ['Materiales', 'Servicios', 'Logística', 'Otro'] as const
export type PurchaseCategory = (typeof PURCHASE_CATEGORIES)[number]

export const PURCHASE_REQUEST_STATUSES = [
  'Borrador', 'Pendiente', 'Aprobada', 'Rechazada', 'OC generada',
] as const
export type PurchaseRequestStatus = (typeof PURCHASE_REQUEST_STATUSES)[number]

export const PURCHASE_URGENCIES = ['Alta', 'Normal', 'Baja'] as const
export type PurchaseUrgency = (typeof PURCHASE_URGENCIES)[number]

export const PURCHASE_ORDER_STATUSES = [
  'Pendiente', 'Aprobada', 'Recibida', 'Cancelada',
] as const
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number]

/* ─── inventory ────────────────────────────────────────────────────────── */
export const ASSET_CATEGORIES = [
  'Cómputo', 'Monitor', 'Móvil', 'Tablet', 'Periférico', 'Mobiliario',
  'Herramientas', 'Vehículos', 'Electrónica', 'Otro',
] as const
export type AssetCategory = (typeof ASSET_CATEGORIES)[number]

export const ASSET_STATUSES = ['Asignado', 'Disponible', 'Mantenimiento', 'Baja'] as const
export type AssetStatus = (typeof ASSET_STATUSES)[number]

export const INVENTORY_ORDER_STATUSES = [
  'Solicitado', 'Aprobado', 'En tránsito', 'Facturado', 'Cancelado',
] as const
export type InventoryOrderStatus = (typeof INVENTORY_ORDER_STATUSES)[number]

/* ─── HSEQ ─────────────────────────────────────────────────────────────── */
export const HSEQ_CATEGORIES = ['Seguridad', 'Calidad', 'Ambiente'] as const
export type HseqCategory = (typeof HSEQ_CATEGORIES)[number]

export const HSEQ_KINDS = ['Incidente', 'Permiso', 'Hallazgo', 'Auditoría'] as const
export type HseqKind = (typeof HSEQ_KINDS)[number]

export const HSEQ_STATUSES = ['Pendiente', 'En curso', 'Cerrado'] as const
export type HseqStatus = (typeof HSEQ_STATUSES)[number]

export const HSEQ_PRIORITIES = ['Alta', 'Media', 'Baja'] as const
export type HseqPriority = (typeof HSEQ_PRIORITIES)[number]

/**
 * Four levels where `priority` has three, on purpose. How bad the event was
 * and how urgently it needs following up are different questions — the mock
 * conflated them into one field and lost the distinction.
 */
export const HSEQ_SEVERITIES = ['Crítica', 'Alta', 'Media', 'Baja'] as const
export type HseqSeverity = (typeof HSEQ_SEVERITIES)[number]

/* ─── documents ────────────────────────────────────────────────────────── */
export const DOCUMENT_KINDS = [
  'Contrato', 'Política', 'Acta', 'Plan', 'Manual', 'Anexo', 'Otro',
] as const
export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

export const DOCUMENT_STATUSES = ['Vigente', 'Borrador', 'Archivado', 'Vencido'] as const
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]

/* ─── signatures ───────────────────────────────────────────────────────── */
export const SIGNATURE_KINDS = [
  'Contrato', 'NDA', 'Política', 'Anexo', 'Adenda', 'Acuerdo', 'Terminación', 'Otro',
] as const
export type SignatureKind = (typeof SIGNATURE_KINDS)[number]

export const SIGNATURE_STATUSES = ['Pendiente', 'Firmado', 'Vencido', 'Cancelado'] as const
export type SignatureStatus = (typeof SIGNATURE_STATUSES)[number]

/* ─── consultations ────────────────────────────────────────────────────── */
export const CONSULTATION_CATEGORIES = [
  'Regulatorio', 'Normativo', 'Contractual', 'Laboral', 'Otro',
] as const
export type ConsultationCategory = (typeof CONSULTATION_CATEGORIES)[number]

export const CONSULTATION_STATUSES = [
  'Agendada', 'En curso', 'Resuelta', 'Cancelada',
] as const
export type ConsultationStatus = (typeof CONSULTATION_STATUSES)[number]

/* ═══════════════════════════════════════════════════════════════════════
   Shared calculations
   ═══════════════════════════════════════════════════════════════════════
   Rules both sides need to agree on. Written once here rather than twice —
   the client shows the figure while the user types and the server stores it,
   and a form that previews one number and saves another is worse than one
   that previews nothing.
   ═════════════════════════════════════════════════════════════════════ */

/**
 * Inclusive whole days between two ISO dates.
 *
 * A one-day permission is 1, not 0 — this is the count that gets debited from
 * a vacation balance, so an off-by-one here is a day of somebody's holiday.
 * Parsed as UTC on purpose: `new Date('2026-06-01')` is UTC midnight but
 * `new Date('2026-06-01T00:00:00')` is *local*, and mixing the two makes the
 * span shift by a day either side of a timezone offset.
 */
export function dayCount(startsOn: string, endsOn: string): number {
  const from = Date.parse(`${startsOn}T00:00:00Z`)
  const to = Date.parse(`${endsOn}T00:00:00Z`)
  if (Number.isNaN(from) || Number.isNaN(to)) return 0
  const days = Math.round((to - from) / 86_400_000) + 1
  // A reversed range is a validation error, not a negative quantity of days.
  return days > 0 ? days : 0
}

/**
 * One line of a quote, requisition or order, in cents.
 *
 * Rounded per line before it is summed. Quantities are `numeric(12,2)`, so a
 * fractional quantity times a cents price is not an integer, and summing the
 * unrounded products then rounding once gives a total that disagrees with the
 * lines printed above it.
 */
export function lineTotalCents(quantity: number, unitPriceCents: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPriceCents)) return 0
  return Math.round(quantity * unitPriceCents)
}

/** Sum of `lineTotalCents` over a set of lines. */
export function sumLinesCents(
  lines: ReadonlyArray<{ quantity: number; unitPriceCents: number }>,
): number {
  return lines.reduce((sum, l) => sum + lineTotalCents(l.quantity, l.unitPriceCents), 0)
}

/**
 * Pesos typed into a form → cents for the column.
 *
 * Every amount in this schema is a `bigint` of minor units. Multiplying a
 * float by 100 without rounding is how `210000000.00000001` reaches a bigint
 * column and the insert fails with a type error nobody can read.
 */
export function pesosToCents(input: string | number): number {
  const value = typeof input === 'number' ? input : Number(input)
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.round(value * 100)
}

/**
 * An asset is 'Asignado' if and only if somebody holds it.
 *
 * Mirrors the `inventory_assets_assignment_consistent` check. Deriving the
 * status from the holder rather than accepting both from the client means the
 * pair cannot contradict, and the constraint never surfaces as an opaque
 * violation.
 */
export function assetStatusFor(
  employeeId: string | null,
  requested?: string,
): AssetStatus {
  if (employeeId) return 'Asignado'
  if (requested && requested !== 'Asignado' && (ASSET_STATUSES as readonly string[]).includes(requested)) {
    return requested as AssetStatus
  }
  return 'Disponible'
}

/**
 * A finished project sits at 100%, a planned one at 0.
 *
 * Returns the problem, or null when the pair is coherent. The progress bar and
 * the status chip are read as one fact by anyone looking at the row, so the
 * database having no opinion here does not make them independent.
 */
export function projectStateError(status: string, progress: number): string | null {
  if (status === 'Finalizado' && progress !== 100) {
    return 'Un proyecto finalizado debe quedar al 100 %.'
  }
  if (status === 'Planificación' && progress > 0) {
    return 'Un proyecto en planificación todavía no puede tener avance.'
  }
  return null
}

/** Two date ranges overlap when each starts before the other ends. */
export function rangesOverlap(
  aStart: string, aEnd: string, bStart: string, bEnd: string,
): boolean {
  return aStart <= bEnd && aEnd >= bStart
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Modules added alongside the sector catalogue.
 *
 * Same contract as everything above: each list must match the corresponding
 * `check (... in (...))` in supabase/migrations/…_15_sector_modules.sql. The
 * accents matter — the constraint compares the literal string, so 'Diesel' is
 * rejected where 'Diésel' is stored.
 * ═══════════════════════════════════════════════════════════════════════════ */

/* ─── clients (CRM) ────────────────────────────────────────────────────── */
export const CLIENT_KINDS = [
  'Empresa', 'Persona natural', 'Entidad pública', 'Otro',
] as const
export type ClientKind = (typeof CLIENT_KINDS)[number]

export const CLIENT_STATUSES = ['Prospecto', 'Activo', 'Inactivo', 'Perdido'] as const
export type ClientStatus = (typeof CLIENT_STATUSES)[number]

export const INTERACTION_KINDS = [
  'Llamada', 'Correo', 'Reunión', 'Visita', 'Nota',
] as const
export type InteractionKind = (typeof INTERACTION_KINDS)[number]

/* ─── invoices ─────────────────────────────────────────────────────────── */
export const INVOICE_STATUSES = [
  'Borrador', 'Emitida', 'Pagada', 'Vencida', 'Anulada',
] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const PAYMENT_METHODS = [
  'Transferencia', 'Efectivo', 'Tarjeta', 'Cheque', 'Otro',
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/* ─── contracts ────────────────────────────────────────────────────────── */
export const CONTRACT_KINDS = [
  'Cliente', 'Proveedor', 'Laboral', 'Arrendamiento', 'Confidencialidad', 'Otro',
] as const
export type ContractKind = (typeof CONTRACT_KINDS)[number]

export const CONTRACT_STATUSES = [
  'Borrador', 'Vigente', 'Por vencer', 'Vencido', 'Terminado',
] as const
export type ContractStatus = (typeof CONTRACT_STATUSES)[number]

/* ─── recruiting ───────────────────────────────────────────────────────── */
export const OPENING_STATUSES = [
  'Abierta', 'En proceso', 'Cerrada', 'Cancelada',
] as const
export type OpeningStatus = (typeof OPENING_STATUSES)[number]

/**
 * Ordered on purpose: the board renders one column per stage in this order and
 * the funnel KPI counts everything at or past a stage by index. Reordering
 * this array reorders the pipeline.
 */
export const CANDIDATE_STAGES = [
  'Postulado', 'Preselección', 'Entrevista', 'Prueba', 'Oferta', 'Contratado', 'Descartado',
] as const
export type CandidateStage = (typeof CANDIDATE_STAGES)[number]

/* ─── training ─────────────────────────────────────────────────────────── */
export const COURSE_MODES = ['Presencial', 'Virtual', 'Mixto'] as const
export type CourseMode = (typeof COURSE_MODES)[number]

export const ENROLLMENT_STATUSES = [
  'Inscrito', 'En curso', 'Aprobado', 'Reprobado', 'Cancelado',
] as const
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number]

/* ─── performance ──────────────────────────────────────────────────────── */
export const CYCLE_STATUSES = [
  'Planificado', 'Abierto', 'En calibración', 'Cerrado',
] as const
export type CycleStatus = (typeof CYCLE_STATUSES)[number]

/**
 * The review lives in `evaluations`, which predates this module. Its original
 * three states are kept and 'Calibrada' added, so migration 15 could widen the
 * check constraint without rewriting a single existing row.
 */
export const REVIEW_STATUSES = [
  'Pendiente', 'En revisión', 'Completada', 'Calibrada',
] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export const GOAL_STATUSES = [
  'En progreso', 'Cumplido', 'No cumplido', 'Cancelado',
] as const
export type GoalStatus = (typeof GOAL_STATUSES)[number]

/* ─── maintenance ──────────────────────────────────────────────────────── */
export const WORK_ORDER_KINDS = [
  'Preventivo', 'Correctivo', 'Predictivo', 'Mejora',
] as const
export type WorkOrderKind = (typeof WORK_ORDER_KINDS)[number]

export const WORK_ORDER_STATUSES = [
  'Abierta', 'Programada', 'En ejecución', 'Completada', 'Cancelada',
] as const
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number]

export const WORK_ORDER_PRIORITIES = ['Alta', 'Media', 'Baja'] as const
export type WorkOrderPriority = (typeof WORK_ORDER_PRIORITIES)[number]

/* ─── fleet ────────────────────────────────────────────────────────────── */
export const VEHICLE_KINDS = [
  'Automóvil', 'Camioneta', 'Camión', 'Motocicleta', 'Maquinaria', 'Otro',
] as const
export type VehicleKind = (typeof VEHICLE_KINDS)[number]

export const VEHICLE_STATUSES = [
  'Disponible', 'En ruta', 'En taller', 'Fuera de servicio', 'Dado de baja',
] as const
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number]

export const FUEL_KINDS = [
  'Gasolina', 'Diésel', 'Gas', 'Eléctrico', 'Híbrido',
] as const
export type FuelKind = (typeof FUEL_KINDS)[number]

/* ─── production ───────────────────────────────────────────────────────── */
export const PRODUCTION_STATUSES = [
  'Planificada', 'En proceso', 'En pausa', 'Terminada', 'Cancelada',
] as const
export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number]

/* ─── ecommerce ────────────────────────────────────────────────────────── */
export const ONLINE_ORDER_STATUSES = [
  'Nuevo', 'Pagado', 'En preparación', 'Enviado', 'Entregado', 'Cancelado', 'Devuelto',
] as const
export type OnlineOrderStatus = (typeof ONLINE_ORDER_STATUSES)[number]

export const SHIPPING_METHODS = [
  'Domicilio', 'Recoge en tienda', 'Mensajería', 'Otro',
] as const
export type ShippingMethod = (typeof SHIPPING_METHODS)[number]

/* ─── patients ─────────────────────────────────────────────────────────── */
export const PATIENT_STATUSES = ['Activo', 'Inactivo', 'Egresado'] as const
export type PatientStatus = (typeof PATIENT_STATUSES)[number]

export const VISIT_KINDS = [
  'Consulta', 'Control', 'Urgencia', 'Procedimiento', 'Teleconsulta',
] as const
export type VisitKind = (typeof VISIT_KINDS)[number]

export const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] as const
export type BloodType = (typeof BLOOD_TYPES)[number]

/* ─── students ─────────────────────────────────────────────────────────── */
export const STUDENT_STATUSES = [
  'Activo', 'Retirado', 'Graduado', 'Suspendido',
] as const
export type StudentStatus = (typeof STUDENT_STATUSES)[number]

export const ACADEMIC_ENROLLMENT_STATUSES = [
  'Inscrito', 'Cursando', 'Aprobado', 'Reprobado', 'Retirado',
] as const
export type AcademicEnrollmentStatus = (typeof ACADEMIC_ENROLLMENT_STATUSES)[number]

/* ─── restaurant ───────────────────────────────────────────────────────── */
export const MENU_CATEGORIES = [
  'Entrada', 'Plato fuerte', 'Postre', 'Bebida', 'Cóctel', 'Otro',
] as const
export type MenuCategory = (typeof MENU_CATEGORIES)[number]

export const TABLE_STATUSES = [
  'Libre', 'Ocupada', 'Reservada', 'Fuera de servicio',
] as const
export type TableStatus = (typeof TABLE_STATUSES)[number]

export const RESTAURANT_ORDER_STATUSES = [
  'Abierta', 'En cocina', 'Servida', 'Pagada', 'Anulada',
] as const
export type RestaurantOrderStatus = (typeof RESTAURANT_ORDER_STATUSES)[number]

/* ─── agriculture ──────────────────────────────────────────────────────── */
export const LOT_STATUSES = [
  'Disponible', 'Sembrado', 'En cosecha', 'En descanso',
] as const
export type LotStatus = (typeof LOT_STATUSES)[number]

export const CROP_CYCLE_STATUSES = [
  'Planificado', 'Sembrado', 'En crecimiento', 'Cosechado', 'Perdido',
] as const
export type CropCycleStatus = (typeof CROP_CYCLE_STATUSES)[number]

/* ─── real estate ──────────────────────────────────────────────────────── */
export const PROPERTY_KINDS = [
  'Apartamento', 'Casa', 'Oficina', 'Local', 'Bodega', 'Lote',
] as const
export type PropertyKind = (typeof PROPERTY_KINDS)[number]

export const PROPERTY_STATUSES = [
  'Disponible', 'Arrendado', 'En mantenimiento', 'Vendido',
] as const
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number]

export const LEASE_STATUSES = [
  'Activo', 'Por vencer', 'Terminado', 'En mora',
] as const
export type LeaseStatus = (typeof LEASE_STATUSES)[number]

/* ─── hospitality ──────────────────────────────────────────────────────── */
export const ROOM_KINDS = ['Sencilla', 'Doble', 'Triple', 'Suite', 'Familiar'] as const
export type RoomKind = (typeof ROOM_KINDS)[number]

export const ROOM_STATUSES = [
  'Disponible', 'Ocupada', 'Limpieza', 'Mantenimiento', 'Bloqueada',
] as const
export type RoomStatus = (typeof ROOM_STATUSES)[number]

export const RESERVATION_STATUSES = [
  'Confirmada', 'Check-in', 'Check-out', 'Cancelada', 'No show',
] as const
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number]
