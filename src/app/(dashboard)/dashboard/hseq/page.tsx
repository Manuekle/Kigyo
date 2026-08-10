import RequirePermission from '@/components/layout/RequirePermission'
import { getHseq } from '@/server/queries/hseq'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent. Reports, their checklists and their follow-up notes all
 * come from the database, so ticking a checklist item survives a reload.
 */
export default function Page() {
  return (
    <RequirePermission permission="hseq:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getHseq()
  return <Client data={data} />
}
