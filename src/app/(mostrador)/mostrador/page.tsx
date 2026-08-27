import RequirePermission from '@/components/layout/RequirePermission'
import { getPos } from '@/server/queries/pos'
import Client from '@/app/(dashboard)/dashboard/pos/client'

/**
 * The same POS, full screen.
 *
 * One client, not a copy: the cart, the barcode scanner, the offline outbox and
 * the receipt printer are the hard parts and there must be exactly one of each.
 * What changes is the shell around it — see `(mostrador)/layout.tsx`.
 */
export default function Page() {
  return (
    <RequirePermission permission="pos:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getPos()
  return <Client data={data} fullscreen />
}
