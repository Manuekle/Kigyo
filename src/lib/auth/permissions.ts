import { REGISTRY, type ModuleAction } from '@/lib/modules/registry'

/**
 * The single permission model.
 *
 * Two incompatible models used to coexist: verb-scoped keys (`ver_empleados`)
 * in lib/data/nav.ts, which nothing read, and module-scoped booleans in the
 * configuración page, which lived in localStorage and were therefore editable
 * by the user they were meant to restrict.
 *
 * There is now one vocabulary — `<module>:<action>` — and it is enforced in
 * three places: RLS policies in the database, `assertPermission` on the
 * server, and `can()` in the UI. The list below must stay in sync with the
 * `public.permissions` table (supabase/migrations/…_01_core.sql); the test in
 * src/lib/auth/permissions.test.ts pins that.
 */

/**
 * Every `<module>:<action>` in the product, derived from the module registry.
 *
 * This used to be a hand-written list of seventy-one strings that had to agree
 * with `MODULES`, with `NAV`, and with the INSERTs in the migrations. It is now
 * a projection: a module declares which actions it defines, and its permissions
 * follow. Adding `write` to a module that only had `read` is one word.
 *
 * `as const` is gone, and with it the literal union — the keys are no longer
 * knowable at compile time from this file alone. `Permission` is derived from
 * the registry's own shape below, which keeps the type exact without the list.
 */
export const PERMISSIONS: Permission[] = REGISTRY.flatMap((m) =>
  m.actions.map((action) => `${m.key}:${action}` as Permission),
)

/**
 * A permission key.
 *
 * Widened to a template literal rather than a union of the seventy-one actual
 * keys. The union was worth having when the list was written by hand — it made
 * a typo a compile error — but deriving the list from the registry means the
 * union could only come from a mapped type over `REGISTRY`, and that requires
 * the registry to be `as const` all the way down, which makes every entry
 * readonly and breaks the array methods the projections below use.
 *
 * `isPermission()` is the runtime check, and it is exact: it tests membership
 * of the derived list. The template literal stops `'nonsense'` and keeps
 * `'empleados:read'`; the test suite pins the whole set against the database.
 */
export type Permission = `${string}:${ModuleAction}`

/**
 * A role key.
 *
 * Deliberately `string` and not a union. Roles are tenant rows since migration
 * 24 — an administrator creates «Médico» or «Residente de obra» from the
 * Configuración screen — so the set is not knowable at compile time, and a
 * union here would have been a lie the moment the first customer used the
 * feature. Every value that reaches a write is checked against the
 * organization's own `roles` table instead; see `assertRole` in
 * src/server/mutations/settings.ts.
 */
export type RoleKey = string

/**
 * The three roles seeded into every new organization.
 *
 * A starting point, not a vocabulary: they can be renamed, stripped of every
 * permission and deleted like any other row. Nothing in the product derives
 * authority from these names — «administrator» means *holds
 * `configuracion:manage`*, which is what `app.is_org_admin` asks. They are
 * listed here only so the seed and the tests agree on what signup creates.
 */
export const SYSTEM_ROLES = ['Administrador', 'Líder de equipo', 'Empleado'] as const
export type SystemRoleKey = (typeof SYSTEM_ROLES)[number]

/** The role a new person gets when nothing more specific was chosen. */
export const DEFAULT_ROLE: SystemRoleKey = 'Empleado'

/** Presentation only: a stable colour per role, for organizations that kept the seeded three. */
export function isSystemRole(key: string): key is SystemRoleKey {
  return (SYSTEM_ROLES as readonly string[]).includes(key)
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value)
}

/**
 * Route segment → the permission that opens it.
 *
 * Aliases are folded in: `/dashboard/ordenes-compra` is its own screen but part
 * of Compras, so it maps to `compras:read` rather than to a permission of its
 * own. Deriving that removes the copy of the mapping that used to sit here and
 * could disagree with the nav.
 *
 * The action chosen is the *first* one the module declares, which is `read`
 * everywhere except `ia` (`use`) and — deliberately — `configuracion`, whose
 * screen opens on `configuracion:read` while changing anything needs `manage`.
 */
export const ROUTE_PERMISSIONS: Record<string, Permission> = Object.fromEntries(
  REGISTRY.flatMap((m) => {
    const permission = `${m.key}:${m.actions[0]}` as Permission
    return [
      [m.key, permission],
      ...(m.aliases ?? []).map((alias) => [alias.key, permission] as const),
    ]
  }),
)

/**
 * The verb a single permission grants, once its module is already named.
 *
 * Indexed by `string` rather than by `ModuleAction`: the configuración matrix
 * splits a permission key and looks the half up, and narrowing that back to the
 * union at every call site would be ceremony for a map that is total by
 * construction.
 */
export const ACTION_LABELS: Record<string, string> = {
  read: 'Ver',
  write: 'Gestionar',
  manage: 'Administrar',
  use: 'Usar',
}

/**
 * Human labels, derived where a formula works and stated where it does not.
 *
 * Twelve of the seventy-one are not `verb + module name`. «Ver riesgos», not
 * «Ver centro de riesgos»; «Ver inmuebles», not «Ver inmobiliario»; «Usar el
 * asistente de IA», which is a sentence. Those live on the registry entry as
 * `permissionNoun` or `permissionLabels`, so the exception sits next to the
 * module it belongs to instead of in a parallel map of seventy-one lines where
 * a missing entry is invisible.
 *
 * The test pins that this covers exactly `PERMISSIONS`, in both directions.
 */
export const PERMISSION_LABELS: Record<Permission, string> = Object.fromEntries(
  REGISTRY.flatMap((m) =>
    m.actions.map((action) => {
      const override = m.permissionLabels?.[action]
      const noun = m.permissionNoun ?? (m.shortLabel ?? m.label).toLowerCase()
      return [`${m.key}:${action}`, override ?? `${ACTION_LABELS[action]} ${noun}`]
    }),
  ),
)

/**
 * Display name of each module the permission matrix groups under.
 *
 * The matrix renders one row per module, so it needs a name that fits a row
 * heading — which is not always the sidebar's. «Centro de Riesgos» is a good
 * nav item and a bad table heading, so the registry carries a `shortLabel` for
 * the three where they differ.
 */
export const MODULE_LABELS: Record<string, string> = Object.fromEntries(
  REGISTRY.map((m) => [m.key, m.shortLabel ?? m.label]),
)


/** Groups permissions by module, for rendering the permission matrix. */
export function permissionsByModule(): Array<{ module: string; permissions: Permission[] }> {
  const groups = new Map<string, Permission[]>()
  for (const permission of PERMISSIONS) {
    const [module] = permission.split(':') as [string]
    const bucket = groups.get(module)
    if (bucket) bucket.push(permission)
    else groups.set(module, [permission])
  }
  return [...groups.entries()].map(([module, permissions]) => ({ module, permissions }))
}

/**
 * Pure predicate shared by server and client so both answer identically.
 * The server treats the answer as authoritative; the client only uses it to
 * avoid rendering controls that would be rejected anyway.
 */
export function can(granted: ReadonlySet<Permission> | readonly Permission[], permission: Permission): boolean {
  return Array.isArray(granted) ? granted.includes(permission) : (granted as ReadonlySet<Permission>).has(permission)
}
