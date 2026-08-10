import RequirePermission from '@/components/layout/RequirePermission'
import { getCompras } from '@/server/queries/compras'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent. Orders are read from the same query Compras uses, so the
 * requisition an order came from is one join away rather than a coincidence of
 * two separate fixtures.
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
