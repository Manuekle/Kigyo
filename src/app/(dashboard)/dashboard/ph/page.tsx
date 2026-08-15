import RequirePermission from '@/components/layout/RequirePermission'
import { getPh } from '@/server/queries/ph'
import Client from './client'

/** Server shell. Authorization runs here, before any client bundle is sent. */
export default function Page() {
  return (
    <RequirePermission permission="ph:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getPh()
  return <Client data={data} />
}
