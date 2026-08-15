import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { pageRange, totalOf, type Page } from './shared'

/**
 * Contabilidad: asientos, mayor y reportes.
 *
 * Todo lo que aquí se lee es derivado de los asientos PUBLICADOS — el mayor
 * es la suma de las líneas, el P&G es el mayor filtrado por tipo de cuenta y
 * el balance el saldo por naturaleza. No hay una segunda verdad almacenada
 * que pueda desincronizarse: el test de aceptación es aritmético.
 */

export const ENTRY_SOURCES = ['Manual', 'Venta', 'Cobro', 'Compra', 'Pago', 'Caja'] as const

export interface JournalLineRow {
  id: string
  accountId: string
  accountName: string
  description: string
  debitCents: number
  creditCents: number
}

export interface JournalEntryRow {
  id: string
  entryDate: string
  memo: string
  source: string
  status: string
  postedAt: string | null
  createdAt: string
  lines: JournalLineRow[]
  totalCents: number
}

export interface AccountBalance {
  code: string
  name: string
  kind: string
  /** Suma de débitos − créditos publicados (sin signo por naturaleza). */
  balanceCents: number
}

export interface ProfitLossRow {
  month: string
  ingresos: number
  costos: number
  gastos: number
  utilidad: number
}

export interface BalanceRow {
  kind: string
  totalCents: number
}

export interface ContabilidadData {
  asientos: JournalEntryRow[]
  asientosTotal: number
  /** Cuentas activas del PUC, en orden de código. */
  cuentas: Array<{ code: string; name: string; kind: string; nature: string }>
  /** Mayor: saldo por cuenta publicada con movimiento. */
  mayor: AccountBalance[]
  /** P&G por mes (últimos 12), derivado del mayor. */
  pnl: ProfitLossRow[]
  /** Balance por tipo de cuenta a la fecha. */
  balance: BalanceRow[]
  /** Movimientos de caja/bancos (1105/1110), para el flujo de caja. */
  flujo: Array<{ date: string; memo: string; amountCents: number }>
  canWrite: boolean
}

interface EntryRecord {
  id: string
  entry_date: string
  memo: string
  source: string
  status: string
  posted_at: string | null
  created_at: string
  journal_lines: Array<{
    id: string
    account_id: string
    description: string
    debit_cents: number
    credit_cents: number
    gl_accounts: { name: string } | null
  }> | null
}

const ENTRY_COLUMNS = `id, entry_date, memo, source, status, posted_at, created_at,
   journal_lines ( id, account_id, description, debit_cents, credit_cents, gl_accounts ( name ) )`

function toEntry(row: EntryRecord): JournalEntryRow {
  const lines: JournalLineRow[] = (row.journal_lines ?? []).map((l) => ({
    id: l.id,
    accountId: l.account_id,
    accountName: l.gl_accounts?.name ?? l.account_id,
    description: l.description,
    debitCents: Number(l.debit_cents),
    creditCents: Number(l.credit_cents),
  }))
  return {
    id: row.id,
    entryDate: row.entry_date,
    memo: row.memo,
    source: row.source,
    status: row.status,
    postedAt: row.posted_at,
    createdAt: row.created_at,
    lines,
    totalCents: lines.reduce((s, l) => s + l.debitCents, 0),
  }
}

export async function getAsientosPage(offset = 0): Promise<Page<JournalEntryRow>> {
  const member = await requirePermission('contabilidad:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('journal_entries')
    .select(ENTRY_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('entry_date', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[contabilidad] getAsientosPage', error)
    return { rows: [], total: 0 }
  }
  return {
    rows: (data as unknown as EntryRecord[]).map(toEntry),
    total: totalOf(count, (data ?? []).length, from),
  }
}

export async function getContabilidad(): Promise<ContabilidadData> {
  const member = await requirePermission('contabilidad:read')
  const supabase = await createClient()

  const [page, accountsResult, linesResult] = await Promise.all([
    getAsientosPage(0),
    supabase
      .from('gl_accounts')
      .select('code, name, kind, nature')
      .eq('is_active', true)
      .order('code', { ascending: true }),
    supabase
      .from('journal_lines')
      .select('account_id, debit_cents, credit_cents, journal_entries!inner ( entry_date, memo, status, deleted_at )')
      .eq('org_id', member.orgId)
      .limit(50_000),
  ])

  const accounts = (accountsResult.data ?? []) as Array<{
    code: string; name: string; kind: string; nature: string
  }>

  const movements = (linesResult.data ?? []) as unknown as Array<{
    account_id: string
    debit_cents: number
    credit_cents: number
    journal_entries: { entry_date: string; memo: string; status: string; deleted_at: string | null }
  }>

  const posted = movements.filter((m) =>
    m.journal_entries.status === 'Publicado' && m.journal_entries.deleted_at === null,
  )

  // Mayor: saldo por cuenta = débitos − créditos (publicados).
  const byAccount = new Map<string, { code: string; name: string; kind: string; balance: number }>()
  for (const m of posted) {
    const a = accounts.find((x) => x.code === m.account_id)
    if (!a) continue
    const entry = byAccount.get(m.account_id) ?? {
      code: a.code, name: a.name, kind: a.kind, balance: 0,
    }
    entry.balance += Number(m.debit_cents) - Number(m.credit_cents)
    byAccount.set(m.account_id, entry)
  }

  const mayor: AccountBalance[] = [...byAccount.values()]
    .sort((x, y) => x.code.localeCompare(y.code))
    .map((x) => ({
      code: x.code,
      name: x.name,
      kind: x.kind,
      balanceCents: x.balance,
    }))

  // P&G: ingresos − costos − gastos por mes.
  const months = new Map<string, ProfitLossRow>()
  for (const m of posted) {
    const a = accounts.find((x) => x.code === m.account_id)
    if (!a) continue
    const month = m.journal_entries.entry_date.slice(0, 7)
    const row = months.get(month) ?? { month, ingresos: 0, costos: 0, gastos: 0, utilidad: 0 }
    const net = Number(m.debit_cents) - Number(m.credit_cents)
    if (a.kind === 'Ingresos') row.ingresos += -net
    if (a.kind === 'Costos') row.costos += net
    if (a.kind === 'Gastos') row.gastos += net
    row.utilidad = row.ingresos - row.costos - row.gastos
    months.set(month, row)
  }

  // Balance: activo = pasivo + patrimonio (+ resultado del período).
  const byKind = new Map<string, number>()
  for (const x of mayor) {
    const net = x.balanceCents
    if (x.kind === 'Activo' || x.kind === 'Gastos' || x.kind === 'Costos') {
      byKind.set('Activo', (byKind.get('Activo') ?? 0) + net)
    } else {
      byKind.set('Pasivo + Patrimonio', (byKind.get('Pasivo + Patrimonio') ?? 0) - net)
    }
  }

  // Flujo de caja: movimientos de las cuentas de caja y bancos.
  const flujo = posted
    .filter((m) => m.account_id === '1105' || m.account_id === '1110')
    .map((m) => ({
      date: m.journal_entries.entry_date,
      memo: m.journal_entries.memo,
      amountCents: Number(m.debit_cents) - Number(m.credit_cents),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    asientos: page.rows,
    asientosTotal: page.total,
    cuentas: accounts,
    mayor,
    pnl: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
    balance: [...byKind.entries()].map(([kind, totalCents]) => ({ kind, totalCents })),
    flujo,
    canWrite: can(member.permissions, 'contabilidad:write'),
  }
}
