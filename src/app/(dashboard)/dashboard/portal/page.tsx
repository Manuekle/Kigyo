import RequirePermission from '@/components/layout/RequirePermission'
import { getPortal } from '@/server/queries/portal'
import Client from './client'

/** Server shell. Authorization runs here, before any client bundle is sent. */
export default function Page() {
  return (
    <RequirePermission permission="portal:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getPortal()
  return <Client data={data} />
}
