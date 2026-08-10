import RequirePermission from '@/components/layout/RequirePermission'
import { getCompras } from '@/server/queries/compras'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent. Approving a requisition now generates a real purchase
 * order that keeps `purchase_request_id` — the chain the two screens used to
 * only claim.
 */
export default function Page() {
  return (
    <RequirePermission permission="compras:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getCompras()
  return <Client data={data} />
}
