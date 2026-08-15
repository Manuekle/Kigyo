import RequirePermission from '@/components/layout/RequirePermission'
import { getContabilidad } from '@/server/queries/contabilidad'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent.
 */
export default function Page() {
  return (
    <RequirePermission permission="contabilidad:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getContabilidad()
  return <Client data={data} />
}
