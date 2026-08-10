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
  FileText,
  Calendar,
  UserPlus,
  PenTool,
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
            People Operating System
          </h1>
          <p className="l-hero-sub">
            Simplifica la gestión de personas, nómina, documentos, vacaciones
            y más. Todo en un solo lugar, diseñado para equipos modernos.
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
            <span className="l-stat-val">+2,500</span>
            <span className="l-stat-lab">Empleados gestionados</span>
          </div>
          <div className="l-stat" data-reveal>
            <span className="l-stat-val">98%</span>
            <span className="l-stat-lab">Satisfacción de clientes</span>
          </div>
          <div className="l-stat" data-reveal>
            <span className="l-stat-val">40%</span>
            <span className="l-stat-lab">Menos tiempo administrativo</span>
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
          <h2 className="l-section-title">Todo lo que necesitas para gestionar tu equipo</h2>
          <p className="l-section-sub">
            Desde la contratación hasta la nómina, Kigyo centraliza cada proceso de
            recursos humanos en una plataforma moderna y fácil de usar.
          </p>
        </div>

        <div className="l-features-grid">
          <TiltCard className="card l-feature" data-reveal>
            <div className="l-feature-icon">
              <Users size={22} />
            </div>
            <h3 className="l-feature-title">Gestión de personal</h3>
            <p className="l-feature-desc">
              Perfiles completos, organigrama interactivo, documentos
              y control de asistencia en tiempo real.
            </p>
          </TiltCard>

          <TiltCard className="card l-feature" data-reveal>
            <div className="l-feature-icon">
              <FileText size={22} />
            </div>
            <h3 className="l-feature-title">Documentos y firmas</h3>
            <p className="l-feature-desc">
              Crea, envía y firma contratos, anexos y políticas.
              Todo con validez legal y trazabilidad completa.
            </p>
          </TiltCard>

          <TiltCard className="card l-feature" data-reveal>
            <div className="l-feature-icon">
              <Calendar size={22} />
            </div>
            <h3 className="l-feature-title">Vacaciones y ausencias</h3>
            <p className="l-feature-desc">
              Solicitudes, aprobaciones y calendario de equipo.
              Control de días disponibles y políticas personalizadas.
            </p>
          </TiltCard>

          <TiltCard className="card l-feature" data-reveal>
            <div className="l-feature-icon">
              <LayoutDashboard size={22} />
            </div>
            <h3 className="l-feature-title">Dashboard inteligente</h3>
            <p className="l-feature-desc">
              KPIs, rotación, clima laboral y headcount en
              tiempo real. Toda la data de tu equipo en un solo lugar.
            </p>
          </TiltCard>

          <TiltCard className="card l-feature" data-reveal>
            <div className="l-feature-icon">
              <Shield size={22} />
            </div>
            <h3 className="l-feature-title">Seguridad y cumplimiento</h3>
            <p className="l-feature-desc">
              Datos encriptados, backups automáticos y cumplimiento
              con la normativa laboral colombiana.
            </p>
          </TiltCard>

          <TiltCard className="card l-feature" data-reveal>
            <div className="l-feature-icon">
              <Sparkles size={22} />
            </div>
            <h3 className="l-feature-title">IA integrada</h3>
            <p className="l-feature-desc">
              Asistente inteligente para consultas, generación de reportes
              y análisis predictivo de tu equipo.
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
            Migra tu equipo y ten Kigyo funcionando en tres pasos simples,
            sin curva de aprendizaje ni implementaciones eternas.
          </p>
        </div>

        <div className="l-steps-grid">
          <div className="l-step" data-reveal>
            <div className="l-step-num">
              <UserPlus size={20} />
            </div>
            <h3 className="l-step-title">Crea tu equipo</h3>
            <p className="l-step-desc">
              Importa tu nómina actual o agrega colaboradores manualmente.
              Sin archivos complicados ni configuraciones extensas.
            </p>
          </div>

          <div className="l-step" data-reveal>
            <div className="l-step-num">
              <PenTool size={20} />
            </div>
            <h3 className="l-step-title">Configura procesos</h3>
            <p className="l-step-desc">
              Define políticas de vacaciones, flujos de aprobación y plantillas
              de documentos adaptadas a tu operación.
            </p>
          </div>

          <div className="l-step" data-reveal>
            <div className="l-step-num">
              <TrendingUp size={20} />
            </div>
            <h3 className="l-step-title">Opera y crece</h3>
            <p className="l-step-desc">
              Visualiza KPIs en tiempo real y deja que Kigyo se encargue del
              trabajo operativo mientras tú te enfocas en tu gente.
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
            &ldquo;Kigyo nos permitió centralizar toda la gestión de personas en
            semanas. Redujimos el trabajo administrativo de nómina y documentos
            a una fracción del tiempo que nos tomaba antes.&rdquo;
          </p>
          <div className="l-quote-author">
            <div className="l-quote-avatar">MG</div>
            <div>
              <div className="l-quote-name">María González</div>
              <div className="l-quote-role">Directora de RRHH</div>
            </div>
          </div>
        </div>
      </section>

      <PublicCta
        title="¿Listo para transformar tu gestión de personas?"
        subtitle="Únete a las empresas que ya confían en Kigyo como su sistema operativo de personas."
        primary={{ href: '/login', label: 'Comenzar ahora' }}
      />
    </PublicPageShell>
  )
}
