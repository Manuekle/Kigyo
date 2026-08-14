import RequirePermission from '@/components/layout/RequirePermission'
import { getCreditos } from '@/server/queries/creditos'
import Client from './client'

/** Server shell. Authorization runs here, before any client bundle is sent. */
export default function Page() {
  return (
    <RequirePermission permission="creditos:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getCreditos()
  return <Client data={data} />
}
