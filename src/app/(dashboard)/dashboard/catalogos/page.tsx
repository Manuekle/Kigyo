import RequirePermission from '@/components/layout/RequirePermission'
import { getCatalogos } from '@/server/queries/productos'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent. Catálogos and Tienda read the same `products` rows now,
 * so the two screens cannot quote different prices for the same item.
 */
export default function Page() {
  return (
    <RequirePermission permission="catalogos:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getCatalogos()
  return <Client data={data} />
}
