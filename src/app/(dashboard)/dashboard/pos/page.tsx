import RequirePermission from '@/components/layout/RequirePermission'
import { getPos } from '@/server/queries/pos'
import Client from './client'

/** Server shell. Authorization runs here, before any client bundle is sent. */
export default function Page() {
  return (
    <RequirePermission permission="pos:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getPos()
  return <Client data={data} />
}
