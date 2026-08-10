import RequirePermission from '@/components/layout/RequirePermission'
import { getPacientes } from '@/server/queries/pacientes'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent — which matters more here than anywhere else in the app,
 * since the bundle would otherwise carry clinical data to the browser.
 */
export default function Page() {
  return (
    <RequirePermission permission="pacientes:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getPacientes()
  return <Client data={data} />
}
