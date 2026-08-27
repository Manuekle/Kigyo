import Link from 'next/link'

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Producto',
    links: [
      { href: '/#features', label: 'Funciones' },
      { href: '/pricing', label: 'Precios' },
      { href: '/login', label: 'Iniciar sesión' },
    ],
  },
  {
    title: 'Compañía',
    links: [
      { href: '/about', label: 'Sobre nosotros' },
      { href: '/contact', label: 'Contacto' },
      { href: '/faq', label: 'Preguntas frecuentes' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/terms', label: 'Términos de servicio' },
      { href: '/privacy', label: 'Política de privacidad' },
    ],
  },
]

export default function PublicFooter() {
  return (
    <footer className="pub-footer">
      <div className="pub-footer-grid">
        <div className="pub-footer-brand-col">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="Kigyo" width={32} height={32} className="pub-footer-mark" />
          <span className="pub-footer-brandname">Kigyo</span>
          <p className="pub-footer-tagline">
            CRM, ERP y punto de venta en una sola herramienta. Eliges el sector de
            tu negocio y Kigyo enciende lo que ese negocio usa.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title} className="pub-footer-col">
            <h4>{col.title}</h4>
            <ul>
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="pub-footer-bottom">
        <span>© {new Date().getFullYear()} Kigyo. Todos los derechos reservados.</span>
        <div className="pub-footer-bottom-links">
          <Link href="/terms">Términos</Link>
          <span className="l-footer-sep">·</span>
          <Link href="/privacy">Privacidad</Link>
        </div>
      </div>
    </footer>
  )
}
