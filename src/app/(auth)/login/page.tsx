'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from '@/lib/icons'
import { apiFetch, errorMessage } from '@/lib/api/client'

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
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) { setError('Completa todos los campos.'); return }
    setLoading(true)
    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      // The session cookie was just set. Refresh so Server Components re-run
      // with it before navigating, otherwise the dashboard renders as signed
      // out and bounces straight back here.
      router.refresh()
      router.replace(redirectTarget())
    } catch (err) {
      setError(errorMessage(err, 'Error al iniciar sesión.'))
      setLoading(false)
    }
  }

  return (
    <div className="loginwrap">
      <div className="loginbox">
        <div className="loginlogo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="Kigyo" width={46} height={46} style={{ borderRadius: 14, boxShadow: '0 4px 10px rgba(0,0,0,.25)' }} />
        </div>
        <div className="logintitle" style={{ fontSize: 22 }}>Bienvenido a Kigyo</div>
        <div className="loginsub">Sistema operativo de personas</div>

        <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
          <label className="flabel" htmlFor="login-email">Correo electrónico</label>
          <input
            id="login-email"
            className="field"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="correo@empresa.co"
          />

          <label className="flabel" htmlFor="login-password" style={{ marginTop: 14 }}>Contraseña</label>
          <div style={{ position: 'relative' }}>
            <input
              id="login-password"
              className="field"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
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

          {error && (
            <div className="errline" role="alert" style={{ marginTop: 8 }}>
              <span>{error}</span>
            </div>
          )}

          <div className="loginrow">
            <label className="remember">
              <input type="checkbox" defaultChecked />
              Recordarme
            </label>
            <Link href="/forgot-password" className="loginlink">¿Olvidaste tu contraseña?</Link>
          </div>

          <button
            type="submit"
            className="btn pri"
            style={{ width: '100%', height: 36, fontSize: 13.5, fontWeight: 600 }}
            disabled={loading}
          >
            {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </form>

        <div className="loginfoot">
          ¿No tienes cuenta?{' '}
          <Link href="/register" className="loginlink">Crear cuenta</Link>
        </div>
      </div>
    </div>
  )
}
