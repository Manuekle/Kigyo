import RequirePermission from '@/components/layout/RequirePermission'
import { getPuestos } from '@/server/queries/puestos'
import Client from './client'

/** Server shell. Authorization runs here, before any client bundle is sent. */
export default function Page() {
  return (
    <RequirePermission permission="puestos:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getPuestos()
  return <Client data={data} />
}
