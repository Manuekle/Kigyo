'use client'

import { useState } from 'react'
import { ArrowRight, CheckCircle } from '@/lib/icons'

export default function ContactForm() {
  const [sent, setSent] = useState(false)

  if (sent) {
    return (
      <div className="card contact-form-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 26px' }}>
        <CheckCircle size={32} />
        <div style={{ fontSize: 16, fontWeight: 500, letterSpacing: '-.02em' }}>Mensaje enviado</div>
        <p style={{ fontSize: 13.5, color: 'var(--ink2)', lineHeight: 1.5, margin: 0 }}>
          Gracias por escribirnos. Nuestro equipo te responderá en menos de 24 horas hábiles.
        </p>
      </div>
    )
  }

  return (
    <form
      className="card contact-form-card"
      onSubmit={(e) => {
        e.preventDefault()
        setSent(true)
      }}
    >
      <div className="contact-field">
        <label htmlFor="name">Nombre</label>
        <input id="name" name="name" type="text" placeholder="Tu nombre completo" required />
      </div>
      <div className="contact-field">
        <label htmlFor="email">Correo de trabajo</label>
        <input id="email" name="email" type="email" placeholder="tu@empresa.com" required />
      </div>
      <div className="contact-field">
        <label htmlFor="company">Empresa</label>
        <input id="company" name="company" type="text" placeholder="Nombre de tu empresa" />
      </div>
      <div className="contact-field">
        <label htmlFor="message">Mensaje</label>
        <textarea id="message" name="message" rows={5} placeholder="Cuéntanos en qué podemos ayudarte" required />
      </div>
      <button type="submit" className="btn pri">
        Enviar mensaje
        <ArrowRight size={16} />
      </button>
    </form>
  )
}
