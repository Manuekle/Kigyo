import PublicPageShell from '@/components/marketing/PublicPageShell'
import PublicCta from '@/components/marketing/PublicCta'

export default function NotFound() {
  return (
    <PublicPageShell>
      <div className="pub-page-head">
        <span className="pub-page-eyebrow">404</span>
        <h1 className="pub-page-title">Página no encontrada</h1>
        <p className="pub-page-sub">
          La ruta que buscas no existe o fue movida.
        </p>
      </div>

      <PublicCta
        title="¿Te perdiste?"
        subtitle="Vuelve al inicio o explora nuestras funciones."
        primary={{ href: '/', label: 'Ir al inicio' }}
        secondary={{ href: '/contact', label: 'Contactar soporte' }}
      />
    </PublicPageShell>
  )
}
