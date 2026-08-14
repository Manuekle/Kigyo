import RequirePermission from '@/components/layout/RequirePermission'
import { getReportes } from '@/server/queries/reportes'
import Client from './client'

/** Server shell. Authorization runs here, before any client bundle is sent. */
export default function Page() {
  return (
    <RequirePermission permission="reportes:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getReportes()
  return <Client data={data} />
}
