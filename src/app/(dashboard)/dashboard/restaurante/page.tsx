import RequirePermission from '@/components/layout/RequirePermission'
import { getRestaurante } from '@/server/queries/restaurante'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent.
 */
export default function Page() {
  return (
    <RequirePermission permission="restaurante:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getRestaurante()
  return <Client data={data} />
}
