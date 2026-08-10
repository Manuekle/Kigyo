import { notFound } from 'next/navigation'
import RequirePermission from '@/components/layout/RequirePermission'
import { getEmpleadoDetail } from '@/server/queries/empleados'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent, and the profile is read here — the client used to pull
 * the id out of `useParams()` and look it up in a fixture keyed by name.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <RequirePermission permission="empleados:read">
      <Loader params={params} />
    </RequirePermission>
  )
}

/**
 * Split out so the read happens *after* `RequirePermission` has answered:
 * called from the component it guards, `getEmpleadoDetail()` would run — and
 * throw — for a member the guard is about to turn away.
 */
async function Loader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Not a uuid at all: this is a stale link from when the directory used
  // numeric fixture ids, not a missing person. Same answer either way.
  const detail = /^[0-9a-f-]{36}$/i.test(id) ? await getEmpleadoDetail(id) : null
  if (!detail) notFound()

  return <Client data={detail} />
}
