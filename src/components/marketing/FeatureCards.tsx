import type { ReactNode } from 'react'
import TiltCard from '@/components/ui/TiltCard'
import {
  Users,
  Shield,
  Sparkles,
  Calendar,
  Package,
  DollarSign,
  Check,
} from '@/lib/icons'

/**
 * The six modules, each with a small scene of what it actually does.
 *
 * The version this replaces gave all six cards the same black rounded square
 * with a different glyph inside — which is six copies of one card, and the
 * single most templated pattern on a SaaS landing page. Here the media zone
 * shows the module working: a deal crossing the pipeline board, stock crossing
 * its reorder mark, a sale being rung up and charged, the assistant citing the
 * line its answer came from, a payroll run clearing person by person, the
 * company boundary holding.
 *
 * The palette is ink plus one accent, and red is spent on exactly two things —
 * the stock alert and the blocked cross-company request — because those are
 * the only two scenes that depict something going wrong. Signal green is gone
 * entirely: a green tick on a paid sale and a green tick on a cleared employee
 * were the same badge saying two different things, which is what a colour that
 * means "generically positive" always ends up doing.
 *
 * All of the motion is CSS (`.fv-*` in globals.css) — transform and opacity
 * only, on long cycles with long rests. `--fv-delay` desynchronises the grid
 * so six cards never animate on the same beat, which is the difference
 * between a page that feels alive and one that flickers.
 */

type Feature = {
  icon: ReactNode
  title: string
  desc: string
  /**
   * Offset into the shared `--fv-cycle`, so the six cards never resolve on
   * the same beat. Negative on purpose: a negative delay starts the animation
   * already part-way through, which means every card is mid-cycle on first
   * paint instead of six scenes all beginning together and then drifting.
   */
  delay: string
  visual: ReactNode
}

const FEATURES: Feature[] = [
  {
    icon: <Users size={22} />,
    title: 'CRM — clientes y ventas',
    desc: 'Leads, embudo, cotizaciones y cartera. Todo el ciclo comercial de tu negocio en un solo lugar.',
    delay: '0s',
    visual: (
      <div className="fv fv-pipe">
        <div className="fv-pipe-col">
          <b />
          <i />
          <i />
        </div>
        <div className="fv-pipe-col">
          <b />
          <i />
        </div>
        <div className="fv-pipe-col">
          <b />
          <i />
        </div>
        <span className="fv-pipe-card" />
      </div>
    ),
  },
  {
    icon: <Package size={22} />,
    title: 'ERP — inventario y compras',
    desc: 'Productos, stock, compras a proveedores y contabilidad. Control total de la operación interna.',
    delay: '-1.4s',
    visual: (
      <div className="fv fv-stock">
        <i />
        <i />
        <i />
        <i />
        <i />
        <span className="fv-stock-mark" />
      </div>
    ),
  },
  {
    icon: <DollarSign size={22} />,
    title: 'POS — punto de venta',
    desc: 'Caja, ventas y pagos con Wompi. Emite y cobra sin salir de la plataforma, en línea o en mostrador.',
    delay: '-2.9s',
    visual: (
      <div className="fv fv-pos">
        {/* The register display: an LCD strip, and the amount PUNCHES IN one
            digit per keystroke — each digit's delay equals the matching key's
            strike delay (.30s + .36s·i), so the keys visibly type the number.
            No width-clipping reveal: a digit is either there or not. */}
        <div className="fv-pos-display">
          <b>$</b>
          <i>
            {'759084'.split('').map((digit, j) => (
              <b key={j} style={{ ['--d' as string]: `${0.3 + j * 0.36}s` }}>
                {digit}
              </b>
            ))}
          </i>
        </div>
        <div className="fv-pos-keys">
          {/* Labelled pad. Strike order (positions 1,6,3,8,2,5) spells exactly
              what the display shows — the keypad types the price for real. */}
          {['7', '8', '9', 'C', '4', '5', '6', '0'].map((label) => (
            <i key={label}>{label}</i>
          ))}
        </div>
        <div className="fv-pos-confirm">
          <Check size={10} />
          Cobrar
        </div>
      </div>
    ),
  },
  {
    icon: <Sparkles size={22} />,
    title: 'Documentos con IA',
    desc: 'Firma electrónica con trazabilidad y un asistente que responde con citas a tus propios documentos.',
    delay: '-4.3s',
    visual: (
      <div className="fv fv-doc">
        <div className="fv-doc-sheet">
          {/* Barcode-scanner pass: a red laser spanning the FULL sheet
              sweeps top to bottom; the cited line lights and pulls its tag
              out after it. */}
          <span className="fv-doc-scan" aria-hidden="true">
            <span className="fv-doc-laser">
              <span className="fv-doc-laser-track">
                <span className="fv-doc-laser-body" />
                <span className="fv-doc-laser-glow" />
                <span className="fv-doc-laser-core-blur" />
                <span className="fv-doc-laser-white" />
                <span className="fv-doc-laser-line" />
              </span>
            </span>
          </span>
          <i />
          <i />
          <i className="fv-doc-src" />
          <i />
          <i />
        </div>
        <span className="fv-doc-leader" />
        <span className="fv-doc-cite">DOC-3201 · L.14</span>
      </div>
    ),
  },
  {
    icon: <Calendar size={22} />,
    title: 'Personas y nómina',
    desc: 'Empleados, asistencia, vacaciones y nómina. La gestión del equipo, integrada a la operación.',
    delay: '-5.8s',
    visual: (
      <div className="fv fv-people">
        {['MR', 'JC', 'AL', 'SD'].map((initials, i) => (
          <span className="fv-person" key={initials} style={{ ['--p' as string]: i }}>
            <b>{initials}</b>
            <s>
              <Check size={9} />
            </s>
          </span>
        ))}
      </div>
    ),
  },
  {
    icon: <Shield size={22} />,
    title: 'Seguridad multi-empresa',
    desc: 'Cada empresa con sus datos aislados y su propio plan. Cumplimiento por diseño, no por parche.',
    delay: '-7.2s',
    visual: (
      <div className="fv fv-vault">
        <span className="fv-vault-side">
          <u />
          <u />
          <u />
        </span>
        <span className="fv-vault-side">
          <u />
          <u />
          <u />
        </span>
        <span className="fv-vault-wall" />
      </div>
    ),
  },
]

export default function FeatureCards() {
  return (
    <div className="l-features-grid">
      {FEATURES.map((feature) => (
        <TiltCard className="card l-feature" data-reveal key={feature.title}>
          <div
            className="l-feature-media"
            aria-hidden="true"
            style={{ ['--fv-delay' as string]: feature.delay }}
          >
            {feature.visual}
          </div>
          {/* Outside the media zone so the mask that fades the hatch pattern
              does not also fade the badge sitting on top of it. */}
          <div className="l-feature-icon" aria-hidden="true">
            {feature.icon}
          </div>
          <div className="l-feature-body">
            <h3 className="l-feature-title">{feature.title}</h3>
            <p className="l-feature-desc">{feature.desc}</p>
          </div>
        </TiltCard>
      ))}
    </div>
  )
}
