'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import OtpInput from '@/components/ui/OtpInput'
import { ArrowLeft, Eye, EyeOff, CheckCircle } from '@/lib/icons'
import { apiFetch, errorMessage } from '@/lib/api/client'

type Step = 'email' | 'otp' | 'reset' | 'done'

const RESEND_COOLDOWN = 30

/**
 * Three-step recovery: request a code, verify it, set a new password.
 *
 * Verifying the code establishes a real Supabase session, and the password
 * change is authorized by that session. The previous flow minted its own
 * "reset token", handed it to the browser, and accepted it back from the
 * request body — whoever held the string could change the password.
 */
export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  async function requestOtp(e?: React.FormEvent) {
    e?.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Ingresa tu correo electrónico.')
      return
    }
    setLoading(true)
    try {
      // Always reports success, whether or not an account exists — the
      // response must not reveal which emails are registered.
      await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setCode('')
      setCooldown(RESEND_COOLDOWN)
      setStep('otp')
    } catch (err) {
      setError(errorMessage(err, 'No se pudo enviar el código.'))
    } finally {
      setLoading(false)
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (code.length !== 6) {
      setError('Ingresa el código de 6 dígitos.')
      return
    }
    setLoading(true)
    try {
      // On success the recovery session cookie is set; the reset step below is
      // authorized by it rather than by anything the client carries around.
      await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      })
      setStep('reset')
    } catch (err) {
      setError(errorMessage(err, 'Código inválido.'))
    } finally {
      setLoading(false)
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      setStep('done')
    } catch (err) {
      setError(errorMessage(err, 'No se pudo restablecer la contraseña.'))
    } finally {
      setLoading(false)
    }
  }

  const stepIndex = { email: 0, otp: 1, reset: 2, done: 3 }[step]

  return (
    <div className="loginwrap">
      <div className="loginbox">
        <div className="loginlogo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="Kigyo" width={46} height={46} style={{ borderRadius: 14, boxShadow: '0 4px 10px rgba(0,0,0,.25)' }} />
        </div>

        {step !== 'done' && (
          <div className="auth-steps">
            {[0, 1, 2].map((i) => (
              <span key={i} className={`auth-step-dot${i === stepIndex ? ' on' : ''}${i < stepIndex ? ' done' : ''}`} />
            ))}
          </div>
        )}

        {step === 'email' && (
          <>
            <div className="logintitle" style={{ fontSize: 22 }}>Recupera tu contraseña</div>
            <div className="loginsub">Te enviaremos un código de verificación a tu correo</div>

            <form onSubmit={requestOtp} style={{ marginTop: 24 }}>
              <label className="flabel" htmlFor="fp-email">Correo electrónico</label>
              <input
                id="fp-email"
                className="field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="correo@empresa.co"
              />

              {error && (
                <div className="errline" role="alert" style={{ marginTop: 8 }}>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn pri"
                style={{ width: '100%', height: 36, fontSize: 13.5, fontWeight: 600, marginTop: 20 }}
                disabled={loading}
              >
                {loading ? 'Enviando código…' : 'Enviar código'}
              </button>
            </form>
          </>
        )}

        {step === 'otp' && (
          <>
            <button type="button" className="auth-back" onClick={() => setStep('email')}>
              <ArrowLeft size={14} />
              Cambiar correo
            </button>
            <div className="logintitle" style={{ fontSize: 22 }}>Ingresa el código</div>
            <div className="loginsub">
              Si existe una cuenta con {email}, enviamos un código de 6 dígitos.
            </div>

            <form onSubmit={verifyCode} style={{ marginTop: 20 }}>
              <OtpInput value={code} onChange={setCode} disabled={loading} />

              {error && (
                <div className="errline" role="alert" style={{ marginTop: 14, justifyContent: 'center' }}>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn pri"
                style={{ width: '100%', height: 36, fontSize: 13.5, fontWeight: 600, marginTop: 20 }}
                disabled={loading}
              >
                {loading ? 'Verificando…' : 'Verificar código'}
              </button>
            </form>

            <div className="auth-resend">
              ¿No recibiste el código?{' '}
              <button type="button" onClick={() => requestOtp()} disabled={cooldown > 0 || loading}>
                {cooldown > 0 ? `Reenviar en ${cooldown}s` : 'Reenviar código'}
              </button>
            </div>
          </>
        )}

        {step === 'reset' && (
          <>
            <div className="logintitle" style={{ fontSize: 22 }}>Nueva contraseña</div>
            <div className="loginsub">Elige una contraseña segura para tu cuenta</div>

            <form onSubmit={resetPassword} style={{ marginTop: 24 }}>
              <label className="flabel" htmlFor="fp-password">Nueva contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="fp-password"
                  className="field"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onClick={() => setShowPw((v) => !v)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink3)' }}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              <label className="flabel" htmlFor="fp-confirm" style={{ marginTop: 14 }}>Confirmar contraseña</label>
              <input
                id="fp-confirm"
                className="field"
                type={showPw ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
              />

              {error && (
                <div className="errline" role="alert" style={{ marginTop: 8 }}>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn pri"
                style={{ width: '100%', height: 36, fontSize: 13.5, fontWeight: 600, marginTop: 20 }}
                disabled={loading}
              >
                {loading ? 'Guardando…' : 'Restablecer contraseña'}
              </button>
            </form>
          </>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <CheckCircle size={32} />
            </div>
            <div className="logintitle" style={{ fontSize: 20 }}>Contraseña restablecida</div>
            <div className="loginsub" style={{ marginTop: 6 }}>
              Tu contraseña se actualizó correctamente. Ya puedes acceder a tu cuenta.
            </div>
            <button
              type="button"
              className="btn pri"
              style={{ width: '100%', height: 36, fontSize: 13.5, fontWeight: 600, marginTop: 22 }}
              onClick={() => {
                router.refresh()
                router.replace('/dashboard')
              }}
            >
              Ir al dashboard
            </button>
          </div>
        )}

        {step !== 'done' && (
          <div className="loginfoot">
            ¿Recordaste tu contraseña?{' '}
            <Link href="/login" className="loginlink">Iniciar sesión</Link>
          </div>
        )}
      </div>
    </div>
  )
}
