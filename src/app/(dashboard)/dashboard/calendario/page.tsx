import RequirePermission from '@/components/layout/RequirePermission'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent.
 */
export default function Page() {
  return (
    <RequirePermission permission="calendario:read">
      <Client />
    </RequirePermission>
  )
}
