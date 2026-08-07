import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { serverEnv } from '@/lib/env'
import type { Database } from './types'

/**
 * Service-role client. **Bypasses RLS entirely.**
 *
 * Legitimate uses are narrow, and each one must scope its own queries by
 * org_id by hand, because the database will no longer do it for you:
 *
 *   · rate-limit counters, which are deliberately unreadable by end users
 *   · admin auth operations (inviting, deleting users)
 *   · the demo seeder
 *
 * Never reach for this to "make a query work" — a query that fails under RLS
 * is telling you the caller is not allowed to run it.
 *
 * `server-only` makes importing this from a Client Component a build error,
 * so the key cannot end up in a browser bundle.
 */

let cached: ReturnType<typeof createSupabaseClient<Database>> | null = null

export function createAdminClient() {
  if (cached) return cached

  const env = serverEnv()
  cached = createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  )
  return cached
}
