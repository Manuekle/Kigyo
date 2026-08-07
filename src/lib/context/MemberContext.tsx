'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { can, type Permission, type RoleKey } from '@/lib/auth/permissions'

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
  role: RoleKey
  permissions: Permission[]
}

interface MemberContextValue extends ClientMember {
  can: (permission: Permission) => boolean
}

const MemberContext = createContext<MemberContextValue | null>(null)

export function MemberProvider({ member, children }: { member: ClientMember; children: ReactNode }) {
  const value = useMemo<MemberContextValue>(() => {
    const granted = new Set(member.permissions)
    return { ...member, can: (permission) => can(granted, permission) }
  }, [member])

  return <MemberContext.Provider value={value}>{children}</MemberContext.Provider>
}

export function useMember(): MemberContextValue {
  const ctx = useContext(MemberContext)
  if (!ctx) throw new Error('useMember must be used within MemberProvider')
  return ctx
}
