'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from '@/lib/icons'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

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
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, company, email, password }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'No se pudo crear la cuenta.')
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
        <div className="logintitle" style={{ fontSize: 22 }}>Crea tu cuenta</div>
        <div className="loginsub">Empieza a gestionar a tu equipo en minutos</div>

        <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
          <label className="flabel" htmlFor="reg-name">Nombre completo</label>
          <input
            id="reg-name"
            className="field"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Tu nombre"
          />

          <label className="flabel" htmlFor="reg-company" style={{ marginTop: 14 }}>Empresa</label>
          <input
            id="reg-company"
            className="field"
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            autoComplete="organization"
            placeholder="Nombre de tu empresa"
          />

          <label className="flabel" htmlFor="reg-email" style={{ marginTop: 14 }}>Correo electrónico</label>
          <input
            id="reg-email"
            className="field"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="correo@empresa.co"
          />

          <label className="flabel" htmlFor="reg-password" style={{ marginTop: 14 }}>Contraseña</label>
          <div style={{ position: 'relative' }}>
            <input
              id="reg-password"
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

          <label className="flabel" htmlFor="reg-confirm" style={{ marginTop: 14 }}>Confirmar contraseña</label>
          <input
            id="reg-confirm"
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
            {loading ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <div className="loginfoot">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="loginlink">Iniciar sesión</Link>
        </div>
      </div>
    </div>
  )
}
