import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * Landing point for the links Supabase emails (signup confirmation, magic
 * link, email change). Exchanges the one-time hash for a session, then
 * redirects into the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  // Only same-origin paths are honoured, so a crafted `next` cannot bounce the
  // freshly authenticated user off to another site.
  const rawNext = searchParams.get('next') ?? '/dashboard'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL('/login?error=enlace-invalido', origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

  if (error) {
    return NextResponse.redirect(new URL('/login?error=enlace-expirado', origin))
  }

  return NextResponse.redirect(new URL(next, origin))
}
