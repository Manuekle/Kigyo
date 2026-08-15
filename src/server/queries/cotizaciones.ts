import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import {
  pageRange,
  projectsFor,
  rosterFor,
  totalOf,
  type Page,
  type ProjectRef,
  type RosterEntry,
} from './shared'

/**
 * Quotes and their line items, read through RLS.
 *
 * The screen used to hold quotes in `useState` with the total as a single
 * typed-in number — there were no lines, so the figure agreed with nothing and
 * changing a product's price changed no quote.
 *
 * `quotes` + `quote_items` store the lines, and the total is their sum.
 */

export interface CotizacionItem {
  id: string
  productId: string | null
  description: string
  quantity: number
  unitPriceCents: number
  position: number
}

export interface PipelineStage {
  id: string
  name: string
  position: number
  isActive: boolean
}

export interface CotizacionRow {
  id: string
  code: string | null
  client: string
  contact: string
  projectId: string | null
  projectLabel: string | null
  ownerId: string | null
  ownerName: string | null
  kind: string
  status: string
  probability: number
  issuedOn: string
  expiresOn: string | null
  notes: string
  /** La etapa del trato; null si la cotización es anterior al pipeline. */
  stageId: string | null
  items: CotizacionItem[]
  /** Sum of the lines, in cents. Never stored — always derived. */
  totalCents: number
}

export interface CotizacionesData {
  cotizaciones: CotizacionRow[]
  /** Quotes in the organization, of which `cotizaciones` is the first page. */
  cotizacionesTotal: number
  roster: RosterEntry[]
  proyectos: ProjectRef[]
  /** Etapas del pipeline, en orden. */
  stages: PipelineStage[]
  /** Catalogue for the line picker; empty without `catalogos:read`. */
  productos: Array<{ id: string; sku: string; name: string; priceCents: number }>
  canWrite: boolean
}

interface QuoteRecord {
  id: string
  code: string | null
  client: string
  contact: string
  project_id: string | null
  owner_id: string | null
  kind: string
  status: string
  probability: number
  issued_on: string
  expires_on: string | null
  notes: string
  stage_id: string | null
  employees: { full_name: string } | null
  projects: { code: string | null; name: string } | null
  quote_items: Array<{
    id: string
    product_id: string | null
    description: string
    quantity: number
    unit_price_cents: number
    position: number
  }> | null
}

const QUOTE_COLUMNS = `id, code, client, contact, project_id, owner_id, kind, status, probability,
   issued_on, expires_on, notes, stage_id,
   employees ( full_name ),
   projects ( code, name ),
   quote_items ( id, product_id, description, quantity, unit_price_cents, position )`

function toCotizacion(row: QuoteRecord): CotizacionRow {
  const items = (row.quote_items ?? [])
    .map((i) => ({
      id: i.id,
      productId: i.product_id,
      description: i.description,
      quantity: Number(i.quantity),
      unitPriceCents: Number(i.unit_price_cents),
      position: i.position,
    }))
    .sort((a, b) => a.position - b.position)

  return {
    id: row.id,
    code: row.code,
    client: row.client,
    contact: row.contact,
    projectId: row.project_id,
    projectLabel: row.projects
      ? [row.projects.code, row.projects.name].filter(Boolean).join(' · ')
      : null,
    ownerId: row.owner_id,
    ownerName: row.employees?.full_name ?? null,
    kind: row.kind,
    status: row.status,
    probability: row.probability,
    issuedOn: row.issued_on,
    expiresOn: row.expires_on,
    notes: row.notes,
    stageId: row.stage_id,
    items,
    // Rounded per line before summing: quantity is numeric(12,2), so a
    // fractional quantity times a cents price is not an integer.
    totalCents: items.reduce((s, i) => s + Math.round(i.quantity * i.unitPriceCents), 0),
  }
}

/** One page of quotes, newest first. */
export async function getCotizacionesPage(offset = 0): Promise<Page<CotizacionRow>> {
  const member = await requirePermission('cotizaciones:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('quotes')
    .select(QUOTE_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('issued_on', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[cotizaciones] getCotizacionesPage', error)
    return { rows: [], total: 0 }
  }

  return {
    rows: (data as unknown as QuoteRecord[]).map(toCotizacion),
    total: totalOf(count, data.length, from),
  }
}

export async function getCotizaciones(): Promise<CotizacionesData> {
  const member = await requirePermission('cotizaciones:read')
  const supabase = await createClient()

  const canReadProducts =
    member.modules.has('catalogos') && can(member.permissions, 'catalogos:read')

  const [quotesResult, roster, proyectos, productsResult, stagesResult] = await Promise.all([
    supabase
      .from('quotes')
      .select(QUOTE_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('issued_on', { ascending: false })
      .range(...pageRange(0)),
    rosterFor(supabase, member),
    projectsFor(supabase, member),
    canReadProducts
      ? supabase
          .from('products')
          .select('id, sku, name, price_cents')
          .eq('org_id', member.orgId)
          .is('deleted_at', null)
          .eq('is_active', true)
          .order('name', { ascending: true })
          .limit(300)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('pipeline_stages')
      .select('id, name, position, is_active')
      .eq('org_id', member.orgId)
      .order('position', { ascending: true })
      .limit(50),
  ])

  if (quotesResult.error) {
    console.error('[cotizaciones] getCotizaciones', quotesResult.error)
    return {
      cotizaciones: [], cotizacionesTotal: 0, roster: [], proyectos: [],
      productos: [], stages: [], canWrite: false,
    }
  }

  const cotizaciones = (quotesResult.data as unknown as QuoteRecord[]).map(toCotizacion)
  const stages: PipelineStage[] = ((stagesResult.data ?? []) as Array<{
    id: string; name: string; position: number; is_active: boolean
  }>).map((s) => ({
    id: s.id,
    name: s.name,
    position: s.position,
    isActive: s.is_active,
  }))

  return {
    cotizaciones,
    cotizacionesTotal: totalOf(quotesResult.count, cotizaciones.length),
    roster,
    proyectos,
    stages,
    productos: ((productsResult.data ?? []) as Array<{
      id: string; sku: string; name: string; price_cents: number
    }>).map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      priceCents: Number(p.price_cents),
    })),
    canWrite: can(member.permissions, 'cotizaciones:write'),
  }
}
