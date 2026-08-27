import Link from 'next/link'
import { getMember, isCoreModule, moduleOf } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { PERMISSION_LABELS, type Permission } from '@/lib/auth/permissions'
import { MODULES } from '@/lib/modules'
import { lowestPlanWith, planAllows } from '@/lib/plans'
import { ShieldAlert, LayoutGrid, Lock } from '@/lib/icons'

/**
 * Server-side authorization gate for a route.
 *
 * Wrapping the page here means the client bundle for a module a user cannot
 * open is never even sent, and the check runs on the server regardless of what
 * the browser does. RLS still refuses the underlying rows independently — this
 * exists so the refusal is legible instead of an empty screen.
 *
 * Two refusals, not one. A module switched off for the whole organization and
 * a permission missing from your role are different problems with different
 * fixes, and telling an administrator "your rol no incluye Ver tienda" when
 * they hold every permission in the account sends them hunting for a switch
 * that would not have helped.
 */
export default async function RequirePermission({
  permission,
  children,
}: {
  permission: Permission
  children: React.ReactNode
}) {
  const member = await getMember()
  if (!member) return null

  const moduleKey = moduleOf(permission)
  const def = MODULES.find((m) => m.key === moduleKey)
  /**
   * Si quien mira puede arreglarlo por sí mismo.
   *
   * Es `configuracion:manage`, la misma clave que gobierna la pantalla a la que
   * apunta el enlace y la misma que `app.is_org_admin` pregunta en la base — no
   * el nombre de un rol, que desde la migración 24 no significa nada.
   */
  const puedeAdministrar = can(member.permissions, 'configuracion:manage')

  // Checked before the enabled-modules gate, and worded for the only person
  // who can act on it. A locked module is not "switched off" — no toggle in
  // Configuración will turn it on, so saying so would send an administrator
  // looking for a switch that is deliberately not there.
  if (!isCoreModule(moduleKey) && !planAllows(member.plan, moduleKey)) {
    const required = lowestPlanWith(moduleKey)
    /*
     * `<h2>`, not `<h1>`, in all three refusals below.
     *
     * The page already has its heading: `PageHeader` renders the module's name
     * above whatever this component returns, so the route is still «Nómina» and
     * this is the section explaining why it is empty. Two `<h1>`s on one screen
     * — one naming the page, one naming the refusal — is the shape a screen
     * reader cannot resolve into an outline.
     */
    return (
      <div className="access-denied" role="alert">
        <Lock size={28} aria-hidden="true" />
        <h2 className="access-denied-title">
          {def ? `${def.label} no está en tu plan` : 'Este módulo no está en tu plan'}
        </h2>
        <p className="access-denied-body">
          {def?.description}{' '}
          {required
            ? `Está incluido desde el plan ${required.label}.`
            : 'No está disponible en ningún plan actual.'}
        </p>
        <div className="access-denied-actions">
          <Link className="btn pri" href="/pricing">
            Ver planes
          </Link>
          <Link className="btn" href="/dashboard">
            Volver al dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (!member.modules.has(moduleKey)) {
    return (
      <div className="access-denied" role="alert">
        <LayoutGrid size={28} aria-hidden="true" />
        <h2 className="access-denied-title">
          {def ? `${def.label} no está activo` : 'Este módulo no está activo'}
        </h2>
        {/*
          Dos textos, porque son dos personas.

          Quien puede encenderlo casi siempre es quien está leyendo esto —el
          rail dice «Administrador» y el módulo lo apaga esa misma cuenta—, y a
          esa persona no se le explica dónde queda el interruptor: se le da.
          A quien no puede, se le dice a quién pedírselo, que es lo único que
          puede hacer con la información.
        */}
        <p className="access-denied-body">
          {def?.description
            ? `${def.description} Tu organización no lo tiene activado.`
            : 'Tu organización no tiene este módulo activado.'}{' '}
          {puedeAdministrar
            ? 'Puedes activarlo ahora en Configuración → Módulos.'
            : 'Una persona administradora puede activarlo en Configuración → Módulos.'}
        </p>
        <div className="access-denied-actions">
          {puedeAdministrar && (
            <Link className="btn pri" href="/dashboard/configuracion?tab=modulos">
              Activar en Configuración
            </Link>
          )}
          <Link className={puedeAdministrar ? 'btn' : 'btn pri'} href="/dashboard">
            Volver al dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (can(member.permissions, permission)) return <>{children}</>

  return (
    <div className="access-denied" role="alert">
      <ShieldAlert size={28} aria-hidden="true" />
      <h2 className="access-denied-title">No tienes acceso a esta sección</h2>
      <p className="access-denied-body">
        Tu rol no incluye el permiso <b>{PERMISSION_LABELS[permission]}</b>.{' '}
        {puedeAdministrar
          ? 'Puedes asignártelo en Configuración → Roles y permisos.'
          : 'Pide a una persona administradora de tu organización que te lo asigne desde Configuración.'}
      </p>
      <div className="access-denied-actions">
        {puedeAdministrar && (
          <Link className="btn pri" href="/dashboard/configuracion?tab=roles">
            Abrir Roles y permisos
          </Link>
        )}
        <Link className={puedeAdministrar ? 'btn' : 'btn pri'} href="/dashboard">
          Volver al dashboard
        </Link>
      </div>
    </div>
  )
}
