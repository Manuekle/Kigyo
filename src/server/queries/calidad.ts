import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { scoped } from './shared'

/**
 * Calidad: controles, lotes y no conformidades.
 *
 * Un control es una inspección con resultado; una no conformidad es lo que
 * salió mal y qué se hizo al respecto. El lote es texto libre — el número lo
 * define la operación, no el sistema — y `product_id` es opcional con
 * `on delete set null`: un control histórico no desaparece cuando el producto
 * deja de existir.
 *
 * Las no conformidades abiertas son la señal de la pantalla: lo que se
 * detectó y aún no se resolvió.
 */

export interface CheckRow {
  id: string
  productId: string | null
  productName: string | null
  batch: string | null
  checkedOn: string
  result: string
  notes: string | null
}

export interface NonconformityRow {
  id: string
  productId: string | null
  productName: string | null
  batch: string | null
  description: string
  severity: string
  status: string
  actionTaken: string | null
  openedOn: string
}

export interface CalidadData {
  /** Controles recientes, por fecha descendente. */
  checks: CheckRow[]
  /** No conformidades recientes, por apertura descendente. */
  nonconformities: NonconformityRow[]
  /** Productos vivos, para el selector de producto. */
  products: Array<{ id: string; name: string }>
  /** No conformidades con estado `abierta`. */
  abiertasCount: number
}

interface CheckRecord {
  id: string
  product_id: string | null
  batch: string | null
  checked_on: string
  result: string
  notes: string | null
  products: { name: string } | null
}

interface NonconformityRecord {
  id: string
  product_id: string | null
  batch: string | null
  description: string
  severity: string
  status: string
  action_taken: string | null
  opened_on: string
  products: { name: string } | null
}

function toCheckRow(row: CheckRecord): CheckRow {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.products?.name ?? null,
    batch: row.batch,
    checkedOn: row.checked_on,
    result: row.result,
    notes: row.notes,
  }
}

function toNonconformityRow(row: NonconformityRecord): NonconformityRow {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.products?.name ?? null,
    batch: row.batch,
    description: row.description,
    severity: row.severity,
    status: row.status,
    actionTaken: row.action_taken,
    openedOn: row.opened_on,
  }
}

export async function getCalidad(): Promise<CalidadData> {
  const member = await requirePermission('calidad:read')
  const supabase = await createClient()

  const [checksResult, nonconformitiesResult, productsResult] = await Promise.all([
    scoped(supabase, member, 'quality_checks')
      .select('id, product_id, batch, checked_on, result, notes, products ( name )')
      .order('checked_on', { ascending: false })
      .limit(200),
    scoped(supabase, member, 'nonconformities')
      .select(
        'id, product_id, batch, description, severity, status, action_taken, opened_on, ' +
          'products ( name )',
      )
      .order('opened_on', { ascending: false })
      .limit(200),
    scoped(supabase, member, 'products')
      .select('id, name')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
  ])

  const checks = ((checksResult.data ?? []) as unknown as CheckRecord[]).map(toCheckRow)
  const nonconformities = ((nonconformitiesResult.data ?? []) as unknown as NonconformityRecord[]).map(
    toNonconformityRow,
  )

  return {
    checks,
    nonconformities,
    products: (productsResult.data ?? []) as unknown as Array<{ id: string; name: string }>,
    abiertasCount: nonconformities.filter((n) => n.status === 'abierta').length,
  }
}
