import RequirePermission from '@/components/layout/RequirePermission'
import { getCalendario } from '@/server/queries/calendario'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent. The month is read on the server so the first paint is
 * the real calendar rather than a fixture pinned to June 2026.
 */
export default function Page() {
  return (
    <RequirePermission permission="calendario:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getCalendario()
  return <Client data={data} />
}
