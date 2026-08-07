import 'server-only'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { PermissionError } from '@/lib/auth/session'
import { isProduction } from '@/lib/env'

/**
 * Error envelope, shaped after RFC 9457 (`application/problem+json`).
 *
 * Every message here is written for a Spanish-speaking end user and is safe to
 * display. Database errors are never forwarded: a Postgres message can leak
 * table names, constraint names and occasionally row contents.
 */

export interface Problem {
  type: string
  title: string
  status: number
  detail?: string
  /** Field-level messages, keyed by dotted path, for form rendering. */
  errors?: Record<string, string[]>
}

export class ApiError extends Error {
  readonly status: number
  readonly type: string
  readonly title: string
  readonly detail?: string
  readonly errors?: Record<string, string[]>

  constructor(
    status: number,
    title: string,
    options: { type?: string; detail?: string; errors?: Record<string, string[]> } = {},
  ) {
    super(options.detail ?? title)
    this.name = 'ApiError'
    this.status = status
    this.type = options.type ?? 'about:blank'
    this.title = title
    this.detail = options.detail
    this.errors = options.errors
  }
}

export function badRequest(detail: string) {
  return new ApiError(400, 'Solicitud inválida', { detail, type: 'kigyo:bad-request' })
}

export function unauthorized(detail = 'Inicia sesión para continuar.') {
  return new ApiError(401, 'No autenticado', { detail, type: 'kigyo:unauthorized' })
}

export function forbidden(detail = 'No tienes permiso para esta acción.') {
  return new ApiError(403, 'Sin permiso', { detail, type: 'kigyo:forbidden' })
}

export function notFound(detail = 'No encontramos lo que buscabas.') {
  return new ApiError(404, 'No encontrado', { detail, type: 'kigyo:not-found' })
}

export function conflict(detail: string) {
  return new ApiError(409, 'Conflicto', { detail, type: 'kigyo:conflict' })
}

export function tooManyRequests(detail: string, retryAfterSeconds: number) {
  const error = new ApiError(429, 'Demasiadas solicitudes', {
    detail,
    type: 'kigyo:rate-limited',
  })
  return { error, retryAfterSeconds }
}

function zodToFieldErrors(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    ;(out[key] ??= []).push(issue.message)
  }
  return out
}

/** Converts anything thrown inside a handler into a problem+json response. */
export function toResponse(error: unknown): NextResponse<Problem> {
  if (error instanceof ApiError) {
    return problemResponse({
      type: error.type,
      title: error.title,
      status: error.status,
      detail: error.detail,
      errors: error.errors,
    })
  }

  if (error instanceof PermissionError) {
    return problemResponse({
      type: 'kigyo:forbidden',
      title: 'Sin permiso',
      status: 403,
      detail: error.message,
    })
  }

  if (error instanceof ZodError) {
    return problemResponse({
      type: 'kigyo:validation',
      title: 'Datos inválidos',
      status: 422,
      detail: 'Revisa los campos marcados.',
      errors: zodToFieldErrors(error),
    })
  }

  // Anything else is a bug. Log the real cause server-side, tell the client
  // nothing beyond "it broke" — stack traces and driver messages are exactly
  // what an attacker probes for.
  console.error('[api] unhandled error', error)

  return problemResponse({
    type: 'kigyo:internal',
    title: 'Error interno',
    status: 500,
    detail: isProduction
      ? 'Algo salió mal. Intenta de nuevo en unos momentos.'
      : `Algo salió mal: ${error instanceof Error ? error.message : String(error)}`,
  })
}

export function problemResponse(problem: Problem, init?: ResponseInit): NextResponse<Problem> {
  return NextResponse.json(problem, {
    ...init,
    status: problem.status,
    headers: {
      'content-type': 'application/problem+json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init?.headers ?? {}),
    },
  })
}
