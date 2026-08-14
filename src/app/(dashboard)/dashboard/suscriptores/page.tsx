import RequirePermission from '@/components/layout/RequirePermission'
import { getSuscriptores } from '@/server/queries/suscriptores'
import Client from './client'

/** Server shell. Authorization runs here, before any client bundle is sent. */
export default function Page() {
  return (
    <RequirePermission permission="suscriptores:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getSuscriptores()
  return <Client data={data} />
}
