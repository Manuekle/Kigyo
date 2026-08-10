import RequirePermission from '@/components/layout/RequirePermission'
import { getDashboard } from '@/server/queries/dashboard'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent, and every figure on the overview is counted here from
 * the tables the rest of the app writes to.
 */
export default function Page() {
  return (
    <RequirePermission permission="dashboard:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getDashboard()
  return <Client data={data} />
}
