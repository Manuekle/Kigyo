import RequirePermission from '@/components/layout/RequirePermission'
import { getLeads } from '@/server/queries/leads'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent.
 */
export default function Page() {
  return (
    <RequirePermission permission="leads:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getLeads()
  return <Client data={data} />
}
