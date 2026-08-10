import RequirePermission from '@/components/layout/RequirePermission'
import { getTickets } from '@/server/queries/tickets'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent, and the board is read here rather than seeded into
 * `useState` — which is what made every drag between columns undone by the
 * next reload.
 */
export default function Page() {
  return (
    <RequirePermission permission="tickets:read">
      <Loader />
    </RequirePermission>
  )
}

/**
 * Split out so the read runs *after* `RequirePermission` has answered. Called
 * from the component it guards, `getTickets()` would run — and throw — for a
 * member the guard is about to turn away.
 */
async function Loader() {
  const data = await getTickets()
  return <Client data={data} />
}
