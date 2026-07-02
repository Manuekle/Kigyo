import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  const { name, email, company, password } = await req.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Completa todos los campos requeridos.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 })
  }

  void company

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
