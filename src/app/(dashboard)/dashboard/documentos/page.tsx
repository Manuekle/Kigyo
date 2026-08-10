import RequirePermission from '@/components/layout/RequirePermission'
import { getDocumentos } from '@/server/queries/documentos'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent. Documents come from the `documents` table and their
 * files from the private `documents` bucket — the upload is a real transfer
 * now, not three `setTimeout`s over a progress bar.
 */
export default function Page() {
  return (
    <RequirePermission permission="documentos:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getDocumentos()
  return <Client data={data} />
}
