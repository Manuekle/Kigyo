import RequirePermission from '@/components/layout/RequirePermission'
import { getNomina } from '@/server/queries/nomina'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent. Payroll is read from `payroll_periods` / `payroll_lines`
 * rather than from six typed-in department totals.
 */
export default function Page() {
  return (
    <RequirePermission permission="nomina:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const data = await getNomina()
  return <Client data={data} />
}
