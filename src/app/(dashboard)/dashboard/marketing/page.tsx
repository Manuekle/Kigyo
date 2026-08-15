import RequirePermission from '@/components/layout/RequirePermission'
import { getMarketing } from '@/server/queries/marketing'
import Client from './client'

/** Server shell. Authorization runs here, before any client bundle is sent. */
export default function Page() {
  return (
    <RequirePermission permission="marketing:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getMarketing()
  return <Client data={data} />
}
