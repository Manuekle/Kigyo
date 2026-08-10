import RequirePermission from '@/components/layout/RequirePermission'
import { getFirmas } from '@/server/queries/firmas'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent. Requests come from `signature_requests`, so signing one
 * survives a reload.
 */
export default function Page() {
  return (
    <RequirePermission permission="firmas:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getFirmas()
  return <Client data={data} />
}
