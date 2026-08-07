import { NextResponse } from 'next/server'
import { publicRoute } from '@/lib/api/handler'
import { RATE_LIMITS } from '@/lib/api/rate-limit'
import { ApiError } from '@/lib/api/errors'
import { createClient } from '@/lib/supabase/server'
import { loginSchema } from '@/lib/validation/auth'

/**
 * Sign in.
 *
 * What this replaces: a handler that accepted any email and any password and
 * issued the constant cookie `wb-session=wb-demo-token`, which the proxy then
 * accepted purely on presence. Anyone could set that cookie by hand.
 */
export const POST = publicRoute({
  body: loginSchema,
  rateLimit: RATE_LIMITS.login,
  rateLimitSubject: (body) => body.email,
  async handler({ body }) {
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    })

    if (error) {
      // One message for "no such account" and "wrong password" alike. Any
      // difference between the two turns this endpoint into a way to
      // enumerate which emails are registered.
      throw new ApiError(401, 'Credenciales inválidas', {
        type: 'kigyo:invalid-credentials',
        detail: 'Correo o contraseña incorrectos.',
      })
    }

    return { ok: true }
  },
})

/** Sign out. Clears the session cookies through the SSR client. */
export async function DELETE() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
}
