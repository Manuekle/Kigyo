import RequirePermission from '@/components/layout/RequirePermission'
import { getObra } from '@/server/queries/obra'
import Client from './client'

/** Server shell. Authorization runs here, before any client bundle is sent. */
export default function Page() {
  return (
    <RequirePermission permission="obra:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getObra()
  return <Client data={data} />
}
