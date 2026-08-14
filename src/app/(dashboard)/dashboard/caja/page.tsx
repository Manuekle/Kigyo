import RequirePermission from '@/components/layout/RequirePermission'
import { getCaja } from '@/server/queries/caja'
import Client from './client'

/** Server shell. Authorization runs here, before any client bundle is sent. */
export default function Page() {
  return (
    <RequirePermission permission="caja:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getCaja()
  return <Client data={data} />
}
