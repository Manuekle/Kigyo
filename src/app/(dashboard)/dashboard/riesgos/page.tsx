import RequirePermission from '@/components/layout/RequirePermission'
import { getRiesgos } from '@/server/queries/riesgos'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent, and the register is read here rather than seeded into
 * `useState` — which is what made "Gestionar" a change that lasted until the
 * next reload.
 */
export default function Page() {
  return (
    <RequirePermission permission="riesgos:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getRiesgos()
  return <Client data={data} />
}
