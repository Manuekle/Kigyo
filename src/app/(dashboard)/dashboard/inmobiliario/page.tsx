import RequirePermission from '@/components/layout/RequirePermission'
import { getInmobiliario } from '@/server/queries/inmobiliario'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent.
 */
export default function Page() {
  return (
    <RequirePermission permission="inmobiliario:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getInmobiliario()
  return <Client data={data} />
}
