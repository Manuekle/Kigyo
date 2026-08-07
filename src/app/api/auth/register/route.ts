import { publicRoute } from '@/lib/api/handler'
import { RATE_LIMITS } from '@/lib/api/rate-limit'
import { ApiError } from '@/lib/api/errors'
import { createClient } from '@/lib/supabase/server'
import { serverEnv } from '@/lib/env'
import { registerSchema } from '@/lib/validation/auth'

/**
 * Sign up.
 *
 * The organization and the Administrador membership are created by the
 * `handle_new_user` trigger on `auth.users`, not here — that keeps account
 * creation and tenant creation in one transaction, so a crash between the two
 * cannot leave an account with no organization.
 */
export const POST = publicRoute({
  body: registerSchema,
  rateLimit: RATE_LIMITS.register,
  rateLimitSubject: (body) => body.email,
  async handler({ body }) {
    const supabase = await createClient()
    const env = serverEnv()

    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        // Read by handle_new_user() to name the organization.
        data: {
          full_name: body.name,
          company: body.company?.trim() || body.name,
        },
        emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/api/auth/confirm`,
      },
    })

    if (error) {
      // Supabase reports an already-registered address as a distinct error.
      // Surfacing it would let anyone test which emails have accounts, so it
      // is folded into the generic case and the response below is identical.
      if (error.status && error.status >= 500) {
        throw new ApiError(503, 'Servicio no disponible', {
          type: 'kigyo:upstream',
          detail: 'No pudimos crear la cuenta ahora mismo. Intenta de nuevo en unos minutos.',
        })
      }
      return { ok: true, requiresEmailConfirmation: true }
    }

    // With email confirmation enabled, `session` is null until the link is
    // opened. The client uses this to decide between routing to the dashboard
    // and showing "check your inbox".
    return {
      ok: true,
      requiresEmailConfirmation: data.session === null,
    }
  },
})
