'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Eye, EyeOff } from '@/lib/icons'
import { apiFetch, errorMessage } from '@/lib/api/client'
import OtpInput from '@/components/ui/OtpInput'
import TextSwap from '@/components/ui/TextSwap'
import { useErrorShake } from '@/lib/hooks/use-error-shake'

/**
 * Where to land after signing in. Read at submit time rather than through
 * `useSearchParams`, which would opt the whole page out of prerendering.
 * Only same-origin paths are followed — echoing back an attacker-supplied
 * absolute URL would be an open redirect.
 */
function redirectTarget(): string {
  if (typeof window === 'undefined') return '/dashboard'
  const next = new URLSearchParams(window.location.search).get('next')
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  // Set when the password succeeded but the account carries a second factor.
  // The session exists at this point and is deliberately useless until the
  // code lands: `getMember` refuses an aal1 session on an enrolled account.
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const { ref: formRef, message: error, isError, setError, clearError } = useErrorShake()

  function enter() {
    // The session cookie was just set. Refresh so Server Components re-run
    // with it before navigating, otherwise the dashboard renders as signed
    // out and bounces straight back here.
    router.refresh()
    router.replace(redirectTarget())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    if (!email.trim() || !password) { setError('Completa todos los campos.'); return }
    setLoading(true)
    try {
      const result = await apiFetch<{ ok: true; mfaRequired: boolean; factorId?: string }>(
        '/api/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) },
      )

      if (result.mfaRequired && result.factorId) {
        setFactorId(result.factorId)
        setLoading(false)
        return
      }

      enter()
    } catch (err) {
      setError(errorMessage(err, 'Error al iniciar sesión.'))
      setLoading(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    if (!factorId || code.length !== 6) { setError('Escribe los 6 dígitos.'); return }
    setLoading(true)
    try {
      await apiFetch('/api/auth/mfa', {
        method: 'PUT',
        body: JSON.stringify({ factorId, code }),
      })
      enter()
    } catch (err) {
      setCode('')
      setError(errorMessage(err, 'El código no es válido.'))
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-stage">
        <div className="auth-top">
          <Link href="/" className="auth-home">
            <ArrowLeft size={14} />
            Volver
          </Link>
        </div>

        <div className="auth-body">
          <div className="auth-card">
            <div className="auth-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon.svg" alt="Kigyo" width={54} height={54} />
            </div>

            <h1 className="auth-title">
              {factorId ? 'Un paso más' : '¡Qué gusto verte de nuevo!'}
            </h1>
            <p className="auth-sub">
              {factorId
                ? 'Escribe el código de 6 dígitos de tu app de autenticación.'
                : <>¿Primera vez por aquí? <Link href="/register">Crea tu cuenta gratis</Link></>}
            </p>

            {factorId ? (
              <form
                onSubmit={handleVerify}
                className={`auth-form-shell t-input-wrap${isError ? ' is-error' : ''}`}
              >
                <div ref={formRef} className={`auth-form t-input${isError ? ' is-error' : ''}`}>
                  <OtpInput
                    value={code}
                    onChange={(v) => { setCode(v); clearError() }}
                    disabled={loading}
                  />
                </div>

                {error && (
                  <div className="errline auth-err t-error-msg" role="alert">
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn ink auth-submit"
                  disabled={loading || code.length !== 6}
                >
                  <TextSwap>{loading ? 'Verificando…' : 'Verificar'}</TextSwap>
                </button>
              </form>
            ) : (
            <form
              onSubmit={handleSubmit}
              className={`auth-form-shell t-input-wrap${isError ? ' is-error' : ''}`}
            >
              {/* The whole field group is the shake target: a failed sign-in
                  can't say which of the two fields was wrong. */}
              <div ref={formRef} className={`auth-form t-input${isError ? ' is-error' : ''}`}>
                {/* Placeholder-only fields, as the design asks — the labels stay
                    in the accessibility tree so the form is still announced. */}
                <label className="sr-only" htmlFor="login-email">Correo electrónico</label>
                <input
                  id="login-email"
                  className="field"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError() }}
                  autoComplete="email"
                  placeholder="Tu correo"
                />

                <label className="sr-only" htmlFor="login-password">Contraseña</label>
                <div className="auth-pw">
                  <input
                    id="login-password"
                    className="field"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearError() }}
                    autoComplete="current-password"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="auth-pw-eye"
                    aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    onClick={() => setShowPw((v) => !v)}
                  >
                    <span className="t-icon-swap" data-state={showPw ? 'b' : 'a'} aria-hidden="true">
                      <span className="t-icon" data-icon="a"><Eye size={16} /></span>
                      <span className="t-icon" data-icon="b"><EyeOff size={16} /></span>
                    </span>
                  </button>
                </div>
              </div>

              {error && (
                <div className="errline auth-err t-error-msg" role="alert">
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" className="btn ink auth-submit" disabled={loading}>
                <TextSwap>{loading ? 'Iniciando sesión…' : 'Iniciar sesión'}</TextSwap>
              </button>
            </form>
            )}

            {!factorId && (
              <>
                <Link href="/forgot-password" className="auth-textlink">
                  ¿Olvidaste tu contraseña?
                </Link>

                <div className="auth-or">o</div>

                <Link href="/register" className="btn auth-alt">
                  Crear una cuenta
                </Link>
              </>
            )}

            <p className="auth-legal">
              Al continuar aceptas nuestros <Link href="/terms">Términos de servicio</Link> y
              nuestra <Link href="/privacy">Política de privacidad</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
