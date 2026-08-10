import RequirePermission from '@/components/layout/RequirePermission'
import { getDesempeno } from '@/server/queries/desempeno'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent.
 */
export default function Page() {
  return (
    <RequirePermission permission="desempeno:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getDesempeno()
  return <Client data={data} />
}
