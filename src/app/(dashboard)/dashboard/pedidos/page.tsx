import RequirePermission from '@/components/layout/RequirePermission'
import Client from './client'
import { getPedidos } from '@/server/queries/pedidos'

export default function Page() {
  return (
    <RequirePermission permission="pedidos:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getPedidos()
  return <Client data={data} />
}