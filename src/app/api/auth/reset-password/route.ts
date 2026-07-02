import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { consumeResetToken } from '@/lib/otp-store'

export async function POST(req: Request) {
  const { resetToken, password } = await req.json()

  if (!resetToken || !password) {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 })
  }

  const result = consumeResetToken(resetToken)
  if (!result.ok) {
    return NextResponse.json({ error: 'El enlace de restablecimiento expiró o ya fue usado.' }, { status: 400 })
  }

  const jar = await cookies()
  jar.set('wb-session', 'wb-demo-token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
    sameSite: 'lax',
  })

  return NextResponse.json({ ok: true })
}
