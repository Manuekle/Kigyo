import type { Metadata } from 'next'
import Link from 'next/link'
import PublicPageShell from '@/components/marketing/PublicPageShell'
import PublicCta from '@/components/marketing/PublicCta'
import { SECTOR_LANDINGS, moduleDef, presetFor } from '@/lib/modules'
import { SITE_URL } from '@/lib/site'

/**
 * The index of the twenty-three sector pages.
 *
 * The nav cannot carry twenty-two entries and a dropdown of twenty-two is the
 * same list with a click in front of it, so «Soluciones» points here. It also
 * gives the sector pages somewhere to be linked from, which is the difference
 * between twenty-two pages and twenty-two orphans.
 *
 * Which sectors are on it is `SECTOR_LANDINGS`, shared with the routes and the
 * sitemap so the three cannot disagree about what exists.
 */

export const metadata: Metadata = {
  title: 'Soluciones por sector',
  description:
    'Kigyo se configura según el negocio: clínicas, restaurantes, obra, agro, ' +
    'colegios, gimnasios, inmobiliarias y quince sectores más, cada uno con sus ' +
    'módulos y sus roles.',
  alternates: { canonical: `${SITE_URL}/soluciones` },
}

export default function SolucionesIndex() {
  const sectors = SECTOR_LANDINGS.map((type) => ({
    ...type,
    count: presetFor(type.key).length,
    vertical: type.vertical ? moduleDef(type.vertical) : null,
  }))

  return (
    <PublicPageShell>
      <div className="pub-page-head">
        <span className="pub-page-eyebrow">Soluciones</span>
        <h1 className="pub-page-title">Un ERP no se parece a otro</h1>
        <p className="pub-page-sub">
          Una clínica vive en Pacientes y una constructora en Obra. Elige el sector y
          Kigyo empieza ahí, con los módulos y los roles que ese negocio usa.
        </p>
      </div>

      <section className="l-section">
        <div className="soluciones-index">
          {sectors.map((sector) => (
            <Link
              className="card soluciones-card"
              key={sector.key}
              href={`/soluciones/${sector.key}`}
              data-reveal
            >
              <strong>{sector.label}</strong>
              <span>{sector.description}</span>
              <em>
                {sector.count} módulos
                {sector.vertical ? ` · empieza en ${sector.vertical.label}` : ''}
              </em>
            </Link>
          ))}
        </div>
      </section>

      <PublicCta
        title="¿No ves el tuyo?"
        subtitle="Configura los módulos a mano y quédate solo con lo que uses."
        primary={{ href: '/register', label: 'Crear cuenta' }}
        secondary={{ href: '/contact', label: 'Hablar con ventas' }}
      />
    </PublicPageShell>
  )
}
