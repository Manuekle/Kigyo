import RequirePermission from '@/components/layout/RequirePermission'
import { getCartera } from '@/server/queries/cartera'
import Client from './client'

/** Server shell. Authorization runs here, before any client bundle is sent. */
export default function Page() {
  return (
    <RequirePermission permission="cartera:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getCartera()
  return <Client data={data} />
}
