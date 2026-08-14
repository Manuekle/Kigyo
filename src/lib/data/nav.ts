import type { NavItem, NavSection } from '../types'
import { MODULE_GROUPS, REGISTRY, type ModuleGroup } from '@/lib/modules/registry'
import { sectorNav } from '@/lib/modules'

/**
 * The sidebar, the page headings and the route table — all derived from the
 * module registry.
 *
 * They used to be four hand-maintained structures listing the same
 * thirty-seven keys in the same order, and the comment above `ROUTE_MAP`
 * recorded what that costs: there had been two copies of the route table, they
 * had drifted, and searching the command palette for half a dozen modules
 * dropped you on /dashboard through a `??` fallback. The fix at the time was to
 * merge the two copies. This removes the copies.
 *
 * Nothing here decides visibility. `Sidebar` filters every item through
 * `member.can(...)`, which folds together the plan, the company's enabled
 * modules and the role's permission — so a company that does not run a
 * restaurant never sees the heading its module would have sat under.
 */

/** Every registry entry that has a nav item, with its aliases attached. */
const NAV_ENTRIES = REGISTRY.map((m) => ({
  key: m.key,
  label: m.label,
  icon: m.icon,
  group: m.group,
  route: m.route,
  title: m.title,
  subtitle: m.subtitle,
  children: (m.aliases ?? []).map((a) => ({ key: a.key, label: a.label, icon: a.icon })),
}))

/** The same list flattened, for the maps that address every route by key. */
const FLAT = REGISTRY.flatMap((m) => [
  { key: m.key, title: m.title, subtitle: m.subtitle, route: m.route },
  ...(m.aliases ?? []).map((a) => ({
    key: a.key, title: a.title, subtitle: a.subtitle, route: a.route,
  })),
])

/**
 * The one entry the «Herramientas» section at the bottom claims.
 *
 * Named here so the group it nominally belongs to skips it — `ia` lives in
 * `Equipo`, and appearing under its own heading *and* under «Herramientas»
 * was the bug this constant prevents. The assistant keeps that group rather
 * than taking `group: null`, because `null` is what marks a module as
 * unswitchable and the assistant is very much switchable.
 *
 * Configuración has no nav entry at all: it is reached from the user menu.
 */
const TOOLS = ['ia']

/** Never a nav entry: its only door is the user menu in the sidebar footer. */
const USER_MENU_ONLY = ['configuracion']

function itemsIn(group: ModuleGroup | null): NavItem[] {
  return NAV_ENTRIES
    .filter((e) => e.group === group && e.icon && !TOOLS.includes(e.key) && !USER_MENU_ONLY.includes(e.key))
    .map((e) => ({
      key: e.key,
      label: e.label,
      icon: e.icon as string,
      // `ordenes-compra` used to be a top-level entry sitting directly beneath
      // Compras — two lines in the nav for one module, gated on one permission,
      // which read as two features and made the list longer for nothing.
      // Nested, it is what it always was: the second screen of Compras.
      children: e.children.length > 0 ? e.children : undefined,
    }))
}

/**
 * The sidebar for a given sector.
 *
 * Four things happen here that the old flat `NAV` could not do, and all four
 * come from the same observation: the nav was identical for a dental clinic and
 * a mining company, which means it was designed for neither.
 *
 *   1. **The vertical goes to the top.** `Sectoriales` was rendered last, so a
 *      dentist found Pacientes below Nómina, Producción and Cotizaciones —
 *      their main screen, in the basement, under a heading about how the
 *      software is organised. It now leads, under the name of the business.
 *   2. **The heading is the business.** «Clínica», «Campo», «Alojamiento». See
 *      `SECTOR_NAV`.
 *   3. **The rest is ordered per sector.** A factory opens on Operación, an
 *      agency on Comercial.
 *   4. **The tools sit at the bottom.** The AI assistant is not part of any
 *      group's story; it is where you go when you step out of the work.
 *      Configuración is not here either — it lives in the user menu.
 *
 * A pure function of the sector, so it is the same on the server and in the
 * client and can be tested without rendering anything.
 */
export function navFor(sector: string | null): NavSection[] {
  const { navLabel, groupOrder } = sectorNav(sector)

  // A partial `groupOrder` means "these first"; anything unnamed keeps its
  // catalogue order behind them. Sectoriales is never in here — it has been
  // promoted to the top and would otherwise appear twice.
  const general: ModuleGroup[] = [
    ...(groupOrder ?? []),
    ...MODULE_GROUPS.filter(
      (g) => g !== 'Sectoriales' && !(groupOrder ?? []).includes(g),
    ),
  ]

  const sections: NavSection[] = [
    { items: itemsIn(null) },
    // Named after the business when we know what it is. A company running a
    // vertical it was not proposed — a hotel that also enabled Restaurante —
    // still gets its modules here, which is the right home for them either way.
    { label: navLabel ?? 'Sectoriales', items: itemsIn('Sectoriales') },
    ...general.map((group) => ({ label: group, items: itemsIn(group) })),
  ]

  const tools: NavItem[] = NAV_ENTRIES
    .filter((e) => TOOLS.includes(e.key) && e.icon)
    .map((e) => ({ key: e.key, label: e.label, icon: e.icon as string }))

  return [...sections, { label: 'Herramientas', items: tools }].filter(
    (s) => s.items.length > 0,
  )
}

/**
 * The default sidebar, for callers with no sector in hand.
 *
 * Kept as a constant because the command palette and the tests want a stable
 * list of every nav item, and because a company with no sector is a real state
 * — it is what "configurar manualmente" produces.
 */
export const NAV: NavSection[] = navFor(null)

/** Page heading per route key. */
export const META: Record<string, string> = {
  ...Object.fromEntries(FLAT.map((e) => [e.key, e.title])),
  // Account-level, so it has no registry entry: it is not a module, cannot be
  // switched off, and belongs to no plan. Reached from the company switcher.
  empresas: 'Empresas',
}

export const META_SUB: Record<string, string> = {
  ...Object.fromEntries(FLAT.map((e) => [e.key, e.subtitle])),
  empresas: 'Las empresas de tu cuenta, su sector y quién pertenece a cada una.',
}

/** Nav key → route. Derived, so it can no longer drift from the nav it serves. */
export const ROUTE_MAP: Record<string, string> = {
  ...Object.fromEntries(FLAT.map((e) => [e.key, e.route])),
  empresas: '/dashboard/empresas',
}
