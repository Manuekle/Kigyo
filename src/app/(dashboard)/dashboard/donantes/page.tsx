import RequirePermission from '@/components/layout/RequirePermission'
import { getDonantes } from '@/server/queries/donantes'
import Client from './client'

/** Server shell. Authorization runs here, before any client bundle is sent. */
export default function Page() {
  return (
    <RequirePermission permission="donantes:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getDonantes()
  return <Client data={data} />
}
