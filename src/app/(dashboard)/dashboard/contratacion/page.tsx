import RequirePermission from '@/components/layout/RequirePermission'
import { getContratacion } from '@/server/queries/contratacion'
import Client from './client'

/** Server shell. Authorization runs here, before any client bundle is sent. */
export default function Page() {
  return (
    <RequirePermission permission="contratacion:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getContratacion()
  return <Client data={data} />
}
