import { NextResponse } from 'next/server'
import { generateOtp } from '@/lib/otp-store'

export async function POST(req: Request) {
  const { email } = await req.json()

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Ingresa un correo válido.' }, { status: 400 })
  }

  const { code, limited } = generateOtp(email)

  if (limited) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' },
      { status: 429 },
    )
  }

  // No email provider is wired into this project — in production this code
  // would be dispatched via email, never returned in the response body.
  console.log(`[demo] OTP para ${email}: ${code}`)

  return NextResponse.json({
    ok: true,
    devOtp: process.env.NODE_ENV !== 'production' ? code : undefined,
  })
}
