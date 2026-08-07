import { NextResponse } from 'next/server'
import { ApiError, toResponse, unauthorized } from '@/lib/api/errors'
import { createClient } from '@/lib/supabase/server'
import { resetPasswordSchema } from '@/lib/validation/auth'

/**
 * Sets a new password for the session established by /api/auth/verify-otp.
 *
 * Authorization comes from that session cookie, so this cannot be driven by a
 * value the client supplies — which is exactly what the previous `resetToken`
 * in the request body was.
 */
export async function POST(request: Request) {
  try {
    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      throw new ApiError(400, 'Solicitud inválida', {
        detail: 'El cuerpo de la solicitud debe ser JSON válido.',
      })
    }

    const body = resetPasswordSchema.parse(raw)
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw unauthorized('Verifica el código antes de cambiar tu contraseña.')
    }

    const { error } = await supabase.auth.updateUser({ password: body.password })

    if (error) {
      throw new ApiError(400, 'No pudimos actualizar la contraseña', {
        type: 'kigyo:password-rejected',
        // Supabase's own message here is user-facing and safe: it reports
        // policy failures such as "password is too weak", not internals.
        detail: error.message,
      })
    }

    return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return toResponse(error)
  }
}
