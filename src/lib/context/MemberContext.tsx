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

export interface ClientMember {
  userId: string
  email: string
  fullName: string
  avatarUrl: string | null
  orgId: string
  orgName: string
  companyType: string | null
  /** The subscription tier, for screens that explain what it unlocks. */
  plan: PlanKey
  /**
   * Modules the organization uses, already resolved on the server — plan
   * filter applied, core modules folded in.
   */
  modules: string[]
  role: RoleKey
  permissions: Permission[]
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
    }
  }, [member])

  return <MemberContext.Provider value={value}>{children}</MemberContext.Provider>
}

export function useMember(): MemberContextValue {
  const ctx = useContext(MemberContext)
  if (!ctx) throw new Error('useMember must be used within MemberProvider')
  return ctx
}
