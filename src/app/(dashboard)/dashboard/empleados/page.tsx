import RequirePermission from '@/components/layout/RequirePermission'
import { getEmpleados } from '@/server/queries/empleados'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent, and the directory is read here rather than seeded into
 * `useState` on the client — which is what made a newly added person vanish on
 * reload.
 */
export default async function Page() {
  return (
    <RequirePermission permission="empleados:read">
      <Loader />
    </RequirePermission>
  )
}

/**
 * Split out so the read happens *after* `RequirePermission` has answered.
 * Called from the same component it guards, `getEmpleados()` would run — and
 * throw — for a member the guard is about to turn away.
 */
async function Loader() {
  const data = await getEmpleados()
  return <Client data={data} />
}
