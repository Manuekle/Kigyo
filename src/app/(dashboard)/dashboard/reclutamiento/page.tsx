import RequirePermission from '@/components/layout/RequirePermission'
import { getReclutamiento } from '@/server/queries/reclutamiento'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent, and the pipeline is read here rather than seeded into
 * `useState`.
 */
export default function Page() {
  return (
    <RequirePermission permission="reclutamiento:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getReclutamiento()
  return <Client data={data} />
}
