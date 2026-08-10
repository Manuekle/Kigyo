'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import OtpInput from '@/components/ui/OtpInput'
import PageSlide from '@/components/ui/PageSlide'
import SuccessCheck from '@/components/ui/SuccessCheck'
import TextSwap from '@/components/ui/TextSwap'
import { ArrowLeft, Eye, EyeOff } from '@/lib/icons'
import { apiFetch, errorMessage } from '@/lib/api/client'
import { useErrorShake } from '@/lib/hooks/use-error-shake'

type Step = 'email' | 'otp' | 'reset' | 'done'

const RESEND_COOLDOWN = 30
const STEP_INDEX: Record<Step, number> = { email: 1, otp: 2, reset: 3, done: 4 }

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
  const [cooldown, setCooldown] = useState(0)
  const { ref: shakeRef, message: error, isError, setError, clearError } = useErrorShake()

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  async function requestOtp(e?: React.FormEvent) {
    e?.preventDefault()
    clearError()
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
    clearError()
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
    clearError()
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

  const stepIndex = STEP_INDEX[step] - 1

  // One error region for the whole wizard: only one step is on screen at a
  // time, so the message and the shake follow whichever that is.
  const errorLine = error ? (
    <div className="errline auth-err t-error-msg" role="alert">
      <span>{error}</span>
    </div>
  ) : null

  return (
    <div className="auth-shell">
      <div className="auth-stage">
        <div className="auth-top">
          {step === 'otp' ? (
            <button type="button" className="auth-home" onClick={() => { clearError(); setStep('email') }}>
              <ArrowLeft size={14} />
              Cambiar correo
            </button>
          ) : (
            <Link href="/login" className="auth-home">
              <ArrowLeft size={14} />
              Iniciar sesión
            </Link>
          )}
        </div>

        <div className="auth-body">
          <div className="auth-card">
            <div className="auth-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon.svg" alt="Kigyo" width={54} height={54} />
            </div>

            {step !== 'done' && (
              <div className="auth-steps">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`auth-step-dot${i === stepIndex ? ' on' : ''}${i < stepIndex ? ' done' : ''}`} />
                ))}
              </div>
            )}

            <PageSlide page={STEP_INDEX[step]}>
              <>
                <h1 className="auth-title">Recupera tu contraseña</h1>
                <p className="auth-sub">Te enviamos un código de verificación a tu correo</p>

                <form
                  onSubmit={requestOtp}
                  className={`auth-form-shell t-input-wrap${isError ? ' is-error' : ''}`}
                >
                  <div
                    ref={step === 'email' ? shakeRef : undefined}
                    className={`auth-form t-input${isError ? ' is-error' : ''}`}
                  >
                    <label className="sr-only" htmlFor="fp-email">Correo electrónico</label>
                    <input
                      id="fp-email"
                      className="field"
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); clearError() }}
                      autoComplete="email"
                      placeholder="Tu correo"
                    />
                  </div>

                  {step === 'email' && errorLine}

                  <button type="submit" className="btn ink auth-submit" disabled={loading}>
                    <TextSwap>{loading ? 'Enviando código…' : 'Enviar código'}</TextSwap>
                  </button>
                </form>

                <div className="auth-or">o</div>

                <Link href="/register" className="btn auth-alt">
                  Crear una cuenta
                </Link>
              </>

              <>
                <h1 className="auth-title">Ingresa el código</h1>
                <p className="auth-sub">
                  Si existe una cuenta con {email}, enviamos un código de 6 dígitos.
                </p>

                <form
                  onSubmit={verifyCode}
                  className={`auth-form-shell t-input-wrap${isError ? ' is-error' : ''}`}
                >
                  <div
                    ref={step === 'otp' ? shakeRef : undefined}
                    className={`auth-form t-input${isError ? ' is-error' : ''}`}
                  >
                    <OtpInput value={code} onChange={(v) => { setCode(v); clearError() }} disabled={loading} />
                  </div>

                  {step === 'otp' && errorLine}

                  <button type="submit" className="btn ink auth-submit" disabled={loading}>
                    <TextSwap>{loading ? 'Verificando…' : 'Verificar código'}</TextSwap>
                  </button>
                </form>

                <div className="auth-resend">
                  ¿No recibiste el código?{' '}
                  {/* No text swap on the countdown: it changes every second,
                      and animating each tick is motion for its own sake. */}
                  <button type="button" onClick={() => requestOtp()} disabled={cooldown > 0 || loading}>
                    {cooldown > 0 ? `Reenviar en ${cooldown}s` : 'Reenviar código'}
                  </button>
                </div>
              </>

              <>
                <h1 className="auth-title">Nueva contraseña</h1>
                <p className="auth-sub">Elige una contraseña segura para tu cuenta</p>

                <form
                  onSubmit={resetPassword}
                  className={`auth-form-shell t-input-wrap${isError ? ' is-error' : ''}`}
                >
                  <div
                    ref={step === 'reset' ? shakeRef : undefined}
                    className={`auth-form t-input${isError ? ' is-error' : ''}`}
                  >
                    <label className="sr-only" htmlFor="fp-password">Nueva contraseña</label>
                    <div className="auth-pw">
                      <input
                        id="fp-password"
                        className="field"
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); clearError() }}
                        autoComplete="new-password"
                        placeholder="Nueva contraseña (mínimo 8 caracteres)"
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

                    <label className="sr-only" htmlFor="fp-confirm">Confirmar contraseña</label>
                    <input
                      id="fp-confirm"
                      className="field"
                      type={showPw ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => { setConfirm(e.target.value); clearError() }}
                      autoComplete="new-password"
                      placeholder="Confirma tu contraseña"
                    />
                  </div>

                  {step === 'reset' && errorLine}

                  <button type="submit" className="btn ink auth-submit" disabled={loading}>
                    <TextSwap>{loading ? 'Guardando…' : 'Restablecer contraseña'}</TextSwap>
                  </button>
                </form>
              </>

              <>
                {/* Mounted only once the step is reached, so the draw animation
                    plays on arrival rather than behind the previous step. */}
                {step === 'done' && (
                  <div className="auth-icon">
                    <SuccessCheck />
                  </div>
                )}
                <h1 className="auth-title">Contraseña restablecida</h1>
                <p className="auth-note">
                  Tu contraseña se actualizó correctamente. Ya puedes acceder a tu cuenta.
                </p>
                <button
                  type="button"
                  className="btn ink auth-submit"
                  style={{ marginTop: 22 }}
                  onClick={() => {
                    router.refresh()
                    router.replace('/dashboard')
                  }}
                >
                  Ir al dashboard
                </button>
              </>
            </PageSlide>

            <p className="auth-legal">
              ¿Necesitas ayuda? <Link href="/contact">Escríbenos</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
