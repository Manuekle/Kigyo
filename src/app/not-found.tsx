import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="loginwrap">
      <div style={{ textAlign: 'center', padding: '0 24px' }}>
        <div style={{ fontSize: 72, fontWeight: 900, letterSpacing: '-.06em', lineHeight: 1, color: 'var(--red)', marginBottom: 8 }}>404</div>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.04em', marginBottom: 8 }}>Página no encontrada</div>
        <div style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 28, lineHeight: 1.5 }}>
          La ruta que buscas no existe o fue movida.
        </div>
        <Link href="/dashboard" className="btn pri" style={{ textDecoration: 'none' }}>
          Ir al dashboard
        </Link>
      </div>
    </div>
  )
}
