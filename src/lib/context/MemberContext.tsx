'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { can, type Permission, type RoleKey } from '@/lib/auth/permissions'
import { planAllows, planFor, type PlanDef, type PlanKey } from '@/lib/plans'

/**
 * The signed-in member, resolved once on the server and handed to the client
 * tree. Client components use it to hide controls the server would reject.
 *
 * This is presentation only. The server re-checks every permission on every
 * mutation, and RLS re-checks it again at the database — hiding a button is
 * not a security control, it is a courtesy.
 */

/** One company in the switcher. Mirrors `CompanyRef` in lib/auth/session.ts. */
export interface ClientCompany {
  orgId: string
  name: string
  slug: string
  companyType: string | null
  role: RoleKey
  /** The group it belongs to, so the switcher can put a heading over it. */
  accountId: string
  accountName: string
}

/** Mirrors `AccountRef` in lib/auth/session.ts. */
export interface ClientAccount {
  accountId: string
  name: string
  plan: PlanKey
  role: 'owner' | 'billing' | 'admin' | null
  onboardingCompleted: boolean
}

export interface ClientMember {
  userId: string
  email: string
  fullName: string
  avatarUrl: string | null
  /** The **active** company. */
  orgId: string
  orgName: string
  companyType: string | null
  /**
   * El tipo de negocio dentro del sector, cuando se precisó.
   *
   * Decide qué *muestra* un módulo sectorial, nunca qué puede abrir nadie:
   * `pacientes` pinta un odontograma para `salud-odontologia` y no para
   * `salud-consultorio`, y ambos corren sobre el mismo permiso.
   */
  subsector: string | null
  /** The subscription tier, for screens that explain what it unlocks. */
  plan: PlanKey
  /**
   * Modules the company uses, already resolved on the server — plan
   * filter applied, core modules folded in.
   */
  modules: string[]
  role: RoleKey
  permissions: Permission[]
  /** The account that owns the active company. */
  account: ClientAccount
  /** Every company this person belongs to, most recently used first. */
  companies: ClientCompany[]
  /** Every group this person governs. Empty for most people. */
  accounts: Array<{ accountId: string; name: string; role: 'owner' | 'billing' | 'admin' }>
}

interface MemberContextValue extends ClientMember {
  /** True only when the module is on *and* the role holds the permission. */
  can: (permission: Permission) => boolean
  hasModule: (module: string) => boolean
  /** The plan's definition, for rendering what it includes. */
  planDef: PlanDef
  /**
   * Whether the plan covers a module, regardless of whether the organization
   * has switched it on. This is what tells a disabled toggle in Configuración
   * apart from a locked one.
   */
  planIncludes: (module: string) => boolean
  /**
   * Whether this person belongs to more than one company.
   *
   * The switcher hides itself when false. A control that offers one option is
   * not a choice, and for the overwhelming majority of accounts — one business,
   * one company — it would be permanent clutter at the top of the sidebar.
   */
  hasMultipleCompanies: boolean
  /**
   * Whether this person's companies span more than one group, or they govern
   * more than one.
   *
   * The switcher only draws account headings when true: with a single group
   * every heading would say the same thing, which is noise above a list that is
   * already short.
   */
  hasMultipleAccounts: boolean
}

const MemberContext = createContext<MemberContextValue | null>(null)

export function MemberProvider({ member, children }: { member: ClientMember; children: ReactNode }) {
  const value = useMemo<MemberContextValue>(() => {
    const granted = new Set(member.permissions)
    const modules = new Set(member.modules)
    return {
      ...member,
      // Folded together on purpose: every caller wants "should this control
      // exist", and forgetting the module half is how a nav item for a module
      // the company switched off comes back. The plan is already folded into
      // `modules` by the server, so it needs no third term here.
      can: (permission) => modules.has(permission.split(':')[0]) && can(granted, permission),
      hasModule: (module) => modules.has(module),
      planDef: planFor(member.plan),
      planIncludes: (module) => planAllows(member.plan, module),
      hasMultipleCompanies: member.companies.length > 1,
      // Grouping only earns its keep when there is more than one group. With
      // one, the heading would repeat the same word over every entry.
      hasMultipleAccounts:
        new Set(member.companies.map((c) => c.accountId)).size > 1 ||
        member.accounts.length > 1,
    }
  }, [member])

  return <MemberContext.Provider value={value}>{children}</MemberContext.Provider>
}

export function useMember(): MemberContextValue {
  const ctx = useContext(MemberContext)
  if (!ctx) throw new Error('useMember must be used within MemberProvider')
  return ctx
}
