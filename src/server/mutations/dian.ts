'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { scoped } from '@/server/queries/shared'
import { getDianPanel, type DianPanelData } from '@/server/queries/dian'
import {
  buildUblInvoiceXml, computeCufe, dianDemoSend, type InvoiceSnapshot,
} from '@/lib/dian/ubl'

export type DianResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar la facturación electrónica.'

async function refreshed(): Promise<DianResult<DianPanelData>> {
  revalidatePath('/dashboard/dian')
  return { ok: true, data: await getDianPanel() }
}

/**
 * Snapshots que el XML UBL necesita. Se lee todo de una sola sesión con
 * el cliente del usuario (sujeto a RLS): la invoice, sus items, la
 * organización emisora y el receptor. Si falta el permiso de lectura,
 * RLS niega y la función falla explícito en vez de emitir un XML roto.
 */
async function loadSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  invoiceId: string,
): Promise<InvoiceSnapshot | null> {
  const [invResult, itemsResult, orgResult] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, code, client_id, client_name, issued_on, due_on, subtotal_cents, tax_cents, total_cents, currency')
      .eq('id', invoiceId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('invoice_items')
      .select('description, quantity, unit_price_cents, tax_rate')
      .eq('invoice_id', invoiceId)
      .order('position', { ascending: true }),
    supabase
      .from('organizations')
      .select('name, legal_name, tax_id, country, city, address')
      .eq('id', orgId)
      .maybeSingle(),
  ])

  // El receptor no cabe en el `Promise.all`: su id sale de la propia factura,
  // así que se pide después. Y puede no haberlo (venta de mostrador sin ficha),
  // que es el caso que `clientTaxId` deja en blanco.


  if (!invResult.data) return null
  const inv = invResult.data as {
    id: string
    code: string | null
    client_id: string | null
    client_name: string
    issued_on: string
    due_on: string | null
    subtotal_cents: number
    tax_cents: number
    total_cents: number
    currency: string
  }

  let clientTaxId = ''
  if (inv.client_id) {
    const { data: cli } = await supabase
      .from('clients')
      .select('tax_id')
      .eq('id', inv.client_id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle()
    clientTaxId = (cli as { tax_id?: string } | null)?.tax_id ?? ''
  }

  const org = (orgResult.data as {
    name: string
    legal_name: string | null
    tax_id: string | null
    country: string | null
    city: string | null
    address: string | null
  } | null)

  const items = ((itemsResult.data ?? []) as Array<{
    description: string
    quantity: number
    unit_price_cents: number
    tax_rate: number
  }>).map((r) => ({
    description: r.description,
    quantity: Number(r.quantity),
    unitPriceCents: Number(r.unit_price_cents),
    taxRate: Number(r.tax_rate),
  }))

  return {
    invoiceCode: inv.code ?? 'SIN-CODE',
    issuedOn: inv.issued_on,
    dueOn: inv.due_on,
    currency: inv.currency || 'COP',
    clientName: inv.client_name,
    clientTaxId,
    organizationName: org?.legal_name?.trim() || org?.name || '—',
    organizationTaxId: org?.tax_id ?? '',
    // Desde la migración 111 las dos existen como columna. El marcador se
    // queda para la empresa que todavía no las llenó: decir «falta el dato»
    // sigue siendo mejor que rellenarlo con otro que no es — que es lo que
    // hacía este campo cuando mandaba el país como ciudad.
    organizationAddress: org?.address?.trim() || '—',
    organizationCity: org?.city?.trim() || '—',
    subtotalCents: inv.subtotal_cents,
    taxCents: inv.tax_cents,
    totalCents: inv.total_cents,
    items,
  }
}

const sendSchema = z.object({ invoiceId: z.string().uuid() })

/**
 * Envía (en modo demo) una factura a la DIAN.
 *
 * El flujo:
 *   1. Carga la factura + items + org/cliente via RLS.
 *   2. Genera XML UBL 2.1 y CUFE simulado.
 *   3. Inserta `dian_documents` con `status='procesando'`.
 *   4. Registra `dian_events` de `envio`.
 *   5. Llama al mock `dianDemoSend` para simular la respuesta DIAN.
 *   6. Actualiza `dian_documents` con la respuesta final + inserta el evento
 *      `aceptacion`/`rechazo`.
 *
 * Si la factura ya tiene un `dian_documents` (unique invoice_id), falla
 * explícito: no se reenvía en demo, se consulta el existente.
 */
export async function sendInvoiceToDian(
  input: z.input<typeof sendSchema>,
): Promise<DianResult<DianPanelData>> {
  try {
    const member = await requirePermission('facturacion:write')
    const parsed = sendSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Factura inválida.')
    const { invoiceId } = parsed.data

    const supabase = await createClient()

    // Integración DIAN tiene que estar habilitada para esta empresa.
    const { data: setting } = await scoped(supabase, member, 'integration_settings')
      .select('enabled')
      .eq('kind', 'dian')
      .maybeSingle()
    if (!(setting as { enabled?: boolean } | null)?.enabled) {
      return fail('La integración DIAN no está habilitada. Actívala en Integraciones.')
    }

    // ¿Ya existe documento DIAN para esta factura? unique invoice_id.
    const { data: existing } = await scoped(supabase, member, 'dian_documents')
      .select('id, status')
      .eq('invoice_id', invoiceId)
      .maybeSingle()
    if (existing) {
      return fail('Esa factura ya tiene un documento DIAN. Revisa el panel.')
    }

    const snapshot = await loadSnapshot(supabase, member.orgId, invoiceId)
    if (!snapshot) return fail('No se pudo leer la factura (¿existe?).')
    if (snapshot.items.length === 0) {
      return fail('La factura no tiene líneas; añade productos antes de enviarla.')
    }

    const cufe = computeCufe(snapshot, 'demo')
    const xml = buildUblInvoiceXml(snapshot, cufe)

    const now = new Date().toISOString()

    // Inserta el documento en estado 'procesando' y captura su id.
    const { data: docInsert, error: docError } = await supabase
      .from('dian_documents')
      .insert({
        org_id: member.orgId,
        invoice_id: invoiceId,
        invoice_code: snapshot.invoiceCode,
        client_name: snapshot.clientName,
        total_cents: snapshot.totalCents,
        ambiente: 'demo',
        status: 'procesando',
        cufe,
        xml_content: xml,
        sent_at: now,
      })
      .select('id')
      .single()
    if (docError || !docInsert) {
      console.error('[dian] insert dian_documents', docError)
      return fail('No se pudo iniciar el envío a DIAN.')
    }
    const dianDocumentId = (docInsert as { id: string }).id

    // Evento de envío.
    await supabase.from('dian_events').insert({
      org_id: member.orgId,
      dian_document_id: dianDocumentId,
      kind: 'envio',
      message: `Envío de ${snapshot.invoiceCode} por ${snapshot.totalCents / 100} ${snapshot.currency}`,
      response_raw: xml.slice(0, 2000),
    })

    // Simula la respuesta DIAN (síncrona en demo).
    const response = dianDemoSend(cufe, xml)
    const respondedAt = new Date().toISOString()

    await supabase
      .from('dian_documents')
      .update({
        status: response.status,
        error: response.status === 'aceptada' ? '' : response.message,
        responded_at: respondedAt,
      })
      .eq('id', dianDocumentId)
      .eq('org_id', member.orgId)

    await supabase.from('dian_events').insert({
      org_id: member.orgId,
      dian_document_id: dianDocumentId,
      kind: response.status === 'aceptada' ? 'aceptacion' : response.status === 'rechazada' ? 'rechazo' : 'error',
      message: response.message,
      response_raw: response.responseRaw,
    })

    return refreshed()
  } catch (e) {
    console.error('[dian] sendInvoiceToDian', e)
    return fail(DENIED)
  }
}