import { Suspense } from 'react'
import RequirePermission from '@/components/layout/RequirePermission'
import { getAuditLog } from '@/server/queries/audit'
import Loading from './loading'
import Client from './client'

/**
 * Server shell. Authorization runs here, and the audit trail is read through
 * RLS before any client code runs.
 */
export default function Page() {
  return (
    <RequirePermission permission="trazabilidad:read">
      <Suspense fallback={<Loading />}>
        <AuditLoader />
      </Suspense>
    </RequirePermission>
  )
}

async function AuditLoader() {
  const { entries, nextCursor } = await getAuditLog({ limit: 200 })
  return <Client entries={entries} nextCursor={nextCursor} />
}
