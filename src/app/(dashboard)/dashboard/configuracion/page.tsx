import RequirePermission from '@/components/layout/RequirePermission'
import { getSettings } from '@/server/queries/settings'
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
  const data = await getSettings()
  return <Client data={data} />
}
