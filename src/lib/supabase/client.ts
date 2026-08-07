'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null

/**
 * Browser client, backed by the anon key.
 *
 * Migration 08 revokes every grant in `public` from the `anon` role, so this
 * key alone reads nothing — it only becomes useful once a session upgrades the
 * request to `authenticated`, and RLS still applies from there.
 */
export function createClient() {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing. ' +
        'Copy .env.example to .env.local and fill it in.',
    )
  }

  cached = createBrowserClient<Database>(url, anonKey)
  return cached
}
