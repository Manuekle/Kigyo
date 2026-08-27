import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PublicPageShell from '@/components/marketing/PublicPageShell'
import PublicCta from '@/components/marketing/PublicCta'
import { SECTOR_LANDINGS, moduleDef, presetFor, subsectorsOf } from '@/lib/modules'
import { MODULE_GROUPS } from '@/lib/modules/registry'
import { moduleRankFor } from '@/lib/data/nav'
import { SUGGESTED_ROLES } from '@/lib/suggested-roles'
import { MODULE_LABELS } from '@/lib/auth/permissions'
import { lowestPlanWith } from '@/lib/plans'
import { SITE_URL } from '@/lib/site'

/**
 * One page per industry, built from the catalogue the product already runs on.
 *
 * A prospect running a clinic landed on a home page that talks about «módulos»
 * and «sectores» in the abstract, because there was nothing else to land on:
 * `/`, `/about`, `/pricing`, `/faq`, `/contact`, `/terms`, `/privacy` was the
 * whole public site. Twenty-three industries, and the same paragraph for all of
 * them.
 *
 * ─── Why a route and not `salud.kigyo.pro` ─────────────────────────────────
 *
 * The subdomain was the instinct and it is the expensive way to get this. One
 * canonical host keeps `alternates.canonical`, the sitemap and the JSON-LD
 * saying one thing; a second host needs its own certificate, its own entry in
 * every absolute URL the product builds, and — because `NEXT_PUBLIC_APP_URL` is
 * inlined into the browser bundle at build time — a second deployment to say it
 * with. If a campaign ever wants `salud.kigyo.pro`, it is a domain redirect in
 * Vercel pointing here: one line of configuration, no change to the app.
 *
 * ─── Why it is generated and not written ───────────────────────────────────
 *
 * Every claim on the page is read from what a company of that sector actually
 * gets: `presetFor` is the same function the signup wizard seeds its toggles
 * from, and `SUGGESTED_ROLES` is the same catalogue that `seed_suggested_roles`
 * writes into the database. A marketing page that lists a module the product
 * would not switch on is the failure mode this shape makes impossible — and the
 * FAQ already shipped four claims that were not true once.
 */

export const dynamicParams = false

export function generateStaticParams() {
  return SECTOR_LANDINGS.map((t) => ({ sector: t.key }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ sector: string }> },
): Promise<Metadata> {
  const { sector } = await params
  const def = SECTOR_LANDINGS.find((t) => t.key === sector) ?? null
  if (!def) return {}
  return {
    title: `Software para ${def.label.toLowerCase()}`,
    description: `${def.description} Kigyo enciende los módulos y los roles que este sector usa, y deja apagado el resto.`,
    alternates: { canonical: `${SITE_URL}/soluciones/${def.key}` },
  }
}

export default async function SectorPage({ params }: { params: Promise<{ sector: string }> }) {
  const { sector } = await params
  /*
   * Contra `SECTOR_LANDINGS` y no contra `companyType`, que también conoce
   * `otro`. `dynamicParams = false` ya lo dejaría en 404 en producción, pero no
   * en desarrollo, y una ruta que existe en local y no en producción es la
   * clase de diferencia que se descubre después de desplegar.
   */
  const def = SECTOR_LANDINGS.find((t) => t.key === sector) ?? null
  if (!def) notFound()

  /**
   * The preset, in the order the sidebar would show it.
   *
   * `moduleRankFor` is the sidebar's own opinion — the vertical first, then the
   * groups in the order that sector works in — so the page opens on the screen
   * this business would live in rather than on «Empleados» for everybody.
   */
  const rank = moduleRankFor(def.key)
  const modules = presetFor(def.key)
    .map((key) => moduleDef(key))
    .filter((m) => m !== null)
    .sort((a, b) => rank(a.key) - rank(b.key) || a.label.localeCompare(b.label, 'es'))

  const vertical = def.vertical ? moduleDef(def.vertical) : null

  /**
   * The jobs this industry has, gathered across its subsectors.
   *
   * `SUGGESTED_ROLES` is keyed the way the seed looks them up —
   * `coalesce(subsector, company_type)` — so «Salud» itself has no entry at all
   * and its roles live under `salud-consultorio`, `salud-ips` and four more.
   * Reading only the sector key produced a page that listed twenty-two modules
   * and then claimed the sector had no roles, for the eleven sectors whose
   * roles are all at the subsector level.
   *
   * Deduped by role key, because «Recepcionista» is the same job in a
   * consultorio and in an IPS and a prospect reading a list does not care which
   * of the two the catalogue happened to define it under. The first definition
   * wins, which is the order the seed inserts them in.
   */
  const roles = [def.key, ...subsectorsOf(def.key)]
    .flatMap((key) => SUGGESTED_ROLES[key] ?? [])
    .filter((role, i, all) => all.findIndex((r) => r.key === role.key) === i)
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label, 'es'))
  /** Named out loud, not discovered later in an empty sidebar. */
  const verticalPlan = def.vertical ? lowestPlanWith(def.vertical) : null

  const byGroup = MODULE_GROUPS
    .map((group) => ({ group, items: modules.filter((m) => m.group === group) }))
    .filter((g) => g.items.length > 0)
    .sort((a, b) => (a.group === 'Sectoriales' ? -1 : b.group === 'Sectoriales' ? 1 : 0))

  return (
    <PublicPageShell>
      <div className="pub-page-head">
        <span className="pub-page-eyebrow">{def.label}</span>
        <h1 className="pub-page-title">Kigyo para {def.label.toLowerCase()}</h1>
        <p className="pub-page-sub">{def.description}</p>
      </div>

      <section className="l-section">
        <div className="l-section-head">
          <h2 className="l-section-title">
            {vertical
              ? `Empieza en ${vertical.label}, no en un menú de 57 opciones`
              : 'Empieza con lo que este negocio usa, no con el catálogo entero'}
          </h2>
          <p className="l-section-sub">
            Al registrarte eliges «{def.label}» y Kigyo enciende estos {modules.length}{' '}
            módulos. Todo queda conmutable: enciende lo que falte, apaga lo que sobre.
          </p>
        </div>

        <div className="soluciones-grid">
          {byGroup.map(({ group, items }) => (
            <div className="card soluciones-group" key={group} data-reveal>
              <h3 className="soluciones-group-name">{group}</h3>
              <ul className="soluciones-list">
                {items.map((m) => (
                  <li key={m.key}>
                    <strong>{m.shortLabel ?? m.label}</strong>
                    <span>{m.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {roles.length > 0 && (
        <section className="l-section">
          <div className="l-section-head">
            <h2 className="l-section-title">Y los roles que este negocio tiene</h2>
            <p className="l-section-sub">
              No hay que inventarlos ni repartir permisos uno por uno: se crean con la
              empresa, con lo que cada oficio necesita abrir y nada más.
            </p>
          </div>
          <div className="soluciones-roles" data-reveal>
            {roles.map((role) => {
              const opens = [...new Set(role.permissions.map((p) => p.split(':')[0]))]
                .map((k) => MODULE_LABELS[k] ?? k)
                .sort((a, b) => a.localeCompare(b, 'es'))
              return (
                <div className="card soluciones-role" key={role.key}>
                  <strong>{role.label}</strong>
                  <span>Abre {opens.join(', ')}.</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {verticalPlan && vertical && (
        <p className="soluciones-plan">
          {vertical.label} está incluido desde el plan{' '}
          <Link href="/pricing">{verticalPlan.label}</Link>.
        </p>
      )}

      {/*
        Escrito a partir del vertical y no del sector. «Configura tu {label}»
        funciona para «Comercio y retail» y no para «Salud» — «Configura tu
        salud en una tarde» es otra frase entera, dicha en la última pantalla
        antes del registro.
      */}
      <PublicCta
        title={vertical ? `Empieza en ${vertical.label} esta misma tarde` : 'Ponlo a andar esta misma tarde'}
        subtitle="Eliges el sector, ajustas los módulos, invitas a tu equipo. Nada más."
        primary={{ href: '/register', label: 'Crear cuenta' }}
        secondary={{ href: '/contact', label: 'Hablar con ventas' }}
      />
    </PublicPageShell>
  )
}
