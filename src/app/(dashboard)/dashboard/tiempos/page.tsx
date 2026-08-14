import RequirePermission from '@/components/layout/RequirePermission'
import { getTiempos } from '@/server/queries/tiempos'
import Client from './client'

/** Server shell. Authorization runs here, before any client bundle is sent. */
export default function Page() {
  return (
    <RequirePermission permission="tiempos:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getTiempos()
  return <Client data={data} />
}
