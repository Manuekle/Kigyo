import RequirePermission from '@/components/layout/RequirePermission'
import { getIntegraciones } from '@/server/queries/integraciones'
import Client from './client'

/** Server shell. Authorization runs here, before any client bundle is sent. */
export default function Page() {
  return (
    <RequirePermission permission="integraciones:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getIntegraciones()
  return <Client data={data} />
}
