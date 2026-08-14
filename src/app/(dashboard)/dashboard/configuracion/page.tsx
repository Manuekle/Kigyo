import RequirePermission from '@/components/layout/RequirePermission'
import { getSettings } from '@/server/queries/settings'
import { getSites } from '@/server/queries/sites'
import Client from './client'

/**
 * Server shell. Authorization runs here, and the organization, permission
 * matrix and member list are read through RLS before any client code runs.
 */
export default function Page() {
  return (
    <RequirePermission permission="configuracion:read">
      <SettingsLoader />
    </RequirePermission>
  )
}

async function SettingsLoader() {
  // In parallel: neither read depends on the other, and the branch list is
  // small enough that fetching it up front beats a second round trip when the
  // Sucursales tab is opened.
  const [data, sites] = await Promise.all([getSettings(), getSites()])
  return <Client data={data} sites={sites} />
}
