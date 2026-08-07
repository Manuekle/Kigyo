import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { serverEnv } from '@/lib/env'
import type { Database } from './types'

/**
 * Supabase client bound to the caller's session cookies.
 *
 * Every query made through it is subject to RLS, so tenant isolation does not
 * depend on the application remembering to add `where org_id = …`.
 */
export async function createClient() {
  // `cookies()` first, deliberately. It is what marks the render dynamic, and
  // reaching it before any validation means a missing env var surfaces as a
  // runtime error on a request instead of aborting `next build` while it tries
  // to prerender a per-user page.
  const jar = await cookies()
  const env = serverEnv()

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return jar.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              jar.set(name, value, options)
            }
          } catch {
            // Server Components cannot set cookies. Refresh still happens in
            // proxy.ts, so a failure here is expected and safe to swallow.
          }
        },
      },
    },
  )
}
