import RequirePermission from '@/components/layout/RequirePermission'
import { getContratos } from '@/server/queries/contratos'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent.
 */
export default function Page() {
  return (
    <RequirePermission permission="contratos:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getContratos()
  return <Client data={data} />
}
