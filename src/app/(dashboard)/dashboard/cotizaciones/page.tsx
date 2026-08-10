import RequirePermission from '@/components/layout/RequirePermission'
import { getCotizaciones } from '@/server/queries/cotizaciones'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent. Quotes carry real line items now, so the total is their
 * sum rather than a number typed beside them.
 */
export default function Page() {
  return (
    <RequirePermission permission="cotizaciones:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getCotizaciones()
  return <Client data={data} />
}
