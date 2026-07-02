import { randomBytes, randomInt, createHash } from 'crypto'

interface OtpEntry {
  hash: string
  expiresAt: number
  attempts: number
  requestedAt: number
  requestCount: number
}

interface ResetTokenEntry {
  email: string
  expiresAt: number
}

const OTP_TTL_MS = 5 * 60 * 1000
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000
const MAX_VERIFY_ATTEMPTS = 5
const MAX_REQUESTS_PER_WINDOW = 3
const REQUEST_WINDOW_MS = 10 * 60 * 1000

const otpStore = new Map<string, OtpEntry>()
const resetTokens = new Map<string, ResetTokenEntry>()

function normalize(email: string) {
  return email.toLowerCase().trim()
}

function hashCode(code: string) {
  return createHash('sha256').update(code).digest('hex')
}

export function generateOtp(email: string): { code: string; limited: boolean } {
  const key = normalize(email)
  const now = Date.now()
  const existing = otpStore.get(key)
  const withinWindow = existing && now - existing.requestedAt < REQUEST_WINDOW_MS

  if (withinWindow && existing.requestCount >= MAX_REQUESTS_PER_WINDOW) {
    return { code: '', limited: true }
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, '0')

  otpStore.set(key, {
    hash: hashCode(code),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    requestedAt: withinWindow ? existing.requestedAt : now,
    requestCount: withinWindow ? existing.requestCount + 1 : 1,
  })

  return { code, limited: false }
}

export function verifyOtp(email: string, code: string): { ok: boolean; reason?: string } {
  const key = normalize(email)
  const entry = otpStore.get(key)

  if (!entry) return { ok: false, reason: 'No hay un código activo para este correo.' }
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(key)
    return { ok: false, reason: 'El código expiró. Solicita uno nuevo.' }
  }
  if (entry.attempts >= MAX_VERIFY_ATTEMPTS) {
    otpStore.delete(key)
    return { ok: false, reason: 'Demasiados intentos. Solicita un nuevo código.' }
  }

  entry.attempts += 1
  if (hashCode(code) !== entry.hash) {
    return { ok: false, reason: 'Código incorrecto.' }
  }

  otpStore.delete(key)
  return { ok: true }
}

export function issueResetToken(email: string): string {
  const token = randomBytes(32).toString('hex')
  resetTokens.set(token, { email: normalize(email), expiresAt: Date.now() + RESET_TOKEN_TTL_MS })
  return token
}

export function consumeResetToken(token: string): { ok: boolean; email?: string } {
  const entry = resetTokens.get(token)
  if (!entry) return { ok: false }
  if (Date.now() > entry.expiresAt) {
    resetTokens.delete(token)
    return { ok: false }
  }
  resetTokens.delete(token)
  return { ok: true, email: entry.email }
}
