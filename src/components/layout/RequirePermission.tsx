import Link from 'next/link'
import { hasPermission } from '@/lib/auth/session'
import { PERMISSION_LABELS, type Permission } from '@/lib/auth/permissions'
import { ShieldAlert } from '@/lib/icons'

/**
 * Server-side authorization gate for a route.
 *
 * Wrapping the page here means the client bundle for a module a user cannot
 * open is never even sent, and the check runs on the server regardless of what
 * the browser does. RLS still refuses the underlying rows independently — this
 * exists so the refusal is legible instead of an empty screen.
 */
export default async function RequirePermission({
  permission,
  children,
}: {
  permission: Permission
  children: React.ReactNode
}) {
  if (await hasPermission(permission)) return <>{children}</>

  return (
    <div className="access-denied" role="alert">
      <ShieldAlert size={28} aria-hidden="true" />
      <h1 className="access-denied-title">No tienes acceso a esta sección</h1>
      <p className="access-denied-body">
        Tu rol no incluye el permiso <b>{PERMISSION_LABELS[permission]}</b>. Pide a una persona
        administradora de tu organización que te lo asigne desde Configuración.
      </p>
      <Link className="btn pri" href="/dashboard">
        Volver al dashboard
      </Link>
    </div>
  )
}
