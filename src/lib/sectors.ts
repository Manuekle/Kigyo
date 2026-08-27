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
import { SUITE_KEYS, suitesOf, type Suite } from './modules/registry'

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

/**
 * The sector's proposal, split into what this plan can save and what it cannot.
 *
 * A preset describes the *business*, not the subscription — every sector
 * proposes modules Starter does not carry, and eight of them propose modules
 * only Enterprise carries. `updateSector` refuses the entire write if a single
 * submitted key falls outside the plan, so seeding the wizard with the raw
 * preset made «Continuar» fail for every Starter customer on every sector, with
 * an error naming modules the toggle list had already filtered off screen.
 *
 * Both halves are returned because both are needed: `included` is the selection,
 * and `locked` is what the screen has to say out loud instead of letting the
 * absence be discovered later as a fault.
 *
 * Shared by the wizard and its test on purpose. This is the one rule the client
 * and the server have to agree on, and a copy of it in a test file would pass
 * happily while the screen it is supposed to guard drifted away.
 */
export function proposalForPlan(
  catalogue: SectorCatalogue,
  allowed: ReadonlySet<string>,
  sector: string | null,
  subsector?: string | null,
): { included: string[]; locked: string[] } {
  const included: string[] = []
  const locked: string[] = []
  for (const key of presetFromCatalogue(catalogue, sector, subsector)) {
    if (allowed.has(key)) included.push(key)
    else locked.push(key)
  }
  return { included, locked }
}

/**
 * La propuesta del sector, recortada además al enfoque que eligió el cliente.
 *
 * El sector contesta «qué negocio es» y el enfoque contesta «a qué vine»: una
 * tienda de barrio y un distribuidor mayorista son los dos `comercio` y quieren
 * cosas distintas —uno un mostrador, el otro compras y facturación—, y hasta
 * que existió este paso el asistente les entregaba exactamente los mismos
 * veinte módulos.
 *
 * Tres cosas que no hace, a propósito:
 *
 *   · **No sustituye al plan.** `locked` sigue saliendo de `proposalForPlan`
 *     intacto: lo que el plan no cubre no es una cuestión de enfoque, y
 *     mezclarlos haría que subir de plan pareciera no servir de nada.
 *   · **No suelta el vertical.** Una clínica que pide sólo POS conserva
 *     Pacientes: es el módulo por el que su sector existe, y quitarlo sería
 *     leer «quiero cobrar en mostrador» como «no atiendo pacientes».
 *   · **No esconde lo que descarta.** `outOfFocus` es lo que la pantalla
 *     nombra debajo de la lista, del mismo modo que `locked` — un módulo que
 *     desaparece sin decirlo es un módulo que el cliente cree que no existe.
 *
 * Elegir los tres segmentos (o ninguno) es «no filtres», que es lo que hacía
 * el asistente antes de este paso.
 */
export function focusProposal(
  catalogue: SectorCatalogue,
  allowed: ReadonlySet<string>,
  sector: string | null,
  subsector: string | null,
  suites: readonly Suite[],
): { included: string[]; locked: string[]; outOfFocus: string[] } {
  const { included, locked } = proposalForPlan(catalogue, allowed, sector, subsector)
  if (suites.length === 0 || suites.length === SUITE_KEYS.length) {
    return { included, locked, outOfFocus: [] }
  }
  const vertical = sector ? companyType(sector)?.vertical ?? null : null
  const inFocus = (key: string) =>
    key === vertical || suitesOf(key).some((s) => suites.includes(s))
  return {
    included: included.filter(inFocus),
    locked,
    outOfFocus: included.filter((k) => !inFocus(k)),
  }
}
