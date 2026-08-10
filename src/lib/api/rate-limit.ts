import 'server-only'
import { headers } from 'next/headers'
import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Rate limiting backed by Postgres.
 *
 * The previous implementation kept counters in a module-level `Map`, which on
 * a serverless host resets on every cold start and is never shared between
 * instances — it limited nothing in practice.
 *
 * Counters are read and written with the service-role key because the table is
 * deliberately unreadable by end users: letting a caller see their own counter
 * tells them exactly when to resume.
 */

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  retryAfterSeconds: number
}

export interface RateLimitRule {
  /** Stable name for the thing being limited, e.g. 'auth:login'. */
  key: string
  limit: number
  windowSeconds: number
}

export const RATE_LIMITS = {
  login: { key: 'auth:login', limit: 10, windowSeconds: 300 },
  register: { key: 'auth:register', limit: 5, windowSeconds: 3600 },
  passwordReset: { key: 'auth:password-reset', limit: 5, windowSeconds: 900 },
  otpVerify: { key: 'auth:otp-verify', limit: 10, windowSeconds: 900 },
  // Tighter than the auth endpoints: a successful call hands back the shared
  // demo credentials, so the form doubles as the only way to obtain them.
  demoRequest: { key: 'demo:request', limit: 3, windowSeconds: 3600 },
  aiChat: { key: 'ai:chat', limit: 30, windowSeconds: 300 },
  aiInsights: { key: 'ai:insights', limit: 10, windowSeconds: 3600 },
  // Per document rather than per dashboard, so the ceiling is higher — but a
  // review reads a file and calls the model, so it is not free either.
  aiReview: { key: 'ai:review', limit: 40, windowSeconds: 3600 },
  export: { key: 'export', limit: 20, windowSeconds: 3600 },
  mutation: { key: 'mutation', limit: 120, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>

/**
 * Best-effort client address.
 *
 * `x-forwarded-for` is client-controlled unless a trusted proxy overwrites it.
 * On Vercel it is rewritten at the edge, so the leftmost entry is real; behind
 * an untrusted proxy this degrades to a shared bucket rather than a bypass,
 * which is the safe direction to fail.
 */
async function clientIdentifier(): Promise<string> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  const real = h.get('x-real-ip')?.trim()
  return forwarded || real || 'unknown'
}

/** Hashed so raw addresses and emails never land in the database. */
function bucketFor(rule: RateLimitRule, subject: string): string {
  const digest = createHash('sha256').update(`${rule.key}|${subject}`).digest('base64url')
  return `${rule.key}:${digest.slice(0, 32)}`
}

/**
 * Records one attempt.
 *
 * If the database is unreachable the call is allowed through: a limiter that
 * takes the whole application down when it fails is worse than one that
 * occasionally lets a burst past. The failure is logged.
 */
export async function rateLimit(
  rule: RateLimitRule,
  subject?: string,
): Promise<RateLimitResult> {
  const identity = subject ?? (await clientIdentifier())
  const bucket = bucketFor(rule, identity)

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('rate_limit_hit' as never, {
      p_bucket: bucket,
      p_limit: rule.limit,
      p_window_secs: rule.windowSeconds,
    } as never)

    if (error) throw error

    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed: boolean; remaining: number; reset_at: string }
      | undefined

    if (!row) throw new Error('rate_limit_hit returned no row')

    const resetAt = new Date(row.reset_at)
    return {
      allowed: row.allowed,
      remaining: row.remaining,
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
    }
  } catch (error) {
    console.error('[rate-limit] failing open', { bucket: rule.key, error })
    const resetAt = new Date(Date.now() + rule.windowSeconds * 1000)
    return {
      allowed: true,
      remaining: rule.limit,
      resetAt,
      retryAfterSeconds: rule.windowSeconds,
    }
  }
}

/** Headers describing the current quota, for clients that want to back off. */
export function rateLimitHeaders(rule: RateLimitRule, result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'RateLimit-Limit': String(rule.limit),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(Math.max(0, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000))),
  }
  if (!result.allowed) headers['Retry-After'] = String(result.retryAfterSeconds)
  return headers
}
