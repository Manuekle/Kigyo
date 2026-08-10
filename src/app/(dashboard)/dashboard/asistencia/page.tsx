import RequirePermission from '@/components/layout/RequirePermission'
import { getAsistencia } from '@/server/queries/asistencia'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent, and absences and balances are read here rather than
 * seeded into `useState` from a fixture keyed by employee name.
 */
export default function Page() {
  return (
    <RequirePermission permission="asistencia:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getAsistencia()
  return <Client data={data} />
}
