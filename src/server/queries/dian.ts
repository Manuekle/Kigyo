import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { scoped } from './shared'
import type { Member } from '@/lib/auth/session'

/**
 * DIAN — modo demo.
 *
 * Las queries leen la proyección fiscal (`dian_documents`), su bitácora
 * (`dian_events`, append-only) y el estado de la integración `dian` en
 * `integration_settings`. El CUFE y el XML son simulados; el ambiente es
 * SIEMPRE 'demo' aquí. El flujo productivo requiere替换 `src/lib/dian/ubl.ts`
 * por el cliente del proveedor homologado — no esta capa de lectura.
 *
 * Permisos: lectura y escritura viajan por `facturacion:read`/`facturacion:write`
 * porque un documento DIAN es la cara fiscal de una factura existente. No se
 * introduce módulo nuevo (`dian` no es clave de `enabled_modules`); la
 * integración se habilita como `kind = 'dian'` en `integration_settings`.
 */

export type DianStatus = 'procesando' | 'aceptada' | 'rechazada' | 'pendiente'
export type DianEventKind = 'envio' | 'aceptacion' | 'rechazo' | 'consulta' | 'error'

export interface DianDocumentRow {
  id: string
  invoiceId: string
  invoiceCode: string
  clientName: string
  totalCents: number
  ambiente: 'demo'
  status: DianStatus
  cufe: string
  xmlContent: string
  error: string
  sentAt: string
  respondedAt: string | null
  createdAt: string
}

export interface DianEventRow {
  id: string
  dianDocumentId: string
  kind: DianEventKind
  message: string
  responseRaw: string
  createdAt: string
}

/** Resumen por invoice, lo que la lista de facturas necesita. */
export interface DianSummary {
  invoiceId: string
  status: DianStatus
  cufe: string
  ambiente: 'demo'
  sentAt: string | null
}

export interface IntegracionDian {
  enabled: boolean
  provider: 'dian_demo' | null
  /** ¿Hay un «secreto» guardado? En demo sin firma, puede quedar vacío. */
  certificadoGuardado: boolean
}

export interface DianPanelData {
  /** Últimos 50 documentos DIAN emitidos por la empresa. */
  documentos: DianDocumentRow[]
  /** Configuración de la integración con DIAN. */
  integracion: IntegracionDian
  /** Facturas Emitidas pendientes de enviar (selector del panel). */
  facturasParaEnviar: FacturaParaEnviar[]
  /** Cuenta por estado, para los KPIs en la UI. */
  aceptadas: number
  rechazadas: number
  pendientes: number
  procesando: number
}

interface DianDocumentRecord {
  id: string
  invoice_id: string
  invoice_code: string
  client_name: string
  total_cents: number
  ambiente: 'demo'
  status: DianStatus
  cufe: string
  xml_content: string
  error: string
  sent_at: string
  responded_at: string | null
  created_at: string
}

interface DianEventRecord {
  id: string
  dian_document_id: string
  kind: DianEventKind
  message: string
  response_raw: string
  created_at: string
}

interface IntegrationSettingsRecord {
  enabled: boolean
  provider: string
}

function toDocument(r: DianDocumentRecord): DianDocumentRow {
  return {
    id: r.id,
    invoiceId: r.invoice_id,
    invoiceCode: r.invoice_code,
    clientName: r.client_name,
    totalCents: r.total_cents,
    ambiente: r.ambiente,
    status: r.status,
    cufe: r.cufe,
    xmlContent: r.xml_content,
    error: r.error,
    sentAt: r.sent_at,
    respondedAt: r.responded_at,
    createdAt: r.created_at,
  }
}

function toEvent(r: DianEventRecord): DianEventRow {
  return {
    id: r.id,
    dianDocumentId: r.dian_document_id,
    kind: r.kind,
    message: r.message,
    responseRaw: r.response_raw,
    createdAt: r.created_at,
  }
}

/**
 * Estado de la integración con DIAN para esta empresa.
 *
 * Como `kind = 'dian'` no existía hasta mig 92, una empresa sin DIAN
 * configurada devuelve `enabled: false, provider: null`. La mutation que
 * lo guarda (`saveDianConfig`) inserta la fila nueva en ese caso.
 */
async function fetchIntegracion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
): Promise<IntegracionDian> {
  const { data } = await supabase
    .from('integration_settings')
    .select('enabled, provider')
    .eq('org_id', orgId)
    .eq('kind', 'dian')
    .maybeSingle() as unknown as { data: IntegrationSettingsRecord | null }

  // `integraciones_has_secret` solo puede ver su propio org, no el valor
  // del secreto. Lo llamamos desde una server action con el cliente admin
  // cuando se guarda la config de DIAN; aquí nos limitamos al flag público.
  return {
    enabled: data?.enabled ?? false,
    provider: data?.provider === 'dian_demo' ? 'dian_demo' : null,
    certificadoGuardado: false,
  }
}

export async function getDianPanel(): Promise<DianPanelData> {
  const member = await requirePermission('facturacion:read')
  const supabase = await createClient()

  const [docsResult, integracion, facturasParaEnviar] = await Promise.all([
    scoped(supabase, member, 'dian_documents')
      .select('id, invoice_id, invoice_code, client_name, total_cents, ambiente, status, cufe, xml_content, error, sent_at, responded_at, created_at')
      .order('sent_at', { ascending: false })
      .limit(50),
    fetchIntegracion(supabase, member.orgId),
    fetchFacturasParaEnviar(supabase, member),
  ])

  const documentos = ((docsResult.data ?? []) as unknown as DianDocumentRecord[]).map(toDocument)

  return {
    documentos,
    integracion,
    facturasParaEnviar,
    aceptadas: documentos.filter((d) => d.status === 'aceptada').length,
    rechazadas: documentos.filter((d) => d.status === 'rechazada').length,
    pendientes: documentos.filter((d) => d.status === 'pendiente').length,
    procesando: documentos.filter((d) => d.status === 'procesando').length,
  }
}

/** Documento DIAN completo + todos sus eventos. NULL si no existe. */
export async function getDianDetalle(
  dianDocumentId: string,
): Promise<{ documento: DianDocumentRow; eventos: DianEventRow[] } | null> {
  const member = await requirePermission('facturacion:read')
  const supabase = await createClient()

  const { data: doc } = await scoped(supabase, member, 'dian_documents')
    .select('id, invoice_id, invoice_code, client_name, total_cents, ambiente, status, cufe, xml_content, error, sent_at, responded_at, created_at')
    .eq('id', dianDocumentId)
    .maybeSingle()

  if (!doc) return null

  const { data: events } = await supabase
    .from('dian_events')
    .select('id, dian_document_id, kind, message, response_raw, created_at')
    .eq('dian_document_id', dianDocumentId)
    .order('created_at', { ascending: true })
    .limit(200)

  return {
    documento: toDocument(doc as unknown as DianDocumentRecord),
    eventos: ((events ?? []) as unknown as DianEventRecord[]).map(toEvent),
  }
}

/**
 * Mapa `invoiceId -> resumen DIAN` para la lista de facturas.
 *
 * Una sola query trae todos los documentos de la página activa; nada de
 * N+1. Devuelve solo los invoices que ya tienen una proyección fiscal.
 */
export async function getDianResumenesPorInvoice(
  invoiceIds: string[],
): Promise<Map<string, DianSummary>> {
  const out = new Map<string, DianSummary>()
  if (invoiceIds.length === 0) return out

  const member = await requirePermission('facturacion:read')
  const supabase = await createClient()

  const { data } = await scoped(supabase, member, 'dian_documents')
    .select('invoice_id, status, cufe, ambiente, sent_at')
    .in('invoice_id', invoiceIds)
    .order('sent_at', { ascending: false })

  for (const r of (data ?? []) as unknown as Array<{
    invoice_id: string
    status: DianStatus
    cufe: string
    ambiente: 'demo'
    sent_at: string
  }>) {
    // unique invoice_id ya garantizado por el constraint de la tabla; nos
    // quedamos con la primera ocurrencia (la más nueva por el order).
    if (!out.has(r.invoice_id)) {
      out.set(r.invoice_id, {
        invoiceId: r.invoice_id,
        status: r.status,
        cufe: r.cufe,
        ambiente: r.ambiente,
        sentAt: r.sent_at,
      })
    }
  }
  return out
}

async function fetchFacturasParaEnviar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  member: Member,
): Promise<FacturaParaEnviar[]> {
  const { data: facturas, error } = await scoped(supabase, member, 'invoices')
    .select('id, code, client_name, total_cents, issued_on')
    .eq('status', 'Emitida')
    .is('deleted_at', null)
    .order('issued_on', { ascending: false })
    .limit(100)
  if (error) {
    console.error('[dian] fetchFacturasParaEnviar invoices', error)
    return []
  }

  const rows = (facturas ?? []) as unknown as Array<{
    id: string
    code: string | null
    client_name: string
    total_cents: number
    issued_on: string
  }>
  if (rows.length === 0) return []

  // Quita las que ya tienen doc DIAN.
  const { data: docs } = await scoped(supabase, member, 'dian_documents')
    .select('invoice_id')
    .in('invoice_id', rows.map((r) => r.id))

  const conDoc = new Set(((docs ?? []) as unknown as Array<{ invoice_id: string }>).map((d) => d.invoice_id))

  return rows
    .filter((r) => !conDoc.has(r.id))
    .map((r) => ({
      id: r.id,
      code: r.code,
      clientName: r.client_name,
      totalCents: r.total_cents,
      issuedOn: r.issued_on,
    }))
}

/** Una factura disponible para enviar a DIAN: Emitida, con items, sin doc. */
export interface FacturaParaEnviar {
  id: string
  code: string | null
  clientName: string
  totalCents: number
  issuedOn: string
}

/**
 * Facturas Emitidas (no borradores/pagadas/anuladas) que aún no tienen
 * `dian_documents`. Las que se presentan en el selector del panel DIAN.
 */
export async function getFacturasParaEnviar(): Promise<FacturaParaEnviar[]> {
  const member = await requirePermission('facturacion:read')
  const supabase = await createClient()
  return fetchFacturasParaEnviar(supabase, member)
}