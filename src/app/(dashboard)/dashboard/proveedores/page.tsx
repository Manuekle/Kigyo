import RequirePermission from '@/components/layout/RequirePermission'
import Client from './client'
import { getProveedores } from '@/server/queries/proveedores'

export default function Page() {
  return (
    <RequirePermission permission="inventario:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getProveedores()
  return <Client data={data} />
}