import RequirePermission from '@/components/layout/RequirePermission'
import { getSuscripciones } from '@/server/queries/suscripciones'
import Client from './client'

/** Server shell. Authorization runs here, before any client bundle is sent. */
export default function Page() {
  return (
    <RequirePermission permission="suscripciones:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getSuscripciones()
  return <Client data={data} />
}
