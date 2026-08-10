import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Runs before every matched request. Two jobs:
 *
 *   1. Refresh the Supabase session cookie, so a Server Component never sees
 *      an expired token.
 *   2. Mint a per-request CSP nonce and attach the security headers.
 *
 * It also performs the /dashboard → /login redirect, but **only as a UX
 * shortcut**. It is not the authorization boundary: proxy/middleware matching
 * has been bypassable in shipped Next releases, so every page, Server Function
 * and route handler calls `requireMember()` on its own, and RLS backstops both.
 */

function securityHeaders(nonce: string, isDev: boolean): Record<string, string> {
  // `strict-dynamic` lets the nonce-approved Next bootstrap load its own
  // chunks without every chunk URL needing to be listed.
  // Dev needs 'unsafe-eval' for React Refresh; production does not.
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    isDev ? "'unsafe-eval'" : '',
  ]
    .filter(Boolean)
    .join(' ')

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Known concession: dozens of components set inline `style` attributes and
    // Tailwind v4 injects a style element at runtime. Dropping 'unsafe-inline'
    // requires refactoring those out first — tracked, not forgotten.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ')

  const headers: Record<string, string> = {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'interest-cohort=()',
    ].join(', '),
  }

  if (!isDev) {
    headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload'
  }

  return headers
}

export async function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== 'production'
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const headers = securityHeaders(nonce, isDev)

  // Forwarded to the render so `headers().get('x-nonce')` can stamp the nonce
  // onto the inline JSON-LD script in app/layout.tsx.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  let response = NextResponse.next({ request: { headers: requestHeaders } })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Without Supabase configured there is no session to refresh. Still emit the
  // security headers rather than failing open.
  if (!url || !anonKey) {
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value)
    return response
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request: { headers: requestHeaders } })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // Revalidates the token against the auth server and rotates the cookie.
  // Must not be removed: without it, sessions silently expire mid-navigation.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && pathname.startsWith('/dashboard')) {
    const target = request.nextUrl.clone()
    target.pathname = '/login'
    // Preserve where they were headed, as a path only — echoing an
    // attacker-supplied absolute URL back into a redirect is an open redirect.
    target.search = pathname === '/dashboard' ? '' : `?next=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(target)
  }

  if (user && (pathname === '/login' || pathname === '/register' || pathname === '/forgot-password')) {
    const target = request.nextUrl.clone()
    target.pathname = '/dashboard'
    target.search = ''
    return NextResponse.redirect(target)
  }

  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value)
  return response
}

export const config = {
  // Everything except static assets, so the security headers apply to real
  // documents without paying the cost on every chunk.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json|fonts/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|otf|ttf|woff2?)$).*)',
  ],
}
