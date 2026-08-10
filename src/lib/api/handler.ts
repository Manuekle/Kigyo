import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import type { ZodType } from 'zod'
import { moduleOf, requireMember, type Member } from '@/lib/auth/session'
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
  handler: (ctx: RouteContext<TBody, TParams>) => Promise<Response | unknown>
}

type NextRouteContext<TParams> = { params: Promise<TParams> }

export function route<TBody = undefined, TParams extends Record<string, string> = Record<string, never>>(
  options: RouteOptions<TBody, TParams>,
) {
  return async function handler(
    request: NextRequest,
    context?: NextRouteContext<TParams>,
  ): Promise<Response> {
    let limitHeaders: Record<string, string> = {}

    try {
      const member = await requireMember()

      // Two gates, outermost first — the same pair `requirePermission` applies
      // to Server Functions. Without the module check here, switching a module
      // off hid its pages but left its HTTP endpoints answering normally, so
      // /api/ai/chat kept working for an organization that had turned the
      // assistant off.
      if (options.permission) {
        const moduleKey = moduleOf(options.permission)
        if (!member.modules.has(moduleKey)) {
          throw forbidden(`El módulo "${moduleKey}" no está activo en esta organización.`)
        }
        if (!can(member.permissions, options.permission)) {
          throw forbidden(`Necesitas el permiso "${options.permission}" para esta acción.`)
        }
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

      // Checked as `Response`, not `NextResponse`. A streaming endpoint hands
      // back what the AI SDK builds — a plain `Response` — and the narrower
      // check let those fall through to `NextResponse.json()`, which
      // serialised the stream object itself as `{}`. The client then saw a 200
      // with an empty JSON body: the assistant answered nothing and reported
      // no error. `NextResponse` extends `Response`, so this covers both.
      if (result instanceof Response) {
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
  handler: (ctx: PublicRouteContext<TBody>) => Promise<Response | unknown>
}) {
  return async function handler(request: NextRequest): Promise<Response> {
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

      // `Response`, not `NextResponse`. The streaming endpoints hand back what
      // the AI SDK builds — a plain `Response` — and a `NextResponse`-only check
      // let those fall through to `NextResponse.json()`, which serialised the
      // stream object itself as `{}`: the client saw a 200 with an empty JSON
      // body, so the assistant answered nothing and reported no error.
      // `NextResponse` extends `Response`, so this covers both.
      if (result instanceof Response) {
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
