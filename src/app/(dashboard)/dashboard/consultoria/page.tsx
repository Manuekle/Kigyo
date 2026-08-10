import RequirePermission from '@/components/layout/RequirePermission'
import { getConsultoria } from '@/server/queries/consultoria'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent. Sessions are real calendar events now, so "revisa el
 * Calendario" is a claim the page can back up.
 */
export default function Page() {
  return (
    <RequirePermission permission="consultoria:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getConsultoria()
  return <Client data={data} />
}
