import RequirePermission from '@/components/layout/RequirePermission'
import { getCapacitacion } from '@/server/queries/capacitacion'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent.
 */
export default function Page() {
  return (
    <RequirePermission permission="capacitacion:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getCapacitacion()
  return <Client data={data} />
}
