import RequirePermission from '@/components/layout/RequirePermission'
import { getTienda } from '@/server/queries/productos'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent. The storefront reads the same `products` rows as the
 * catalogue — filtered to what is offered for sale, and without `cost_cents`,
 * which a shop page has no reason to receive.
 */
export default function Page() {
  return (
    <RequirePermission permission="tienda:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getTienda()
  return <Client data={data} />
}
