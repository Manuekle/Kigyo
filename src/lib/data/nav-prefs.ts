/**
 * What this person has done to their own rail, on this device.
 *
 * Which sections they keep open and which modules they pinned is a preference
 * about a list — not a fact about the company — so it belongs nowhere near the
 * database, and a round trip to read it would delay the first paint of the only
 * navigation on screen. Keyed by company, because the nav is a different nav in
 * each one: the same person may run a clinic and a bakery.
 *
 * Shaped as a module-level store read through `useSyncExternalStore`, the same
 * way `SoundContext` holds the sound preference and for the same two reasons:
 * the server has no `localStorage`, so the first render has to agree with it on
 * the empty value; and the snapshot has to be referentially stable or the hook
 * re-renders forever.
 */

import { isSuite, type Suite } from '@/lib/modules/registry'

export interface NavPrefs {
  /**
   * Only the sections the person has actually clicked.
   *
   * Overrides rather than the whole open/closed state, so a heading that
   * appears later — a module switched on, a plan upgraded — is governed by the
   * default the sidebar computes instead of inheriting a decision nobody made
   * about it.
   */
  open: Record<string, boolean>
  pinned: string[]
  /**
   * Por qué segmento está mirando el rail: CRM, mostrador, ERP — o `null`,
   * que es la aplicación entera.
   *
   * Es una lente, no un permiso: no apaga módulos ni cierra rutas, y una URL
   * escrita a mano abre igual. Vive aquí, junto a las secciones plegadas y los
   * fijados, porque es exactamente lo mismo que esos dos — una decisión sobre
   * qué lista quiero ver hoy, de esta persona y en este dispositivo, no un
   * hecho de la empresa.
   */
  lens: Suite | null
}

/** Frozen and shared: it is the server snapshot, and it must never change identity. */
export const EMPTY_NAV_PREFS: NavPrefs = Object.freeze({ open: {}, pinned: [], lens: null })

const storageKey = (orgId: string) => `kigyo:nav:${orgId}`

let currentOrg = ''
let prefs: NavPrefs = EMPTY_NAV_PREFS
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/** localStorage throws in private mode and when the browser blocks site data. */
function read(orgId: string): NavPrefs {
  try {
    const raw = window.localStorage.getItem(storageKey(orgId))
    if (!raw) return EMPTY_NAV_PREFS
    const parsed = JSON.parse(raw) as Partial<NavPrefs>
    return {
      open: typeof parsed.open === 'object' && parsed.open ? parsed.open : {},
      pinned: Array.isArray(parsed.pinned) ? parsed.pinned.filter((k) => typeof k === 'string') : [],
      // Validado contra el catálogo y no sólo por tipo: un valor viejo o
      // escrito a mano en localStorage dejaría el rail filtrado por un
      // segmento que no existe, o sea vacío y sin causa visible.
      lens: typeof parsed.lens === 'string' && isSuite(parsed.lens) ? parsed.lens : null,
    }
  } catch {
    return EMPTY_NAV_PREFS
  }
}

export function subscribeNavPrefs(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const navPrefsSnapshot = (): NavPrefs => prefs
/** Nothing is remembered until the client has read it, so both sides start empty. */
export const navPrefsServerSnapshot = (): NavPrefs => EMPTY_NAV_PREFS

/** Points the store at a company and restores what it has stored. Call from an effect. */
export function loadNavPrefs(orgId: string): void {
  currentOrg = orgId
  prefs = read(orgId)
  emit()
}

export function saveNavPrefs(next: NavPrefs): void {
  prefs = next
  try {
    window.localStorage.setItem(storageKey(currentOrg), JSON.stringify(next))
  } catch {
    /* best-effort: the rail still obeys for this session, it just forgets. */
  }
  emit()
}
