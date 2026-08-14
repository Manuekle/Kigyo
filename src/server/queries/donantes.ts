import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { scoped } from './shared'

/**
 * Donantes: quién da y qué dio.
 *
 * Un donante es una fila; una donación, otra. Los totales no se guardan: se
 * derivan de las donaciones monetarias, porque guardarlos sería una segunda
 * verdad que puede discrepar de la primera. El encabezado responde «¿cuánto
 * ha dado la gente?» en total y en lo que va del año.
 */

export interface DonorRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  kind: string
  status: string
  notes: string | null
}

export interface DonationRow {
  id: string
  donorId: string | null
  donorName: string | null
  kind: string
  amountCents: number | null
  description: string | null
  donatedOn: string
  campaign: string | null
  notes: string | null
}

export interface DonantesData {
  /** Donantes de la empresa, por nombre. */
  donors: DonorRow[]
  /** Donaciones de todos los donantes, de la más reciente a la más vieja. */
  donations: DonationRow[]
  /** Suma de las donaciones monetarias, en centavos. */
  totalCents: number
  /** Lo mismo, solo lo que va del año en curso. */
  thisYearCents: number
}

interface DonorRecord {
  id: string
  name: string
  email: string | null
  phone: string | null
  kind: string
  status: string
  notes: string | null
}

interface DonationRecord {
  id: string
  donor_id: string | null
  donor_name: string | null
  kind: string
  amount_cents: number | null
  description: string | null
  donated_on: string
  campaign: string | null
  notes: string | null
}

function toDonorRow(row: DonorRecord): DonorRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    kind: row.kind,
    status: row.status,
    notes: row.notes,
  }
}

function toDonationRow(row: DonationRecord): DonationRow {
  return {
    id: row.id,
    donorId: row.donor_id,
    donorName: row.donor_name,
    kind: row.kind,
    amountCents: row.amount_cents,
    description: row.description,
    donatedOn: row.donated_on,
    campaign: row.campaign,
    notes: row.notes,
  }
}

export async function getDonantes(): Promise<DonantesData> {
  const member = await requirePermission('donantes:read')
  const supabase = await createClient()

  const [donorsResult, donationsResult] = await Promise.all([
    scoped(supabase, member, 'donors')
      .select('id, name, email, phone, kind, status, notes')
      .order('name', { ascending: true }),
    scoped(supabase, member, 'donations')
      .select('id, donor_id, donor_name, kind, amount_cents, description, donated_on, campaign, notes')
      .order('donated_on', { ascending: false })
      .limit(200),
  ])

  const donors = ((donorsResult.data ?? []) as unknown as DonorRecord[]).map(toDonorRow)
  const donations = ((donationsResult.data ?? []) as unknown as DonationRecord[]).map(toDonationRow)

  const year = new Date().getFullYear()
  const yearStart = `${year}-01-01`
  const sum = (rows: DonationRow[]) =>
    rows.reduce((acc, d) => acc + (d.amountCents ?? 0), 0)

  return {
    donors,
    donations,
    totalCents: sum(donations.filter((d) => d.kind === 'monetaria')),
    thisYearCents: sum(
      donations.filter((d) => d.kind === 'monetaria' && d.donatedOn >= yearStart),
    ),
  }
}
