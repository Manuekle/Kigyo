import { publicRoute } from '@/lib/api/handler'
import { RATE_LIMITS } from '@/lib/api/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { forgotPasswordSchema } from '@/lib/validation/auth'

/**
 * Starts password recovery.
 *
 * Supabase sends the email. The account's recovery template must render
 * `{{ .Token }}` — the six-digit code the existing OtpInput expects — rather
 * than only `{{ .ConfirmationURL }}`. See docs/SETUP.md.
 *
 * What this replaces: a handler that generated the code itself, stored it in a
 * module-level `Map` that did not survive a cold start, and returned it in the
 * response body outside production.
 */
export const POST = publicRoute({
  body: forgotPasswordSchema,
  rateLimit: RATE_LIMITS.passwordReset,
  rateLimitSubject: (body) => body.email,
  async handler({ body }) {
    const supabase = await createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(body.email)

    if (error) {
      // Logged, never surfaced. Reporting "no account with that email" here
      // is a free membership oracle, so the response is identical either way.
      console.error('[auth] resetPasswordForEmail failed', error.message)
    }

    return {
      ok: true,
      message: 'Si existe una cuenta con ese correo, enviamos un código de 6 dígitos.',
    }
  },
})
