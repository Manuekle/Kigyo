'use client'

import Link from 'next/link'
import PublicPageShell from '@/components/marketing/PublicPageShell'
import PublicCta from '@/components/marketing/PublicCta'
import Ledger from '@/components/marketing/Ledger'
import HeroScene from '@/components/marketing/HeroScene'
import FeatureCards from '@/components/marketing/FeatureCards'
import PricingPlans from '@/app/pricing/PricingPlans'
import {
  ArrowRight,
  LayoutDashboard,
  UserPlus,
  TrendingUp,
  Star,
} from '@/lib/icons'

export default function LandingPage() {
  return (
    <PublicPageShell>
      {/* ═══ hero ═══
          Three stacked layers — a lit field, a perspective floor and the
          floating record cluster — rather than the flat background image this
          replaces. All three are decorative, so all three are hidden from the
          accessibility tree; the section's meaning is the heading, the
          paragraph and the two links. */}
      <section className="hx">
        <div className="hx-field" aria-hidden="true" />
        <div className="hx-floor" aria-hidden="true"><i /></div>
        <div className="hx-noise" aria-hidden="true" />

        <div className="hx-inner">
          <Link href="/#features" className="hx-pill">
            <span className="hx-pill-tag">Nuevo</span>
            <span className="hx-pill-text">
              El asistente responde con citas a tus documentos
            </span>
            <ArrowRight size={13} />
          </Link>

          <h1 className="hx-title">El sistema operativo de <em data-text="tu negocio">tu negocio</em></h1>

          <p className="hx-sub">
            Clientes, inventario, ventas, documentos y personas en una
            plataforma que se adapta al sector de tu empresa. Con IA integrada
            y más de 60 módulos activables.
          </p>

          <div className="hx-actions">
            <Link href="/register" className="btn ink btn-lg">
              Comenzar gratis
              <ArrowRight size={16} />
            </Link>
            <Link href="/login" className="btn btn-lg">
              Iniciar sesión
            </Link>
          </div>

          <p className="hx-trust">
            <span className="hx-trust-dot" aria-hidden="true" />
            <b>+60 módulos</b> activables · Sin implementación · Multi-empresa
          </p>

          <HeroScene />
        </div>

        <div className="hx-fade" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="l-stats">
        <div className="l-stats-inner">
          <div className="l-stat" data-reveal>
            <span className="l-stat-val">+60</span>
            <span className="l-stat-lab">Módulos integrados</span>
          </div>
          <div className="l-stat" data-reveal>
            <span className="l-stat-val">Multi-sector</span>
            <span className="l-stat-lab">Cada negocio con su combinación</span>
          </div>
          <div className="l-stat" data-reveal>
            <span className="l-stat-val">IA</span>
            <span className="l-stat-lab">Responde sobre tus documentos</span>
          </div>
          <div className="l-stat" data-reveal>
            <span className="l-stat-val">24/7</span>
            <span className="l-stat-lab">Soporte disponible</span>
          </div>
        </div>
      </section>

      {/* ─── Operations ledger — the signature section ─── */}
      <Ledger />

      {/* ─── Features ─── */}
      {/* `features`, not `l-features`: the nav and the footer both link to
          `/#features`, so this id is part of the URL contract, not styling. */}
      <section id="features" className="l-section">
        <div className="l-section-head" data-reveal>
          <span className="l-eyebrow">Plataforma</span>
          <h2 className="l-section-title">Todo lo que tu negocio necesita para operar</h2>
          <p className="l-section-sub">
            Desde el primer cliente hasta la nómina, Kigyo centraliza la
            operación completa en una plataforma que crece contigo.
          </p>
        </div>

        <FeatureCards />
      </section>

      {/* ─── How it works ─── */}
      <section className="l-section l-steps">
        <div className="l-section-head" data-reveal>
          <span className="l-eyebrow">Puesta en marcha</span>
          <h2 className="l-section-title">Empieza en minutos, no en semanas</h2>
          <p className="l-section-sub">
            Crea tu empresa, elige tu sector y deja que Kigyo te proponga los
            módulos que tu negocio necesita. Sin implementaciones eternas.
          </p>
        </div>

        <div className="l-steps-grid">
          {/* The rail runs behind all three badges, so it belongs to the grid
              rather than to any one step. Decorative: the order is already
              carried by the ordinals and by the DOM. */}
          <div className="l-steps-rail" aria-hidden="true" />

          <div className="l-step" data-reveal>
            <div className="l-step-num">
              <UserPlus size={20} />
              <b>01</b>
            </div>
            <h3 className="l-step-title">Crea tu empresa</h3>
            <p className="l-step-desc">
              Nombre, país y moneda. Puedes configurarla manualmente y
              completar los detalles después.
            </p>
          </div>

          <div className="l-step" data-reveal>
            <div className="l-step-num">
              <LayoutDashboard size={20} />
              <b>02</b>
            </div>
            <h3 className="l-step-title">Elige tu sector</h3>
            <p className="l-step-desc">
              Kigyo propone los módulos de tu industria y el dashboard se
              adapta a lo que realmente operas.
            </p>
          </div>

          <div className="l-step" data-reveal>
            <div className="l-step-num">
              <TrendingUp size={20} />
              <b>03</b>
            </div>
            <h3 className="l-step-title">Opera y crece</h3>
            <p className="l-step-desc">
              Ventas del día, clientes activos, leads y stock en un vistazo.
              La IA responde sobre tus documentos.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Testimonial ─── */}
      <section className="l-section l-quote-section">
        <div className="l-quote-card" data-reveal>
          <div className="l-quote-stars">
            <Star size={16} />
            <Star size={16} />
            <Star size={16} />
            <Star size={16} />
            <Star size={16} />
          </div>
          <p className="l-quote-text">
            &ldquo;Kigyo nos permitió centralizar clientes, inventario y ventas
            en semanas. El dashboard se adaptó a nuestro sector y dejamos de
            saltar entre cinco herramientas.&rdquo;
          </p>
          <div className="l-quote-author">
            <div className="l-quote-avatar">MG</div>
            <div>
              <div className="l-quote-name">María González</div>
              <div className="l-quote-role">Gerente General</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section className="l-section">
        <div className="l-section-head" data-reveal>
          <span className="l-eyebrow">Precios</span>
          <h2 className="l-section-title">Un plan para cada etapa de tu equipo</h2>
          <p className="l-section-sub">
            Sin permanencia: cancelas cuando quieras y tus datos siguen siendo
            tuyos. Activas solo los módulos que tu empresa usa.
          </p>
        </div>

        <PricingPlans />
      </section>

      <PublicCta
        title="¿Listo para operar tu negocio en un solo lugar?"
        subtitle="Únete a las empresas que ya confían en Kigyo como su plataforma de operación."
        primary={{ href: '/login', label: 'Comenzar ahora' }}
      />
    </PublicPageShell>
  )
}