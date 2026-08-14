import RequirePermission from '@/components/layout/RequirePermission'
import { getNotifPanel } from '@/server/queries/notif-panel'
import Client from './client'

/** Server shell. Authorization runs here, before any client bundle is sent. */
export default function Page() {
  return (
    <RequirePermission permission="notificaciones:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getNotifPanel()
  return <Client data={data} />
}
