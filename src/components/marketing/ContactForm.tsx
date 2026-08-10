'use client'

import { useState } from 'react'
import BeamButton from '@/components/ui/BeamButton'
import SuccessCheck from '@/components/ui/SuccessCheck'
import TextSwap from '@/components/ui/TextSwap'
import { ArrowRight } from '@/lib/icons'
import { apiFetch, errorMessage } from '@/lib/api/client'
import { useErrorShake } from '@/lib/hooks/use-error-shake'
import { demoRequestSchema } from '@/lib/validation/demo'

/** What the route hands back once the request is on record. */
interface DemoResponse {
  ok: true
  demo: { email: string; password: string } | null
}

export default function ContactForm() {
  const [sent, setSent] = useState<DemoResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('')

  // One shake target per control rather than one for the whole card: unlike a
  // rejected sign-in, this form knows exactly which field is wrong, so the
  // movement should point at it. Destructured because the React Compiler treats
  // an object holding a ref as a ref itself, and reading through it in render
  // is an error.
  const { ref: nameRef, message: nameMsg, isError: nameBad, setError: setNameErr, clearError: clearNameErr } = useErrorShake<HTMLInputElement>()
  const { ref: mailRef, message: mailMsg, isError: mailBad, setError: setMailErr, clearError: clearMailErr } = useErrorShake<HTMLInputElement>()
  const { ref: coRef, message: coMsg, isError: coBad, setError: setCoErr, clearError: clearCoErr } = useErrorShake<HTMLInputElement>()
  const { ref: msgRef, message: msgMsg, isError: msgBad, setError: setMsgErr, clearError: clearMsgErr } = useErrorShake<HTMLTextAreaElement>()
  const { ref: sendRef, message: sendMsg, isError: sendBad, setError: setSendErr, clearError: clearSendErr } = useErrorShake()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const parsed = demoRequestSchema.safeParse({
      name,
      email,
      company: company.trim() || undefined,
      message,
    })

    if (!parsed.success) {
      // Every invalid field shakes at once and keeps its own message, so the
      // form is corrected in one pass instead of one error at a time.
      const report: Record<string, (msg: string) => void> = {
        name: setNameErr,
        email: setMailErr,
        company: setCoErr,
        message: setMsgErr,
      }
      const seen = new Set<string>()
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0])
        if (seen.has(key) || !report[key]) continue
        seen.add(key)
        report[key](issue.message)
      }
      return
    }

    setLoading(true)
    clearSendErr()
    try {
      const result = await apiFetch<DemoResponse>('/api/demo/request', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      })
      setSent(result)
    } catch (err) {
      setSendErr(errorMessage(err, 'No pudimos enviar tu solicitud.'))
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="card contact-form-card contact-success">
        <SuccessCheck size={32} />
        <div className="contact-success-title">Solicitud recibida</div>
        {sent.demo ? (
          <>
            <p className="contact-success-text">
              Entra ahora mismo con la cuenta de demostración y recorre Kigyo con datos
              de ejemplo. Te escribimos en menos de 24 horas hábiles.
            </p>
            {/* Shown once, on this screen only — the credentials are not mailed,
                so they are worth copying before navigating away. */}
            <dl className="contact-demo-creds">
              <div>
                <dt>Correo</dt>
                <dd>{sent.demo.email}</dd>
              </div>
              <div>
                <dt>Contraseña</dt>
                <dd>{sent.demo.password}</dd>
              </div>
            </dl>
            <a href="/login" className="btn ink contact-demo-cta">
              Entrar a la demo
              <ArrowRight size={16} />
            </a>
          </>
        ) : (
          <p className="contact-success-text">
            Gracias por escribirnos. Nuestro equipo te responderá en menos de 24 horas
            hábiles con tu acceso de demostración.
          </p>
        )}
      </div>
    )
  }

  return (
    <form className="card contact-form-card" onSubmit={handleSubmit} noValidate>
      <div className={`contact-field t-input-wrap${nameBad ? ' is-error' : ''}`}>
        <label htmlFor="name">Nombre</label>
        <input
          id="name"
          name="name"
          type="text"
          placeholder="Tu nombre completo"
          className={`t-input${nameBad ? ' is-error' : ''}`}
          ref={nameRef}
          value={name}
          onChange={(e) => { setName(e.target.value); clearNameErr() }}
          aria-invalid={nameBad}
        />
        <p className="contact-field-err t-error-msg" role="alert">{nameMsg}</p>
      </div>

      <div className={`contact-field t-input-wrap${mailBad ? ' is-error' : ''}`}>
        <label htmlFor="email">Correo de trabajo</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="tu@empresa.com"
          autoComplete="email"
          className={`t-input${mailBad ? ' is-error' : ''}`}
          ref={mailRef}
          value={email}
          onChange={(e) => { setEmail(e.target.value); clearMailErr() }}
          aria-invalid={mailBad}
        />
        <p className="contact-field-err t-error-msg" role="alert">{mailMsg}</p>
      </div>

      <div className={`contact-field t-input-wrap${coBad ? ' is-error' : ''}`}>
        <label htmlFor="company">Empresa</label>
        <input
          id="company"
          name="company"
          type="text"
          placeholder="Nombre de tu empresa"
          autoComplete="organization"
          className={`t-input${coBad ? ' is-error' : ''}`}
          ref={coRef}
          value={company}
          onChange={(e) => { setCompany(e.target.value); clearCoErr() }}
          aria-invalid={coBad}
        />
        <p className="contact-field-err t-error-msg" role="alert">{coMsg}</p>
      </div>

      <div className={`contact-field t-input-wrap${msgBad ? ' is-error' : ''}`}>
        <label htmlFor="message">Mensaje</label>
        <textarea
          id="message"
          name="message"
          rows={5}
          placeholder="Cuéntanos de tu equipo y qué te gustaría ver en la demo"
          className={`t-input${msgBad ? ' is-error' : ''}`}
          ref={msgRef}
          value={message}
          onChange={(e) => { setMessage(e.target.value); clearMsgErr() }}
          aria-invalid={msgBad}
        />
        <p className="contact-field-err t-error-msg" role="alert">{msgMsg}</p>
      </div>

      {/* A rejected submit is about the request, not any one field, so it gets
          its own shake around the button rather than moving the inputs. */}
      <div className={`t-input-wrap${sendBad ? ' is-error' : ''}`}>
        <div ref={sendRef} className={`t-input${sendBad ? ' is-error' : ''}`}>
          <BeamButton borderRadius={18}>
            <button type="submit" className="btn ink contact-submit" disabled={loading}>
              <TextSwap>{loading ? 'Enviando…' : 'Solicitar demo'}</TextSwap>
              {!loading && <ArrowRight size={16} />}
            </button>
          </BeamButton>
        </div>
        <p className="contact-field-err contact-submit-err t-error-msg" role="alert">{sendMsg}</p>
      </div>
    </form>
  )
}
