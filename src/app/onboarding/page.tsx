import { redirect } from 'next/navigation'
import { requireMember } from '@/lib/auth/session'
import { getSectors } from '@/server/queries/sectors'
import { getRoles } from '@/server/queries/roles'
import { getSites } from '@/server/queries/sites'
import Client from './client'

/**
 * The setup wizard, for whichever company is active.
 *
 * Deliberately outside the `(dashboard)` group. That layout redirects here when
 * a company's setup is unfinished, so a wizard living inside it would redirect
 * to itself — and it has no need for the sidebar, the topbar or the notification
 * count, none of which mean anything before the company is configured.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const member = await requireMember()

  /**
   * Already done, or not this person's to do.
   *
   * The gate is `configuracion:manage` in *this company* rather than ownership
   * of the account, which is the same move the flag itself made: an
   * administrator hired to run the new branch can set it up, and an account
   * owner who never joined it cannot — that is the rule in AGENTS.md §4, and
   * `complete_company_setup` enforces it independently.
   */
  if (member.setupCompleted || !member.permissions.has('configuracion:manage')) {
    redirect('/dashboard')
  }

  // Roles and branches are read here rather than by the steps that need them:
  // the wizard is one screen, and three round trips on step five would show an
  // empty picker for as long as they took.
  const [catalogue, roles, sites] = await Promise.all([
    getSectors(),
    getRoles(member.orgId),
    getSites(),
  ])

  return (
    <Client
      orgId={member.orgId}
      companyName={member.orgName}
      sector={member.companyType}
      catalogue={catalogue}
      plan={member.plan}
      /*
       * Si la cuenta ya está al día, el asistente no vuelve a vender.
       *
       * El paso «Plan» es el muro de pago de la migración 106 y es correcto
       * para la primera empresa de una cuenta nueva. Para la segunda —misma
       * cuenta, misma suscripción ya cobrada— ese paso no tenía salida:
       * ni «Saltar» ni «Terminar», sólo tres botones de pagar. Quien creaba
       * una empresa más se encontraba con que la única forma de terminar de
       * configurarla era comprar un segundo plan, y sin terminarla el panel
       * la devuelve al asistente. `maxCompanies` del plan ya es lo que cobra
       * por tener varias empresas; cobrarlas otra vez aquí sería cobrarlas dos
       * veces.
       */
      accountActive={member.account.accessState === 'active'}
      roles={roles.map((r) => ({ key: r.key, label: r.label }))}
      sites={sites.sites.map((s) => ({ id: s.id, name: s.name, city: s.city }))}
    />
  )
}
