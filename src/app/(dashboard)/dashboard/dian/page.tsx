import RequirePermission from '@/components/layout/RequirePermission'
import { getDianPanel } from '@/server/queries/dian'
import Client from './client'

/**
 * Panel de facturación electrónica DIAN (modo demo).
 *
 * El botón de pago-permiso es `facturacion:read`: un documento DIAN es la
 * cara fiscal de una factura, y la integración se gestiona desde
 * `/dashboard/integraciones`. Ruta nueva, no navegable desde el menú por
 * ahora — se accede vía Integraciones.
 */
export default function Page() {
  return (
    <RequirePermission permission="facturacion:read">
      <Loader />
    </RequirePermission>
  )
}

async function Loader() {
  const data = await getDianPanel()
  return <Client data={data} />
}