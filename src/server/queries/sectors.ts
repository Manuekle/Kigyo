import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requireMember } from '@/lib/auth/session'
import { EMPTY_CATALOGUE, type SectorCatalogue, type SectorOption } from '@/lib/sectors'

/**
 * The sector catalogue, read from the database.
 *
 * Sectors moved out of TypeScript in migration 29 and their module presets
 * followed in migration 34, so that adding an industry — or a subsector, or a
 * change to what one proposes — stops being a deploy. `COMPANY_TYPES` in
 * lib/modules.ts still carries a copy of the presets, because the signup page
 * previews a sector before there is a session to query with, and a test pins
 * the two together in both directions.
 *
 * A sector added to the table and missing from both is picked happily and
 * proposes the small manual starting set — see `presetFromCatalogue`. The old
 * behaviour was to fall through to *every* module, which is the wrong failure:
 * it hands somebody who named their industry a sidebar with thirty-five
 * entries.
 */

export type { SectorOption, SectorCatalogue } from '@/lib/sectors'

export async function getSectors(): Promise<SectorCatalogue> {
  // Signed-in only. The catalogue is not secret, but everything else behind
  // this boundary requires a session and an exception here would be one more
  // thing to remember.
  await requireMember()
  const supabase = await createClient()

  const [{ data, error }, { data: presetRows, error: presetError }] = await Promise.all([
    supabase
      .from('sectors')
      .select('key, label, parent_key')
      .eq('is_active', true)
      .order('sort', { ascending: true }),
    supabase.from('sector_modules').select('sector_key, module_key, mode'),
  ])

  if (error || presetError) {
    console.error('[sectors] getSectors', error ?? presetError)
    return EMPTY_CATALOGUE
  }

  const rows: SectorOption[] = (data ?? []).map((r) => ({
    key: r.key,
    label: r.label,
    parentKey: r.parent_key,
  }))

  const subsectors: Record<string, SectorOption[]> = {}
  for (const row of rows) {
    if (!row.parentKey) continue
    ;(subsectors[row.parentKey] ??= []).push(row)
  }

  const presets: SectorCatalogue['presets'] = {}
  for (const row of presetRows ?? []) {
    const entry = (presets[row.sector_key] ??= { add: [], remove: [] })
    // Both halves are mutable arrays here and readonly on the type, which is
    // what keeps every consumer from editing a catalogue it was handed.
    ;(row.mode === 'remove' ? (entry.remove as string[]) : (entry.add as string[])).push(
      row.module_key,
    )
  }

  return {
    sectors: rows.filter((r) => r.parentKey === null),
    subsectors,
    presets,
  }
}
