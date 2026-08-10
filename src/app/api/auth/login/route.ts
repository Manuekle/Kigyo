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

    // The password bought a session at aal1. If the account carries a verified
    // TOTP factor, that session is not enough — `getMember` refuses it — so the
    // caller is told to finish the second step rather than being sent to a
    // dashboard that would bounce it straight back to /login.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

    if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const factorId = (factors?.totp ?? []).find((f) => f.status === 'verified')?.id

      if (factorId) return { ok: true, mfaRequired: true as const, factorId }
    }

    return { ok: true, mfaRequired: false as const }
  },
})

/** Sign out. Clears the session cookies through the SSR client. */
export async function DELETE() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
}
