import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { SITE_URL } from '@/lib/site'

/**
 * Runs before every matched request. Three jobs:
 *
 *   1. Send a browser to the one host the site calls itself.
 *   2. Refresh the Supabase session cookie, so a Server Component never sees
 *      an expired token.
 *   3. Mint a per-request CSP nonce and attach the security headers.
 *
 * It also performs the /dashboard → /login redirect, but **only as a UX
 * shortcut**. It is not the authorization boundary: proxy/middleware matching
 * has been bypassable in shipped Next releases, so every page, Server Function
 * and route handler calls `requireMember()` on its own, and RLS backstops both.
 */

/**
 * `kigyo.pro` and `www.kigyo.pro` are the same site — and that was the problem.
 *
 * Both answered 200 with the full application and neither redirected, so the
 * two spellings were two origins. Cookies are host-only: `sb-*` and `kigyo_ctx`
 * set on `www` are not sent to the apex, so signing in under one spelling and
 * arriving at the other logs you out — and `kigyo_ctx` diverging means the two
 * tabs can sit in different companies without anything saying so. The
 * `canonical` tag already pointed both at the apex, which fixes the crawler's
 * problem and none of the browser's.
 *
 * Both keep working, which is the point: type either and you land on the site.
 * A browser simply ends up on one of them, so there is one session and one
 * active company.
 *
 * ─── What is deliberately NOT redirected ───────────────────────────────────
 *
 * `/api/*`. The Polar webhook is registered against `www` and **Polar does not
 * follow redirects on POST** — that is not a guess, it is why `billing_events`
 * had zero rows until the webhook was repointed on 2026-08-25. Sending a 308 to
 * a machine that will not follow it turns every payment notification into a
 * silent no-op. Route handlers answer on both hosts; only documents move.
 *
 * ─── Why only the one alias ────────────────────────────────────────────────
 *
 * Derived from `SITE_URL`, and it fires for exactly one other host: the same
 * name with `www.` added or removed. Not "anything that is not canonical" —
 * that would bounce every `*.vercel.app` preview deployment to production, and
 * a preview whose only purpose is to differ would answer with the live site.
 * The target host comes from our own build-time constant and never from the
 * request, so this cannot be steered into an open redirect.
 *
 * `siteUrl` is a parameter with a default so the rule can be exercised against
 * a host that is not this deployment's — otherwise the test would run under
 * `localhost` and take the early return, which is the branch that proves
 * nothing.
 */
export function canonicalRedirect(request: NextRequest, siteUrl: string = SITE_URL): URL | null {
  let canonical: URL
  try {
    canonical = new URL(siteUrl)
  } catch {
    return null
  }

  const host = canonical.hostname.toLowerCase()
  // Never in development: `localhost` has no `www.` twin, and a redirect there
  // would only ever be wrong.
  if (host === 'localhost' || host === '127.0.0.1') return null

  const alias = host.startsWith('www.') ? host.slice(4) : `www.${host}`
  const incoming = (request.headers.get('host') ?? request.nextUrl.host)
    .toLowerCase()
    .split(':')[0]
  if (incoming !== alias) return null

  // Webhooks and other machine callers stay where they were pointed.
  if (request.nextUrl.pathname.startsWith('/api/')) return null

  const target = request.nextUrl.clone()
  target.protocol = canonical.protocol
  target.hostname = host
  target.port = ''
  return target
}

/**
 * Every response leaves with the security headers, redirects included.
 *
 * The three redirects below used to `return` before the loop that attaches
 * them, so a bounce to `/login` — which is most of the traffic from a signed-out
 * visitor — travelled with no CSP, no HSTS and no `X-Frame-Options`. Nothing on
 * a 308 renders, but the headers are cheap and the omission is the kind that
 * survives because it is invisible.
 */
function sealed(response: NextResponse, headers: Record<string, string>): NextResponse {
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value)
  return response
}

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
    // blob: — EmbedPDF/PDFium hace fetch del PDF vía object URL local.
    // worker-src blob: — motor PDFium corre en Web Worker (inline/blob).
    "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://*.supabase.in",
    "worker-src 'self' blob:",
    // PDF nativo (iframe) + signed URLs de Storage si EmbedPDF no arranca.
    "frame-src 'self' blob: https://*.supabase.co",
    "child-src 'self' blob:",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    // Production-only: behind HTTPS it protects against mixed content. In dev
    // it rewrites http://localhost RSC fetches to https, which the plain-HTTP
    // dev server rejects — Next then falls back to full browser navigation.
    !isDev ? 'upgrade-insecure-requests' : '',
  ].filter(Boolean).join('; ')

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

  // Before the session is touched: there is no point rotating a cookie on a
  // host the browser is about to leave.
  const canonical = canonicalRedirect(request)
  if (canonical) {
    return sealed(NextResponse.redirect(canonical, 308), headers)
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Without Supabase configured there is no session to refresh. Still emit the
  // security headers rather than failing open.
  if (!url || !anonKey) {
    return sealed(response, headers)
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
    return sealed(NextResponse.redirect(target), headers)
  }

  if (user && (pathname === '/login' || pathname === '/register' || pathname === '/forgot-password')) {
    const target = request.nextUrl.clone()
    target.pathname = '/dashboard'
    target.search = ''
    return sealed(NextResponse.redirect(target), headers)
  }

  return sealed(response, headers)
}

export const config = {
  // Everything except static assets, so the security headers apply to real
  // documents without paying the cost on every chunk.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json|fonts/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|otf|ttf|woff2?)$).*)',
  ],
}
