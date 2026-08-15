'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Ferrofluid from '@/components/ui/Ferrofluid'
import BeamButton from '@/components/ui/BeamButton'
import TiltCard from '@/components/ui/TiltCard'
import { useTheme } from '@/lib/context/ThemeContext'
import PublicPageShell from '@/components/marketing/PublicPageShell'
import PublicCta from '@/components/marketing/PublicCta'
import Ledger from '@/components/marketing/Ledger'
import {
  ArrowRight,
  Users,
  Shield,
  Sparkles,
  LayoutDashboard,
  Calendar,
  UserPlus,
  Package,
  DollarSign,
  TrendingUp,
  Star,
} from '@/lib/icons'

/**
 * The hero fluid is drawn as light and composited with `screen` on dark, where
 * white lifts off the near-black page. On a white page `screen` is a no-op —
 * so light mode draws it dark and composites with `multiply` instead.
 */
const FERRO_COLORS = {
  dark: ['#ffffff', '#f5f5f5', '#ebebeb'],
  light: ['#1c1c1e', '#2a2a2e', '#3a3a40'],
} as const

export default function LandingPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const colors = useMemo(() => [...FERRO_COLORS[theme]], [theme])

  return (
    <PublicPageShell>
      {/* ─── Hero ─── */}
      <section className="l-hero">
        <div className="l-ferro">
          <Ferrofluid
            colors={colors}
            speed={0.4}
            scale={1.8}
            turbulence={0.8}
            fluidity={0.08}
            rimWidth={0.18}
            sharpness={2.8}
            shimmer={1.2}
            glow={1.8}
            flowDirection="down"
            opacity={0.85}
            mouseInteraction
            mouseStrength={0.8}
            mouseRadius={0.3}
            mouseDampening={0.12}
            mixBlendMode={theme === 'dark' ? 'screen' : 'multiply'}
          />
        </div>
        <div className="l-hero-content">
          <h1 className="l-hero-title">
            CRM, ERP y Punto de Venta en un solo lugar
          </h1>
          <p className="l-hero-sub">
            Clientes, inventario, ventas, documentos y personas en una
            plataforma que se adapta al sector de tu empresa. Con IA integrada
            y más de 60 módulos activables.
          </p>
          <div className="l-hero-actions">
            {/* The ring is drawn on layers behind the child, so the button
                keeps owning its own layout and text. 22px is half the 44px
                hero control — the pill's real corner. */}
            <BeamButton borderRadius={22}>
              <button
                type="button"
                className="btn ink"
                style={{ height: 44, fontSize: 14, fontWeight: 400, padding: '0 24px' }}
                onClick={() => router.push('/login')}
              >
                Iniciar sesión
                <ArrowRight size={16} />
              </button>
            </BeamButton>
            <button
              type="button"
              className="btn"
              style={{ height: 44, fontSize: 14, fontWeight: 400, padding: '0 24px' }}
              onClick={() => {
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              Conocer más
            </button>
          </div>
        </div>
        <div className="l-hero-scroll">
          <span>Descubre más</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
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

        <div className="l-features-grid">
          <TiltCard className="card l-feature" data-reveal>
            <div className="l-feature-icon">
              <Users size={22} />
            </div>
            <h3 className="l-feature-title">CRM — clientes y ventas</h3>
            <p className="l-feature-desc">
              Leads, embudo, cotizaciones y cartera. Todo el ciclo comercial
              de tu negocio en un solo lugar.
            </p>
          </TiltCard>

          <TiltCard className="card l-feature" data-reveal>
            <div className="l-feature-icon">
              <Package size={22} />
            </div>
            <h3 className="l-feature-title">ERP — inventario y compras</h3>
            <p className="l-feature-desc">
              Productos, stock, compras a proveedores y contabilidad.
              Control total de la operación interna.
            </p>
          </TiltCard>

          <TiltCard className="card l-feature" data-reveal>
            <div className="l-feature-icon">
              <DollarSign size={22} />
            </div>
            <h3 className="l-feature-title">POS — punto de venta</h3>
            <p className="l-feature-desc">
              Caja, ventas y pagos con Wompi. Emite y cobra sin salir de la
              plataforma, en línea o en mostrador.
            </p>
          </TiltCard>

          <TiltCard className="card l-feature" data-reveal>
            <div className="l-feature-icon">
              <Sparkles size={22} />
            </div>
            <h3 className="l-feature-title">Documentos con IA</h3>
            <p className="l-feature-desc">
              Firma electrónica con trazabilidad y un asistente que responde
              con citas a tus propios documentos.
            </p>
          </TiltCard>

          <TiltCard className="card l-feature" data-reveal>
            <div className="l-feature-icon">
              <Calendar size={22} />
            </div>
            <h3 className="l-feature-title">Personas y nómina</h3>
            <p className="l-feature-desc">
              Empleados, asistencia, vacaciones y nómina. La gestión del
              equipo, integrada a la operación.
            </p>
          </TiltCard>

          <TiltCard className="card l-feature" data-reveal>
            <div className="l-feature-icon">
              <Shield size={22} />
            </div>
            <h3 className="l-feature-title">Seguridad multi-empresa</h3>
            <p className="l-feature-desc">
              Cada empresa con sus datos aislados y su propio plan.
              Cumplimiento por diseño, no por parche.
            </p>
          </TiltCard>
        </div>
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
          <div className="l-step" data-reveal>
            <div className="l-step-num">
              <UserPlus size={20} />
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

      <PublicCta
        title="¿Listo para operar tu negocio en un solo lugar?"
        subtitle="Únete a las empresas que ya confían en Kigyo como su plataforma de operación."
        primary={{ href: '/login', label: 'Comenzar ahora' }}
      />
    </PublicPageShell>
  )
}