/**
 * Turning "what business is this" into "which modules should be on".
 *
 * The sector catalogue lives in the database (migration 29 for the vocabulary,
 * 34 for the presets) so that adding an industry is an INSERT rather than a
 * deploy. This file is the arithmetic that reads it, kept pure and free of
 * `server-only` so the wizard and the Configuración screen run the same
 * resolution the server would — the alternative is two implementations of one
 * rule, and the one that drifts is always the one the customer sees.
 *
 * Nothing here restricts anything. A preset seeds a set of toggles and is
 * overridden freely: `requirePermission` never asks what sector a company is,
 * and neither does any RLS policy.
 */

import { MANUAL_START, SUBSECTOR_PRESETS, applySectorDelta, companyType, type SectorDelta } from './modules'

export interface SectorOption {
  key: string
  label: string
  /** Null for a sector; the parent's key for a subsector. */
  parentKey: string | null
}

export interface SectorCatalogue {
  sectors: SectorOption[]
  /** Subsectors, grouped by the key of the sector they belong to. */
  subsectors: Record<string, SectorOption[]>
  /**
   * What each sector proposes, from `public.sector_modules`.
   *
   * A top-level sector's entry is its whole proposal, carried in `add` with an
   * empty `remove` — the table refuses a 'remove' row there, since there is
   * nothing above it to subtract from. A subsector's entry is a delta over its
   * parent.
   */
  presets: Record<string, SectorDelta>
}

export const EMPTY_CATALOGUE: SectorCatalogue = { sectors: [], subsectors: {}, presets: {} }

/**
 * The modules a sector and subsector propose.
 *
 * Three sources, in the order that keeps a customer from ever landing on the
 * whole catalogue by accident:
 *
 *   1. the database — the sector's own rows, which is the answer for every
 *      sector that has any, including ones added after this deploy;
 *   2. `COMPANY_TYPES` — for a sector the table somehow has no rows for, when
 *      TypeScript still knows it;
 *   3. `MANUAL_START` — for a sector nothing knows anything about.
 *
 * That third step is the one that matters. `presetFor()` answers an unknown key
 * with *every module*, which is right for its own job (an account that predates
 * `enabled_modules` must not wake up to an empty sidebar) and catastrophic
 * here: a sector inserted as data with no preset would switch on all
 * thirty-five modules for whoever picked it, which is precisely the mess
 * MANUAL_START exists to prevent on the manual path.
 *
 * Passing `null` for the sector is the manual path itself, and gets the same
 * small starting set.
 */
export function presetFromCatalogue(
  catalogue: SectorCatalogue,
  sector: string | null,
  subsector?: string | null,
): string[] {
  if (!sector) return [...MANUAL_START]

  const fromDatabase = catalogue.presets[sector]
  const base =
    fromDatabase && fromDatabase.add.length > 0
      ? fromDatabase.add
      : companyType(sector)?.modules ?? MANUAL_START

  // The subsector's delta, preferring the table for the same reason: a
  // subsector added later must work without a deploy.
  const delta =
    subsector ? catalogue.presets[subsector] ?? SUBSECTOR_PRESETS[subsector] ?? null : null

  return applySectorDelta(base, delta)
}
