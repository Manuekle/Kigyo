import { describe, expect, it } from 'vitest'
import { can, PERMISSIONS, ROUTE_PERMISSIONS, type Permission } from './permissions'
import { resolveModules } from '../modules'

/**
 * The two-gate access model, tested as a pure decision.
 *
 * `requirePermission()` and `RequirePermission` both do the same thing in the
 * same order: module first, then permission. The functions themselves need a
 * Supabase session to run, so what is pinned here is the decision they make,
 * plus the fact that the two answers are genuinely independent — conflating
 * them is the bug this model exists to prevent.
 */

/** Mirrors `moduleOf()` in session.ts, which imports `server-only`. */
const moduleOf = (permission: Permission) => permission.split(':')[0]

interface Caller {
  modules: Set<string>
  permissions: Permission[]
}

type Verdict = 'ok' | 'module-disabled' | 'permission-denied'

/** The exact order both guards apply: outermost gate first. */
function decide(caller: Caller, permission: Permission): Verdict {
  if (!caller.modules.has(moduleOf(permission))) return 'module-disabled'
  if (!can(caller.permissions, permission)) return 'permission-denied'
  return 'ok'
}

const admin = (modules: string[]): Caller => ({
  modules: resolveModules(modules, null),
  permissions: [...PERMISSIONS],
})

describe('module gate and permission gate are independent', () => {
  it('allows when the module is on and the role holds the permission', () => {
    expect(decide(admin(['tienda']), 'tienda:read')).toBe('ok')
  })

  it('refuses an administrator when the company does not use the module', () => {
    // The whole point of the split. An administrator holds every permission,
    // so a single-gate model would let them into a store the organization
    // switched off — and then tell them their role was the problem.
    const caller: Caller = {
      modules: resolveModules(['empleados'], null),
      permissions: [...PERMISSIONS],
    }
    expect(decide(caller, 'tienda:read')).toBe('module-disabled')
  })

  it('refuses a role without the permission even when the module is on', () => {
    const caller: Caller = {
      modules: resolveModules(['nomina'], null),
      permissions: ['nomina:read'],
    }
    expect(decide(caller, 'nomina:write')).toBe('permission-denied')
  })

  it('reports the module problem first when both gates would refuse', () => {
    // Order matters for the message: "your role lacks Ver tienda" sends an
    // administrator hunting for a permission they already have.
    const caller: Caller = { modules: resolveModules(['empleados'], null), permissions: [] }
    expect(decide(caller, 'tienda:read')).toBe('module-disabled')
  })

  it('never gates the core shell behind a module toggle', () => {
    // `configuracion` is how a module gets switched back on. If it could be
    // gated, an organization could lock itself out permanently.
    const caller: Caller = { modules: resolveModules([], 'otro'), permissions: [...PERMISSIONS] }
    expect(decide(caller, 'configuracion:manage')).toBe('ok')
    expect(decide(caller, 'dashboard:read')).toBe('ok')
  })
})

describe('every route is reachable by an administrator of a full account', () => {
  it('resolves a verdict of ok for each route permission', () => {
    // Catches a route whose permission is missing from PERMISSIONS, or whose
    // module never appears in any preset — both of which produce a page that
    // nobody can open.
    const caller = admin([])
    for (const [route, permission] of Object.entries(ROUTE_PERMISSIONS)) {
      expect(decide(caller, permission), `${route} → ${permission}`).toBe('ok')
    }
  })
})

describe('permission vocabulary', () => {
  it('every permission is <module>:<action> with both halves non-empty', () => {
    for (const permission of PERMISSIONS) {
      const parts = permission.split(':')
      expect(parts, permission).toHaveLength(2)
      expect(parts[0].length, permission).toBeGreaterThan(0)
      expect(parts[1].length, permission).toBeGreaterThan(0)
    }
  })

  it('can() agrees between the array and the set form', () => {
    // The server holds a Set, the client an array. A disagreement here means
    // the UI hides a control the server would allow, or worse, the reverse.
    const list: Permission[] = ['tickets:read', 'tickets:write']
    const set = new Set(list)
    for (const permission of PERMISSIONS) {
      expect(can(list, permission), permission).toBe(can(set, permission))
    }
  })
})

/**
 * La suspensión, como decisión, en los dos caminos que llegan a los datos.
 *
 * `requirePermission()` la aplica para Server Functions. `route()` en
 * lib/api/handler.ts no la aplicaba, y seis de las siete rutas de la API piden
 * un permiso de escritura (`ia:use`, `documentos:write`), así que una empresa
 * impaga seguía llamando al modelo por HTTP.
 *
 * La regla es una sola y tiene que ser la misma en los dos sitios: leer siempre
 * se puede, escribir no. Lo que se pinea aquí es esa regla, no la función —
 * ambas necesitan una sesión de Supabase para correr.
 */
describe('una empresa suspendida lee pero no escribe', () => {
  const suspendedRefuses = (permission: Permission) => !permission.endsWith(':read')

  it('deja pasar toda lectura', () => {
    for (const p of PERMISSIONS.filter((k) => k.endsWith(':read'))) {
      expect(suspendedRefuses(p), `${p} debería poder leerse suspendida`).toBe(false)
    }
  })

  it('niega toda escritura, incluidas las que no se llaman write', () => {
    // `ia:use` y `configuracion:manage` no terminan en `:write` y son escrituras
    // igualmente — una consume crédito de Foundry, la otra reparte permisos.
    // Una regla escrita sobre `:write` las habría dejado pasar a las dos.
    const writes = PERMISSIONS.filter((k) => !k.endsWith(':read'))
    expect(writes).toContain('ia:use')
    expect(writes).toContain('configuracion:manage')
    for (const p of writes) {
      expect(suspendedRefuses(p), `${p} debería negarse suspendida`).toBe(true)
    }
  })

  it('la suspensión se decide antes que el módulo y el permiso', () => {
    // El orden importa porque cada puerta manda a la persona a un sitio
    // distinto, y la de la suspensión es la única cuya salida es pagar.
    // Un administrador con todos los permisos de una empresa suspendida tiene
    // que leer «el plan está inactivo», no «te falta un permiso».
    const admin: Caller = { modules: new Set(['ia']), permissions: ['ia:use'] }
    expect(decide(admin, 'ia:use')).toBe('ok')
    expect(suspendedRefuses('ia:use')).toBe(true)
  })
})

/**
 * Las dos puertas, en los tres sitios que las aplican.
 *
 * Módulo y permiso son ortogonales: uno responde «esta empresa usa X», el otro
 * «esta persona puede ver X». Comprobar solo el segundo deja que apagar un
 * módulo en Configuración lo quite del menú y no de los datos.
 *
 * Pasó en dos sitios a la vez y ninguno lo notó porque los dos «funcionaban»:
 * `buildTools()` armaba las herramientas de IA con `can()` a secas, así que una
 * empresa sin Inventario podía preguntarle sus existencias al asistente; y
 * `/api/v1/export` no podía apoyarse en el gate de `route()` —el módulo llega
 * en el cuerpo de la petición, no en las opciones— así que exportaba a Excel lo
 * que su pantalla ya no mostraba.
 */
describe('apagar un módulo lo apaga en todas partes', () => {
  const conModulo: Caller = {
    modules: new Set(['inventario']),
    permissions: ['inventario:read'],
  }
  // El caso real: el módulo se apaga en Configuración y el rol conserva el
  // permiso, porque `role_permissions` no se toca al apagar un módulo.
  const sinModulo: Caller = { modules: new Set(), permissions: ['inventario:read'] }

  it('el permiso solo no basta', () => {
    expect(decide(conModulo, 'inventario:read')).toBe('ok')
    expect(decide(sinModulo, 'inventario:read')).toBe('module-disabled')
  })

  it('la regla es la misma que usa buildTools y el export', () => {
    // Idéntica a la de `lib/ai/tools.ts` y `api/v1/export/route.ts`.
    const dosPuertas = (c: Caller, p: Permission) =>
      c.modules.has(p.split(':')[0]) && can(c.permissions, p)

    expect(dosPuertas(conModulo, 'inventario:read')).toBe(true)
    expect(dosPuertas(sinModulo, 'inventario:read')).toBe(false)
  })
})
