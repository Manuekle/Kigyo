import { publicRoute } from '@/lib/api/handler'
import { RATE_LIMITS } from '@/lib/api/rate-limit'
import { ApiError } from '@/lib/api/errors'
import { createClient } from '@/lib/supabase/server'
import { verifyOtpSchema } from '@/lib/validation/auth'

/**
 * Exchanges the six-digit recovery code for a session.
 *
 * On success the session cookie is set, and `POST /api/auth/reset-password`
 * can then change the password. No reset token is minted or returned: the
 * previous implementation handed the browser a bearer token that lived in a
 * `Map` and granted a password change to whoever held it.
 */
export const POST = publicRoute({
  body: verifyOtpSchema,
  rateLimit: RATE_LIMITS.otpVerify,
  rateLimitSubject: (body) => body.email,
  async handler({ body }) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      email: body.email,
      token: body.code,
      type: 'recovery',
    })

    if (error) {
      throw new ApiError(400, 'Código inválido', {
        type: 'kigyo:invalid-otp',
        detail: 'El código es incorrecto o expiró. Solicita uno nuevo.',
      })
    }

    return { ok: true }
  },
})
