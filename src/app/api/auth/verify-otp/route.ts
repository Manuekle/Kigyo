import { NextResponse } from 'next/server'
import { verifyOtp, issueResetToken } from '@/lib/otp-store'

export async function POST(req: Request) {
  const { email, code } = await req.json()

  if (!email || !code) {
    return NextResponse.json({ error: 'Falta correo o código.' }, { status: 400 })
  }

  const result = verifyOtp(email, code)
  if (!result.ok) {
    return NextResponse.json({ error: result.reason ?? 'Código inválido.' }, { status: 400 })
  }

  const resetToken = issueResetToken(email)
  return NextResponse.json({ ok: true, resetToken })
}
