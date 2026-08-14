'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Check, ChevronRight } from '@/lib/icons'
import { useMember } from '@/lib/context/MemberContext'
import { useApp } from '@/lib/context/AppContext'
import { companyType } from '@/lib/modules'
import { switchCompany } from '@/server/mutations/companies'
import { DROPDOWN_CLOSE_MS, dropdownClass, useExitTransition } from '@/lib/hooks/use-exit-transition'

/**
 * Which company you are working in, and how to change it.
 *
 * Sits at the top of the sidebar, above the navigation, rather than inside the
 * user menu at the bottom. Changing company is a change of *context* — it swaps
 * the data, the modules and the permissions under every screen — not a change
 * of profile, and it has to be visible without opening anything. The failure
 * this prevents is mundane and expensive: recording an invoice, a shift or a
 * patient in the wrong business because nothing on screen said which one was
 * open.
 *
 * Hidden entirely for the single-company case, which is almost everybody. A
 * dropdown with one entry is not a choice.
 */
export default function CompanySwitcher() {
  const member = useMember()
  const router = useRouter()
  const { addToast } = useApp()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const menu = useExitTransition(open, DROPDOWN_CLOSE_MS)

  /**
   * Shown when there is a choice to make, or when there is a screen worth
   * reaching.
   *
   * The single-company case still gets the control if this person governs the
   * account — otherwise "Nueva empresa" would be unreachable for exactly the
   * customer who is about to need it, since /dashboard/empresas has no nav
   * entry and no other entry point.
   */
  const governsAccount = member.account.role === 'owner' || member.account.role === 'admin'
  if (!member.hasMultipleCompanies && !governsAccount) return null

  const active = member.companies.find((c) => c.orgId === member.orgId)

  /**
   * The companies, grouped by the account that owns them.
   *
   * Insertion order is preserved, and `member.companies` arrives
   * most-recently-used first — so the group somebody is working in stays at the
   * top of the menu instead of the list re-sorting itself alphabetically under
   * them every time they switch.
   */
  const groups: Array<{ accountId: string; name: string; companies: typeof member.companies }> = []
  for (const company of member.companies) {
    const existing = groups.find((g) => g.accountId === company.accountId)
    if (existing) existing.companies.push(company)
    else groups.push({ accountId: company.accountId, name: company.accountName, companies: [company] })
  }

  function choose(orgId: string) {
    setOpen(false)
    if (orgId === member.orgId) return

    startTransition(async () => {
      const result = await switchCompany(orgId)
      if (!result.ok) {
        addToast(result.error, 'err')
        return
      }
      /**
       * Back to the dashboard, deliberately, rather than staying put.
       *
       * The current route may not exist in the company being entered: modules
       * are per company, so someone standing on /dashboard/pacientes in the
       * clinic and switching to the restaurant would land on a page that
       * company does not have. `requirePermission` would refuse it correctly,
       * but arriving at a refusal is a bad way to learn you changed company.
       */
      router.push('/dashboard')
      router.refresh()
    })
  }

  return (
    <div className="cswitch">
      {menu.render && (
        <>
          <div className="popcatch" onClick={() => setOpen(false)} />
          <div
            className={`cswitch-menu ${dropdownClass(menu.shown, menu.closing)}`}
            role="menu"
            aria-label="Cambiar de empresa"
          >
            {groups.map((group, i) => (
              <div key={group.accountId || `sin-cuenta-${i}`}>
                {/* Headings only when there is more than one group. With a
                    single account every heading would repeat the same word
                    over a list that is already short. */}
                {member.hasMultipleAccounts && (
                  <div className="cswitch-group" role="presentation">{group.name}</div>
                )}
                {group.companies.map((company) => {
                  const sector = companyType(company.companyType)
                  const isActive = company.orgId === member.orgId
                  return (
                    <button
                      key={company.orgId}
                      className={`cswitch-item${isActive ? ' on' : ''}`}
                      role="menuitemradio"
                      aria-checked={isActive}
                      onClick={() => choose(company.orgId)}
                    >
                      <div className="cswitch-item-text">
                        <span className="cswitch-item-name">{company.name}</span>
                        {/* The role, because it genuinely differs between
                            companies — an administrator of the clinic can be a
                            plain Empleado of the restaurant, and knowing that
                            before switching saves a confused minute. */}
                        <span className="cswitch-item-meta">
                          {sector ? `${sector.label} · ` : ''}{company.role}
                        </span>
                      </div>
                      {isActive && <Check size={15} />}
                    </button>
                  )
                })}
              </div>
            ))}

            {governsAccount && (
              <>
                <div className="cswitch-div" role="separator" />
                <button
                  className="cswitch-item"
                  role="menuitem"
                  onClick={() => { setOpen(false); router.push('/dashboard/empresas') }}
                >
                  <div className="cswitch-item-text">
                    <span className="cswitch-item-name">
                      {member.hasMultipleAccounts ? 'Gestionar cuentas y empresas' : 'Gestionar empresas'}
                    </span>
                    <span className="cswitch-item-meta">Crear, abrir y unirse</span>
                  </div>
                </button>
              </>
            )}
          </div>
        </>
      )}

      <button
        className="cswitch-trigger"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Empresa activa: ${active?.name ?? member.orgName}. Cambiar de empresa`}
      >
        <Building2 size={15} />
        <span className="cswitch-name">{active?.name ?? member.orgName}</span>
        <ChevronRight
          className="cswitch-chev"
          size={14}
          style={{
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform var(--acc-chevron) var(--acc-ease)',
          }}
        />
      </button>
    </div>
  )
}
