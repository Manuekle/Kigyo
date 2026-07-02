'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from '@/lib/icons'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('valentina@whitebox.co')
  const [password, setPassword] = useState('demo1234')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email || !password.trim()) { setError('Completa todos los campos.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Error al iniciar sesión.')
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
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
