import { z } from 'zod'
import { publicRoute } from '@/lib/api/handler'
import { RATE_LIMITS } from '@/lib/api/rate-limit'
import { ApiError, badRequest, unauthorized } from '@/lib/api/errors'
import { createClient } from '@/lib/supabase/server'

/**
 * Two-step verification (TOTP).
 *
 * The Seguridad tab used to carry a switch that flipped, marked the form dirty
 * and was dropped on save — a security control reporting "activada" while
 * enrolling nothing. This is the enrolment behind it. Supabase Auth speaks
 * TOTP natively, so there is no second service here: `mfa.enroll` mints the
 * secret, the authenticator app proves possession, and `mfa.challengeAndVerify`
 * is what marks the factor verified.
 *
 * These handlers use `publicRoute` rather than `route`, and read the session
 * themselves. `requireMember` deliberately refuses a session that is still at
 * aal1 while a verified factor exists — which is exactly the session that has
 * to be able to reach the verify step.
 */

/** The session behind the request, whatever assurance level it is at. */
async function currentUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw unauthorized('Inicia sesión para continuar.')
  return { supabase, user: data.user }
}

export interface MfaEnrollment {
  factorId: string
  /** SVG for the authenticator app, already a `data:` URI. */
  qrCode: string
  /** For typing by hand when a camera is not an option. */
  secret: string
}

/**
 * Starts enrolment and returns the QR to scan.
 *
 * The factor is unverified until a code proves the secret arrived, so nothing
 * here changes how the account signs in. An abandoned enrolment leaves an
 * unverified factor, which is why the next attempt clears them first — the
 * alternative is a "factor already exists" error the user cannot act on.
 */
export const POST = publicRoute({
  rateLimit: RATE_LIMITS.otpVerify,
  async handler() {
    const { supabase } = await currentUser()

    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
    if (listError) {
      console.error('[mfa] listFactors', listError)
      throw badRequest('No se pudo leer el estado de la verificación en dos pasos.')
    }

    if ((factors.totp ?? []).some((f) => f.status === 'verified')) {
      throw new ApiError(409, 'Ya está activa', {
        type: 'kigyo:mfa-enrolled',
        detail: 'La verificación en dos pasos ya está activa en esta cuenta.',
      })
    }

    for (const stale of (factors.all ?? []).filter((f) => f.status === 'unverified')) {
      await supabase.auth.mfa.unenroll({ factorId: stale.id })
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Kigyo · ${new Date().toISOString().slice(0, 10)}`,
      issuer: 'Kigyo',
    })

    if (error || !data) {
      console.error('[mfa] enroll', error)
      throw badRequest('No se pudo iniciar la verificación en dos pasos.')
    }

    return {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    } satisfies MfaEnrollment
  },
})

const verifySchema = z.object({
  factorId: z.uuid('Factor desconocido.'),
  /** Six digits from the authenticator app. */
  code: z.string().trim().regex(/^\d{6}$/, 'El código son 6 dígitos.'),
})

/**
 * Answers a challenge — the same call for both jobs it has.
 *
 * On enrolment it is what marks the factor verified. On sign-in it is what
 * raises the session from aal1 to aal2. Rate limited on the shared OTP bucket:
 * six digits is 10⁶ guesses, and TOTP windows are 30 seconds wide.
 */
export const PUT = publicRoute({
  body: verifySchema,
  rateLimit: RATE_LIMITS.otpVerify,
  async handler({ body }) {
    const { supabase } = await currentUser()

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: body.factorId,
      code: body.code,
    })

    if (error) {
      // Deliberately the same answer for a wrong code and an expired window:
      // telling them apart tells an attacker their clock is fine.
      throw new ApiError(401, 'Código incorrecto', {
        type: 'kigyo:mfa-invalid',
        detail: 'El código no es válido o ya venció. Revisa tu app e inténtalo de nuevo.',
      })
    }

    return { ok: true }
  },
})

const disableSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'El código son 6 dígitos.'),
})

/**
 * Turns two-step verification off.
 *
 * A current code is required. Without it, an open tab is enough to strip the
 * protection off an account — which is the attack the second factor exists to
 * stop, so the way out has to cost the same as the way in.
 */
export const DELETE = publicRoute({
  body: disableSchema,
  rateLimit: RATE_LIMITS.otpVerify,
  async handler({ body }) {
    const { supabase } = await currentUser()

    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
    if (listError) {
      console.error('[mfa] listFactors', listError)
      throw badRequest('No se pudo leer el estado de la verificación en dos pasos.')
    }

    const verified = (factors.totp ?? []).find((f) => f.status === 'verified')
    if (!verified) throw badRequest('La verificación en dos pasos no está activa.')

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: verified.id,
      code: body.code,
    })

    if (verifyError) {
      throw new ApiError(401, 'Código incorrecto', {
        type: 'kigyo:mfa-invalid',
        detail: 'El código no es válido o ya venció. Revisa tu app e inténtalo de nuevo.',
      })
    }

    const { error } = await supabase.auth.mfa.unenroll({ factorId: verified.id })
    if (error) {
      console.error('[mfa] unenroll', error)
      throw badRequest('No se pudo desactivar la verificación en dos pasos.')
    }

    return { ok: true }
  },
})
