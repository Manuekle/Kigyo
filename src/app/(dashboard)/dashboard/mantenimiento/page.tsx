import RequirePermission from '@/components/layout/RequirePermission'
import { getMantenimiento } from '@/server/queries/mantenimiento'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent.
 */
export default function Page() {
  return (
    <RequirePermission permission="mantenimiento:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getMantenimiento()
  return <Client data={data} />
}
