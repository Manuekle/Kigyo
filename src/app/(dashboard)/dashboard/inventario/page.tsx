import RequirePermission from '@/components/layout/RequirePermission'
import { getInventario } from '@/server/queries/inventario'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent. Assets and stock orders come from the database, so an
 * assignment survives a reload — and storefront orders land in the same list.
 */
export default function Page() {
  return (
    <RequirePermission permission="inventario:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getInventario()
  return <Client data={data} />
}
