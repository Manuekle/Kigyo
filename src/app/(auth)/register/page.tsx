'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Eye, EyeOff } from '@/lib/icons'
import { apiFetch, errorMessage } from '@/lib/api/client'
import { COMPANY_TYPES } from '@/lib/modules'
import SuccessCheck from '@/components/ui/SuccessCheck'
import TextSwap from '@/components/ui/TextSwap'
import { useErrorShake } from '@/lib/hooks/use-error-shake'

/**
 * `useSearchParams` opts the whole tree into client-side rendering unless it
 * sits behind a Suspense boundary. The form is already a client component, so
 * the boundary is what keeps the rest of the page prerenderable.
 */
export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  )
}

function RegisterForm() {
  const router = useRouter()
  // Set by the invitation link. The address is what actually decides where the
  // account lands — `handle_new_user` looks for a pending invitation matching
  // it — so this prefills the field and explains itself, rather than being
  // treated as a token.
  const invitedEmail = useSearchParams().get('email')?.trim().toLowerCase() ?? ''
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  // Empty means "not answered". The account is created either way and the
  // sector can be set later in Configuración — blocking signup on a dropdown
  // is not worth the accounts it costs.
  const [companyType, setCompanyType] = useState('')
  const [email, setEmail] = useState(invitedEmail)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkInbox, setCheckInbox] = useState(false)
  const { ref: formRef, message: error, isError, setError, clearError } = useErrorShake()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()

    if (!name.trim() || !email.trim() || !password) {
      setError('Completa todos los campos requeridos.')
      return
    }
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
      const result = await apiFetch<{ ok: true; requiresEmailConfirmation: boolean }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({ name, company, companyType, email, password }),
        },
      )

      // With email confirmation on, there is no session yet — routing to the
      // dashboard would just bounce back to /login.
      if (result.requiresEmailConfirmation) {
        setCheckInbox(true)
        setLoading(false)
        return
      }

      router.refresh()
      router.replace('/dashboard')
    } catch (err) {
      setError(errorMessage(err, 'No se pudo crear la cuenta.'))
      setLoading(false)
    }
  }

  if (checkInbox) {
    return (
      <div className="auth-shell">
        <div className="auth-stage">
          <div className="auth-top">
            <Link href="/login" className="auth-home">
              <ArrowLeft size={14} />
              Iniciar sesión
            </Link>
          </div>

          <div className="auth-body">
            <div className="auth-card">
              <div className="auth-icon">
                <SuccessCheck />
              </div>
              <h1 className="auth-title">Revisa tu correo</h1>
              <p className="auth-note">
                Si <b>{email}</b> está disponible, te enviamos un enlace para confirmar tu
                cuenta. Ábrelo para entrar a Kigyo.
              </p>

              <div className="auth-or">o</div>

              <Link href="/login" className="btn auth-alt">
                Volver a iniciar sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
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

            <h1 className="auth-title">Empecemos por tu cuenta</h1>
            <p className="auth-sub">
              ¿Ya tienes una? <Link href="/login">Inicia sesión</Link>
            </p>

            {invitedEmail && (
              <p className="auth-sub" style={{ marginTop: 10 }}>
                Te invitaron a un equipo. Regístrate con <b>{invitedEmail}</b> y entrarás
                directo a esa organización.
              </p>
            )}

            <form
              onSubmit={handleSubmit}
              className={`auth-form-shell t-input-wrap${isError ? ' is-error' : ''}`}
            >
              {/* The whole field group is the shake target: the failure the
                  server reports isn't tied to one field. */}
              <div ref={formRef} className={`auth-form t-input${isError ? ' is-error' : ''}`}>
              {/* Placeholder-only fields, as the design asks — the labels stay
                  in the accessibility tree so the form is still announced. */}
              <label className="sr-only" htmlFor="reg-name">Nombre completo</label>
              <input
                id="reg-name"
                className="field"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); clearError() }}
                autoComplete="name"
                placeholder="Tu nombre"
              />

              {/* An invited account joins an organization that already exists,
                  so asking it to name one would be asking for something the
                  signup ignores. */}
              {!invitedEmail && (
                <>
                  <label className="sr-only" htmlFor="reg-company">Empresa</label>
                  <input
                    id="reg-company"
                    className="field"
                    type="text"
                    value={company}
                    onChange={(e) => { setCompany(e.target.value); clearError() }}
                    autoComplete="organization"
                    placeholder="Nombre de tu empresa"
                  />

                  {/* The sector decides which modules the account starts with,
                      so asking here is what stops a new clinic landing on a
                      sidebar built for a construction firm. A native select
                      keeps the whole form one keyboard flow and needs no
                      portal inside the auth shell. */}
                  <label className="sr-only" htmlFor="reg-sector">Sector de tu empresa</label>
                  <span className="select-shell">
                    <select
                      id="reg-sector"
                      className="field"
                      value={companyType}
                      onChange={(e) => { setCompanyType(e.target.value); clearError() }}
                      data-empty={companyType === '' ? 'true' : undefined}
                    >
                      <option value="">¿A qué se dedica tu empresa?</option>
                      {COMPANY_TYPES.map((type) => (
                        <option key={type.key} value={type.key}>{type.label}</option>
                      ))}
                    </select>
                  </span>
                </>
              )}

              <label className="sr-only" htmlFor="reg-email">Correo electrónico</label>
              <input
                id="reg-email"
                className="field"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError() }}
                autoComplete="email"
                placeholder="Tu correo"
              />

              <label className="sr-only" htmlFor="reg-password">Contraseña</label>
              <div className="auth-pw">
                <input
                  id="reg-password"
                  className="field"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError() }}
                  autoComplete="new-password"
                  placeholder="Contraseña (mínimo 8 caracteres)"
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

              <label className="sr-only" htmlFor="reg-confirm">Confirmar contraseña</label>
              <input
                id="reg-confirm"
                className="field"
                type={showPw ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); clearError() }}
                autoComplete="new-password"
                placeholder="Confirma tu contraseña"
              />

              </div>

              {error && (
                <div className="errline auth-err t-error-msg" role="alert">
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" className="btn ink auth-submit" disabled={loading}>
                <TextSwap>{loading ? 'Creando cuenta…' : 'Crear cuenta'}</TextSwap>
              </button>
            </form>

            <p className="auth-legal">
              Al crear tu cuenta aceptas nuestros <Link href="/terms">Términos de servicio</Link> y
              nuestra <Link href="/privacy">Política de privacidad</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
