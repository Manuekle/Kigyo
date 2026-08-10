import RequirePermission from '@/components/layout/RequirePermission'
import { getCanalesData } from '@/server/queries/canales'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent, and the channel list plus the active conversation are
 * read through RLS before any client code runs.
 */
export default function Page() {
  return (
    <RequirePermission permission="canales:read">
      <CanalesLoader />
    </RequirePermission>
  )
}

async function CanalesLoader() {
  const data = await getCanalesData()
  return <Client data={data} />
}
