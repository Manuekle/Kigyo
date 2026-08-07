import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import type { ZodType } from 'zod'
import { requireMember, type Member } from '@/lib/auth/session'
import { can, type Permission } from '@/lib/auth/permissions'
import { rateLimit, rateLimitHeaders, type RateLimitRule } from './rate-limit'
import { ApiError, badRequest, forbidden, toResponse } from './errors'

/**
 * One wrapper for every route handler, so the order of operations is the same
 * everywhere: authenticate → authorize → rate limit → validate → run.
 *
 * Getting that order wrong is a real hazard — validating before authenticating
 * turns a public endpoint into a free schema oracle, and rate limiting after
 * the work is done protects nothing.
 */

export interface RouteContext<TBody, TParams extends Record<string, string>> {
  request: NextRequest
  member: Member
  body: TBody
  params: TParams
  searchParams: URLSearchParams
}

export interface RouteOptions<TBody, TParams extends Record<string, string>> {
  /** Omit for endpoints that only need a signed-in user. */
  permission?: Permission
  rateLimit?: RateLimitRule
  /** When present, the request body is parsed as JSON and validated. */
  body?: ZodType<TBody>
  handler: (ctx: RouteContext<TBody, TParams>) => Promise<NextResponse | unknown>
}

type NextRouteContext<TParams> = { params: Promise<TParams> }

export function route<TBody = undefined, TParams extends Record<string, string> = Record<string, never>>(
  options: RouteOptions<TBody, TParams>,
) {
  return async function handler(
    request: NextRequest,
    context?: NextRouteContext<TParams>,
  ): Promise<NextResponse> {
    let limitHeaders: Record<string, string> = {}

    try {
      const member = await requireMember()

      if (options.permission && !can(member.permissions, options.permission)) {
        throw forbidden(`Necesitas el permiso "${options.permission}" para esta acción.`)
      }

      // Keyed by user, not by address: a shared office NAT should not let one
      // person exhaust everyone else's quota.
      if (options.rateLimit) {
        const result = await rateLimit(options.rateLimit, member.userId)
        limitHeaders = rateLimitHeaders(options.rateLimit, result)
        if (!result.allowed) {
          throw new ApiError(429, 'Demasiadas solicitudes', {
            type: 'kigyo:rate-limited',
            detail: `Espera ${result.retryAfterSeconds} segundos e intenta de nuevo.`,
          })
        }
      }

      let body = undefined as TBody
      if (options.body) {
        let raw: unknown
        try {
          raw = await request.json()
        } catch {
          throw badRequest('El cuerpo de la solicitud debe ser JSON válido.')
        }
        body = options.body.parse(raw)
      }

      const params = ((await context?.params) ?? {}) as TParams

      const result = await options.handler({
        request,
        member,
        body,
        params,
        searchParams: request.nextUrl.searchParams,
      })

      if (result instanceof NextResponse) {
        for (const [key, value] of Object.entries(limitHeaders)) result.headers.set(key, value)
        return result
      }

      return NextResponse.json(result ?? { ok: true }, {
        headers: { 'cache-control': 'no-store', ...limitHeaders },
      })
    } catch (error) {
      const response = toResponse(error)
      for (const [key, value] of Object.entries(limitHeaders)) response.headers.set(key, value)
      return response
    }
  }
}

/**
 * Variant for endpoints that must work without a session — sign-in, sign-up,
 * password recovery. Rate limiting is mandatory here rather than optional:
 * these are the endpoints worth brute-forcing.
 */
export interface PublicRouteContext<TBody> {
  request: NextRequest
  body: TBody
}

export function publicRoute<TBody = undefined>(options: {
  rateLimit: RateLimitRule
  /** Derives the limiter subject from the body, e.g. the submitted email. */
  rateLimitSubject?: (body: TBody) => string | undefined
  body?: ZodType<TBody>
  handler: (ctx: PublicRouteContext<TBody>) => Promise<NextResponse | unknown>
}) {
  return async function handler(request: NextRequest): Promise<NextResponse> {
    let limitHeaders: Record<string, string> = {}

    try {
      let body = undefined as TBody
      if (options.body) {
        let raw: unknown
        try {
          raw = await request.json()
        } catch {
          throw badRequest('El cuerpo de la solicitud debe ser JSON válido.')
        }
        body = options.body.parse(raw)
      }

      // Address-scoped first, then subject-scoped: one limits a single
      // attacker hammering many accounts, the other limits many addresses
      // hammering one account.
      const byAddress = await rateLimit(options.rateLimit)
      limitHeaders = rateLimitHeaders(options.rateLimit, byAddress)

      const subject = options.rateLimitSubject?.(body)
      const bySubject = subject
        ? await rateLimit(options.rateLimit, `subject:${subject}`)
        : null

      if (!byAddress.allowed || (bySubject && !bySubject.allowed)) {
        const retry = Math.max(
          byAddress.retryAfterSeconds,
          bySubject?.retryAfterSeconds ?? 0,
        )
        throw new ApiError(429, 'Demasiadas solicitudes', {
          type: 'kigyo:rate-limited',
          detail: `Demasiados intentos. Espera ${retry} segundos e intenta de nuevo.`,
        })
      }

      const result = await options.handler({ request, body })

      if (result instanceof NextResponse) {
        for (const [key, value] of Object.entries(limitHeaders)) result.headers.set(key, value)
        return result
      }

      return NextResponse.json(result ?? { ok: true }, {
        headers: { 'cache-control': 'no-store', ...limitHeaders },
      })
    } catch (error) {
      const response = toResponse(error)
      for (const [key, value] of Object.entries(limitHeaders)) response.headers.set(key, value)
      return response
    }
  }
}
