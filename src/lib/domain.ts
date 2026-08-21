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

/**
 * Quién ve un documento.
 *
 * «Pública» es pública *dentro de la empresa*, nunca en internet: el bucket
 * sigue siendo privado y cada descarga pasa por una URL firmada. La distinción
 * importa porque la palabra sugiere lo contrario.
 */
export const DOCUMENT_VISIBILITIES = ['Privada', 'Pública'] as const
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number]

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
/**
 * Today's date in the company's own zone, as `YYYY-MM-DD`.
 *
 * Every day cut in the app used to be `new Date().toISOString().slice(0, 10)`,
 * which is the date in **UTC** — the date wherever the server happens to be,
 * not the date the business is having. On a Vercel deployment serving Bogotá
 * (UTC-5, no DST) that rolls over at 19:00 local, so for the last five hours of
 * every day the product was a day ahead of its customer: "Ventas de hoy"
 * filtered `sold_at >= tomorrow` and showed zero through a restaurant's dinner
 * service, and every `..._on: today` write filed an evening's work under the
 * next day's date.
 *
 * `en-CA` because it formats as `YYYY-MM-DD`, which is the shape Postgres
 * `date` columns and every `.gte(...)` filter in the app already speak. An
 * unknown zone would make `Intl` throw, and a company is not worth failing a
 * page over — it falls back to UTC, which is what the code did before.
 */
export function todayIn(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

/**
 * El IVA contenido en un precio que ya lo incluye.
 *
 * `products.price_cents` es el precio con impuesto (migración 104): lo que el
 * cliente paga en el mostrador. Estas dos funciones son las dos mitades de esa
 * decisión, y viven aquí porque tres sitios necesitan la misma aritmética —
 * `register_pos_sale` en SQL, la nota del catálogo mientras se escribe el
 * precio, y la conversión a neto al pasar un producto a una línea de factura.
 *
 * La fórmula NO es `bruto × tasa/100`. Ese es el impuesto de un precio sin IVA,
 * y aplicarlo a uno que ya lo lleva declara de más: de 11.900 al 19% saldrían
 * 2.261 en vez de 1.900. Sobre un precio con impuesto incluido se despeja:
 *
 *     bruto = neto × (1 + tasa/100)   ⟹   impuesto = bruto × tasa / (100 + tasa)
 */
export function taxWithin(grossCents: number, ratePercent: number): number {
  if (ratePercent <= 0 || grossCents <= 0) return 0
  return Math.round((grossCents * ratePercent) / (100 + ratePercent))
}

/** Lo que queda para la empresa: el bruto sin el impuesto que contiene. */
export function netFromGross(grossCents: number, ratePercent: number): number {
  return grossCents - taxWithin(grossCents, ratePercent)
}

/**
 * Días con signo entre `from` y `date`. Negativo = ya pasó.
 *
 * Estaba escrita seis veces, con tres formas distintas y dos respuestas
 * distintas para la misma fecha:
 *
 *   · `socios` y `odontologia` recibían el «hoy» como argumento — correcto;
 *   · `contratos` y `notif-panel` usaban `new Date()` del **servidor**, que es
 *     UTC en Vercel, o sea el mismo corte de día equivocado que se arregló en
 *     todo lo demás;
 *   · `capacitacion` y `flota` usaban `new Date()` del **navegador**, así que
 *     la misma fecha de vencimiento podía leerse distinta en la lista y en el
 *     detalle según quién la calculara.
 *
 * Una sola, y el «hoy» siempre entra por parámetro: es lo que obliga a quien
 * llama a decidir de qué zona horaria habla, en vez de heredar en silencio la
 * de la máquina que ejecuta.
 *
 * `T00:00:00` sin `Z` en ambas: se comparan dos medianoches locales del mismo
 * huso, así que la diferencia es exacta en días y el desfase se cancela. Con
 * una en UTC y otra local el resultado se movería un día a un lado u otro del
 * meridiano.
 */
export function daysUntil(date: string | null, from: string): number | null {
  if (!date) return null
  const a = new Date(`${from}T00:00:00`).getTime()
  const b = new Date(`${date}T00:00:00`).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / 86_400_000)
}

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
  'Consulta', 'Control', 'Urgencia', 'Procedimiento', 'Teleconsulta', 'Vacunación', 'Examen', 'Otro',
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

/* ─── restaurant: reservas, costeo, caja y domicilios (migration 25) ─────── */

/**
 * Named apart from `RESERVATION_STATUSES`, which belongs to hotelería.
 *
 * The two vocabularies look similar and are not the same: a table is «Sentada»
 * where a room is «Check-in», and a hotel's «Check-out» has no table
 * equivalent. Sharing one list would have forced a restaurant to explain what
 * checking out of a table means.
 */
export const TABLE_RESERVATION_STATUSES = [
  'Confirmada', 'Sentada', 'Cumplida', 'Cancelada', 'No show',
] as const
export type TableReservationStatus = (typeof TABLE_RESERVATION_STATUSES)[number]

export const INGREDIENT_UNITS = ['g', 'kg', 'ml', 'L', 'UN', 'Porción'] as const
export type IngredientUnit = (typeof INGREDIENT_UNITS)[number]

export const CASH_SESSION_STATUSES = ['Abierta', 'Cerrada'] as const
export type CashSessionStatus = (typeof CASH_SESSION_STATUSES)[number]

export const SERVICE_KINDS = ['Salón', 'Domicilio', 'Para llevar'] as const
export type ServiceKind = (typeof SERVICE_KINDS)[number]

export const DELIVERY_STATUSES = [
  'Pendiente', 'En preparación', 'En camino', 'Entregado', 'Cancelado',
] as const
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

/**
 * Food cost: what the plate costs to make, as a share of what it sells for.
 *
 * The number the whole costeo tab exists to produce. Returns null rather than
 * 0 for a dish with no price — a free dish has no food cost, and reporting one
 * as 0 % would put it at the top of a "most profitable" list.
 *
 * Rounded to one decimal because the inputs are estimates of estimates;
 * printing 31.4159 % would imply a precision the recipe does not have.
 */
export function foodCostPct(costCents: number, priceCents: number): number | null {
  if (!Number.isFinite(costCents) || !Number.isFinite(priceCents)) return null
  if (priceCents <= 0) return null
  return Math.round((costCents / priceCents) * 1000) / 10
}

/**
 * The arqueo: what the drawer holds against what it should.
 *
 * Positive is a surplus, negative a shortfall. The opening float is part of
 * the count but not of the takings — conflating the two is the arithmetic
 * mistake every hand-kept cash sheet makes, and it makes every session look
 * short by exactly the float.
 */
export function cashDifferenceCents(
  countedCents: number,
  expectedCents: number,
  openingFloatCents: number,
): number {
  return countedCents - (expectedCents + openingFloatCents)
}

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

/* ─── socios (fitness y bienestar) ─────────────────────────────────────── */

export const MEMBER_STATUSES = [
  'Activo', 'Inactivo', 'Suspendido', 'Retirado',
] as const
export type MemberStatus = (typeof MEMBER_STATUSES)[number]

/**
 * Cómo se cobra un plan.
 *
 * Los tres modelos que cubren los cuatro subsectores del sector: la
 * mensualidad de un gimnasio, el bono de diez clases de un estudio y la sesión
 * suelta de un spa. «Bono» es el único que consume créditos; los demás dan
 * acceso libre mientras la vigencia esté abierta.
 */
export const PLAN_BILLINGS = [
  'Mensual', 'Trimestral', 'Semestral', 'Anual', 'Bono', 'Sesión',
] as const
export type PlanBilling = (typeof PLAN_BILLINGS)[number]

export const SUBSCRIPTION_STATUSES = [
  'Vigente', 'Vencida', 'Cancelada', 'Congelada',
] as const
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

export const CLASS_STATUSES = [
  'Programada', 'En curso', 'Dictada', 'Cancelada',
] as const
export type ClassStatus = (typeof CLASS_STATUSES)[number]

/**
 * Nombrado aparte de `BOOKING_*` de hotelería y restaurante a propósito: aquí
 * «En espera» es la lista cuando el cupo se llenó, que no existe en las otras
 * dos, y la diferencia entre «Asistió» y «No asistió» es justamente lo que un
 * estudio de clases quiere medir.
 */
export const CLASS_BOOKING_STATUSES = [
  'Reservada', 'En espera', 'Asistió', 'No asistió', 'Cancelada',
] as const
export type ClassBookingStatus = (typeof CLASS_BOOKING_STATUSES)[number]

export const CHECKIN_METHODS = ['Manual', 'Documento', 'Código', 'Huella'] as const
export type CheckinMethod = (typeof CHECKIN_METHODS)[number]

/* ─── caja y punto de venta ────────────────────────────────────────────── */

// `CASH_SESSION_STATUSES` vive más arriba, en el bloque de restaurante, donde
// nació. Se queda ahí: moverlo sería un cambio sin lector, y el vocabulario es
// el mismo turno de caja lo abra un mesero o una recepcionista.

/**
 * Lo que entra y sale del cajón aparte de las ventas.
 *
 * Las ventas no están aquí a propósito: llegan solas por `pos_sales` y por las
 * comandas del restaurante, y meterlas como un movimiento más las contaría dos
 * veces en el arqueo. Esto es lo *otro* — la propina que se paga en efectivo,
 * el domicilio que se le paga al mensajero, el retiro a la caja fuerte.
 */
export const CASH_MOVEMENT_KINDS = [
  'Ingreso', 'Egreso', 'Retiro', 'Gasto',
] as const
export type CashMovementKind = (typeof CASH_MOVEMENT_KINDS)[number]

export const POS_SALE_STATUSES = ['Pagada', 'Anulada'] as const
export type PosSaleStatus = (typeof POS_SALE_STATUSES)[number]

/* ─── odontología ──────────────────────────────────────────────────────── */

/**
 * Numeración FDI, la que usa el mundo entero salvo Estados Unidos.
 *
 * Primer dígito el cuadrante, segundo la pieza contando desde la línea media.
 * Los cuadrantes 1-4 son permanentes y van del 1 al 8; los 5-8 son temporales
 * y solo llegan al 5, porque un niño no tiene premolares ni terceros molares.
 *
 * Ordenados como se dibuja un odontograma —- del fondo derecho al fondo
 * izquierdo en el arco superior, y al revés en el inferior—- para que la
 * pantalla los recorra sin reordenar nada.
 */
/*
 * Cada arreglo va en el orden en que se pinta de izquierda a derecha en
 * pantalla, que es el orden del papel: el cuadrante derecho del paciente
 * primero —- y por lo tanto de fondo hacia la línea media—- y el izquierdo
 * después, de la línea media hacia el fondo.
 *
 * Escrito así y no ordenado por número para que la pantalla los recorra tal
 * cual. Un `.sort()` en el componente daría 41, 42, 43… en el arco inferior
 * derecho, que es correcto como número y está espejado como boca.
 */
export const FDI_UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11] as const
export const FDI_UPPER_LEFT  = [21, 22, 23, 24, 25, 26, 27, 28] as const
export const FDI_LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41] as const
export const FDI_LOWER_LEFT  = [31, 32, 33, 34, 35, 36, 37, 38] as const

/** Temporales, en el mismo orden. */
export const FDI_DECIDUOUS_UPPER_RIGHT = [55, 54, 53, 52, 51] as const
export const FDI_DECIDUOUS_UPPER_LEFT  = [61, 62, 63, 64, 65] as const
export const FDI_DECIDUOUS_LOWER_RIGHT = [85, 84, 83, 82, 81] as const
export const FDI_DECIDUOUS_LOWER_LEFT  = [71, 72, 73, 74, 75] as const

export const TOOTH_SURFACES = [
  'Oclusal', 'Mesial', 'Distal', 'Vestibular', 'Lingual', 'Palatina',
] as const
export type ToothSurface = (typeof TOOTH_SURFACES)[number]

export const TOOTH_CONDITIONS = [
  'Sano', 'Caries', 'Obturado', 'Corona', 'Ausente', 'Implante',
  'Endodoncia', 'Fracturado', 'Sellante', 'Extracción indicada',
  'Protesis', 'Ortodoncia',
] as const
export type ToothCondition = (typeof TOOTH_CONDITIONS)[number]

/**
 * El color con el que se pinta cada hallazgo en el odontograma.
 *
 * Convención de la profesión, no una paleta inventada: rojo lo que hay que
 * tratar, azul lo que ya se trató, gris lo que no está. Un odontólogo lee el
 * cuadro de un vistazo porque lleva veinte años viendo esos colores, y
 * cambiarlos por los de la marca lo obligaría a leer cada pieza.
 */
export const TOOTH_CONDITION_TONE: Record<ToothCondition, 'neu' | 'red' | 'blu' | 'grn' | 'amb'> = {
  'Sano': 'grn',
  'Caries': 'red',
  'Extracción indicada': 'red',
  'Fracturado': 'red',
  'Obturado': 'blu',
  'Corona': 'blu',
  'Endodoncia': 'blu',
  'Sellante': 'blu',
  'Implante': 'blu',
  'Protesis': 'blu',
  'Ortodoncia': 'amb',
  'Ausente': 'neu',
}

export const DENTAL_CHART_KINDS = ['Inicial', 'Control', 'Final'] as const
export type DentalChartKind = (typeof DENTAL_CHART_KINDS)[number]

export const TREATMENT_PLAN_STATUSES = [
  'Propuesto', 'Aceptado', 'En curso', 'Terminado', 'Rechazado',
] as const
export type TreatmentPlanStatus = (typeof TREATMENT_PLAN_STATUSES)[number]

export const TREATMENT_ITEM_STATUSES = [
  'Pendiente', 'En curso', 'Hecho', 'Cancelado',
] as const
export type TreatmentItemStatus = (typeof TREATMENT_ITEM_STATUSES)[number]

export const DENTAL_LAB_WORK_TYPES = [
  'Corona', 'Puente', 'Prótesis total', 'Prótesis parcial',
  'Incrustación', 'Carilla', 'Férula', 'Placa', 'Otro',
] as const
export type DentalLabWorkType = (typeof DENTAL_LAB_WORK_TYPES)[number]

export const DENTAL_LAB_STATUSES = [
  'Enviado', 'En proceso', 'Recibido', 'Reproceso', 'Cancelado',
] as const
export type DentalLabStatus = (typeof DENTAL_LAB_STATUSES)[number]

/** El subsector cuyo `pacientes` muestra las pantallas dentales. */
export const DENTAL_SUBSECTOR = 'salud-odontologia'

/** El subsector cuyo `pacientes` muestra las pantallas veterinarias. */
export const VET_SUBSECTOR = 'salud-veterinaria'

/**
 * Cómo se nombra una pieza y su cara en una línea de texto.
 *
 * Aquí y no junto a la consulta porque la usan el odontograma, el plan y el
 * laboratorio —- los tres en el cliente—- y `server/queries` lleva
 * `server-only`: importar de ahí una función arrastra Supabase, `next/headers`
 * y el entorno al bundle del navegador. Es un fallo de compilación que
 * TypeScript no ve, porque el límite es de Next y no de tipos.
 *
 * Y una sola redacción: tres formas distintas de escribir «16 oclusal» en la
 * misma pantalla es como se acaba dudando de si hablan de lo mismo.
 */
export function toothLabel(tooth: number | null, surface: string | null): string {
  if (tooth === null) return 'Boca completa'
  return surface ? `${tooth} · ${surface.toLowerCase()}` : String(tooth)
}
