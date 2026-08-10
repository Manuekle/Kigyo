import RequirePermission from '@/components/layout/RequirePermission'
import { getProyectos } from '@/server/queries/proyectos'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent, and the project list is read here rather than seeded
 * into `useState` — which is what made a new project vanish on reload.
 */
export default function Page() {
  return (
    <RequirePermission permission="proyectos:read">
      <Loader />
    </RequirePermission>
  )
}

/**
 * Split out so the read runs *after* `RequirePermission` has answered. Called
 * from the component it guards, `getProyectos()` would run — and throw — for a
 * member the guard is about to turn away.
 */
async function Loader() {
  const data = await getProyectos()
  return <Client data={data} />
}
