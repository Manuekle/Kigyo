'use client'

import { useEffect, useRef } from 'react'
import {
  Wallet,
  Users,
  FileSignature,
  Activity,
  TrendingUp,
  Check,
  CheckCircle,
  Clock,
  PenLine,
  Receipt,
} from '@/lib/icons'

/**
 * The hero's floating cluster: four Kigyo records caught mid-operation.
 *
 * The point of this component — and the reason it is not a screenshot — is
 * that every card shows a *change of state*, which is the only thing a
 * screenshot of a dashboard can never show: money landing, a contract signing
 * itself, the day's activity accumulating, a lead crossing the funnel.
 *
 * Two rules shape the composition, and both are deliberate:
 *
 *   1. **It is balanced-asymmetric.** The four cards sit off every axis —
 *      sale left of centre, doc high right, lead low left, the activity strip
 *      low centre-right — so no edge of the cluster mirrors another, yet the
 *      visual mass still closes on itself: each card's offset is paid for by
 *      the one across the diagonal, and the wires hand-placed to match keep
 *      the whole reading as one deliberate object rather than as cards
 *      dropped where they fit.
 *   2. **The chrome is ink; only a STATUS is coloured.** There is no brand
 *      accent anywhere in here — no blue rail, no blue glow, no blue pulse.
 *      The only colour in the scene comes from the status badges, and each
 *      hue means one thing: green is settled, yellow is waiting on someone,
 *      orange is in flight. The card that is currently live is marked by
 *      elevation, not by a coloured outline.
 *
 * Almost all of the motion is CSS (see the `.hx-*` block in globals.css): the
 * stepper walk, the signature draw and the activity sweep are keyframes, so
 * they cost nothing per frame in JS and stop dead under `prefers-reduced-motion`.
 * The cards themselves are static chrome — only their content animates. The
 * one thing CSS cannot do honestly is count, so the money figure gets the
 * hook below and nothing else does.
 *
 * The records are illustrative sample data matching the app's demo seed — the
 * same ids the Ledger section uses, so the two sections read as one system.
 */

/**
 * The scene's master period, and the slice of it the sale card owns.
 *
 * These MUST match `--cycle` and the phase map documented beside it in
 * globals.css: the CSS drives the sparkline, the signature, the ticks, the
 * stepper and the four pulses, and this hook drives the one thing CSS cannot
 * do honestly — count. If the two clocks disagree the figure ticks up while
 * the flow is somewhere else entirely, which is precisely the "four unrelated
 * loops" problem the cycle exists to fix.
 */
const CYCLE_MS = 18000
const COUNT_MS = 1500

/**
 * Count from 0 to `target` at the top of every scene cycle, then hold.
 *
 * The running value is written straight to the node's `textContent` rather
 * than held in React state. A state update per frame would re-render the whole
 * scene sixty times a second to change seven characters, and the figure is not
 * something any other part of the tree needs to read.
 *
 * The element renders with the FINAL figure in the markup, which is what makes
 * this safe: with no JS, a stale bundle, or reduced motion, the card still
 * shows the real number instead of a zero. The effect only overwrites it once
 * it is about to animate — and by then the hero's own entrance still has the
 * scene at `opacity: 0`, so the reset to zero is never visible.
 *
 * The observer is what stops it burning frames once the hero scrolls away.
 * `performance.now() % CYCLE_MS` on re-entry is what keeps it in phase with
 * the CSS, whose animations never stopped.
 */
function useCountUp(target: number, format: (n: number) => string) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    // A reader who asked for less motion keeps the figure already in the
    // markup — the number is content, the counting is decoration.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0

    /** One frame: where are we in the current cycle, and what should show? */
    function frame(now: number) {
      const t = now % CYCLE_MS
      if (t < COUNT_MS) {
        // easeOutExpo: most of the travel happens immediately, so the figure
        // is legible for most of the run instead of blurring past.
        const p = t / COUNT_MS
        const eased = 1 - Math.pow(2, -10 * p)
        node!.textContent = format(Math.round(target * eased))
      } else {
        node!.textContent = format(target)
      }
      raf = requestAnimationFrame(frame)
    }

    const observer = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(raf)
      if (entry.isIntersecting) raf = requestAnimationFrame(frame)
    })
    observer.observe(node)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [target, format])

  return ref
}

/**
 * The four edges of the diamond, in the 980×372 space `.hx-scene` reserves —
 * the viewBox MUST stay equal to the stage's real height, because the layer is
 * drawn with `preserveAspectRatio: none` and any difference is a vertical
 * stretch that walks every endpoint off the card it is supposed to meet.
 *
 * They run
 * in the order the record travels them: sale → document → activity → funnel →
 * back to sale.
 *
 * The cards sit off-axis on purpose — sale left of centre, doc high right,
 * lead low left — so the four edges are hand-placed to whatever that stagger
 * needs instead of mirroring each other, and each edge has its own character
 * (a hump, a belly, an S, a swing) so the connector layer never reads as a
 * mirrored pair. Each is drawn twice (the dashed rail
 * and the lit
 * segment chasing along it), so the pair has to come from one source or the
 * pulse drifts off its own wire the moment a card moves.
 *
 * The endpoints are tucked ~30–40px under the card they leave and the card
 * they reach. That reads as a record passing *through* the cluster instead of
 * a dot skating between two boxes, and it is also what makes the layer
 * tolerant: the stage is `min(100%, 980px)`, so between 900px and roughly
 * 1030px of viewport it is a little narrower than the coordinate space and
 * every x compresses by up to 2%. A deep tuck absorbs that; a 5px tuck did
 * not, and the pulse surfaced in the gap.
 */
const WIRES = [
  'M 600 92 C 630 60, 690 70, 720 119',
  'M 740 193 C 762 250, 700 262, 655 207',
  'M 395 275 C 370 230, 320 310, 255 229',
  'M 245 211 C 205 195, 300 165, 315 110',
] as const

const SALES_TODAY = 1284900

const MONEY = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

/** Module scope so the identity is stable — the effect depends on it. */
function formatMoney(n: number) {
  return MONEY.format(n)
}

export default function HeroScene() {
  const salesRef = useCountUp(SALES_TODAY, formatMoney)

  return (
    <div className="hx-scene" aria-hidden="true">
      {/* The connector layer. `pathLength="100"` normalises every curve to the
          same dash maths, so one CSS rule drives all four edges regardless of
          their real lengths. */}
      <svg className="hx-wires" viewBox="0 0 980 372" preserveAspectRatio="none">
        {WIRES.map((d) => (
          <path className="hx-wire" pathLength="100" d={d} key={d} />
        ))}
        {WIRES.map((d, i) => (
          <path
            className={`hx-wire-pulse w${i + 1}`}
            pathLength="100"
            d={d}
            key={`p${d}`}
          />
        ))}
      </svg>

      {/* ─── norte · la venta se paga ─── */}
      <div className="hx-card" data-slot="sale">
        <div className="hx-card-top">
          <span className="hx-glyph">
            <Wallet size={12} />
          </span>
          <span className="hx-card-id">VT-0042</span>
          <span className="hx-card-spacer" />
          <span className="tag is-green">
            <CheckCircle size={13} />
            Pagada
          </span>
        </div>

        <p className="hx-card-label">Ingresos de hoy</p>
        <div className="hx-figure-row">
          <div className="hx-card-figure">
            <span ref={salesRef}>{formatMoney(SALES_TODAY)}</span>
          </div>
          <span className="tag is-green hx-delta">
            <TrendingUp size={12} />
            12,4%
          </span>
        </div>

        {/* The week, drawn rather than counted: the line writes itself in the
            sale's phase and the head lands on today's point. */}
        <div className="hx-spark">
          <svg viewBox="0 0 300 44" preserveAspectRatio="none">
            <defs>
              <linearGradient id="hxSparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop className="hx-spark-s0" offset="0" />
                <stop className="hx-spark-s1" offset="1" />
              </linearGradient>
            </defs>
            <path
              className="hx-spark-area"
              d="M 0 34 L 30 30 L 60 33 L 90 24 L 120 27 L 150 18 L 180 21 L 210 13 L 240 16 L 270 8 L 300 4 L 300 44 L 0 44 Z"
            />
            <path
              className="hx-spark-line"
              pathLength="100"
              d="M 0 34 L 30 30 L 60 33 L 90 24 L 120 27 L 150 18 L 180 21 L 210 13 L 240 16 L 270 8 L 300 4"
            />
          </svg>
          <span className="hx-spark-head" />
        </div>
      </div>

      {/* ─── este · el documento se firma ─── */}
      <div className="hx-card" data-slot="doc">
        <div className="hx-card-top">
          <span className="hx-glyph">
            <FileSignature size={12} />
          </span>
          <span className="hx-card-id">DOC-3201</span>
          <span className="hx-card-spacer" />
          <span className="tag is-indigo">
            <PenLine size={13} />
            Firmando
          </span>
        </div>

        <p className="hx-card-name">Contrato laboral</p>
        <p className="hx-card-meta">Santiago Cano · Indefinido</p>

        {/* The signature sits on its own raised sheet. A squiggle drawn
            straight onto the card floats; a sheet is the thing being signed. */}
        <div className="hx-panel hx-sign">
          <span className="hx-sign-name">Santiago Cano</span>
          <span className="hx-sign-rule" />
        </div>

        <div className="hx-card-foot">
          <span className="hx-card-meta">2 de 2 firmas</span>
          <span className="hx-marks">
            <i />
            <i />
          </span>
        </div>
      </div>

      {/* ─── sur · el día se acumula ─── */}
      <div className="hx-card" data-slot="live">
        <div className="hx-card-top">
          <span className="hx-glyph">
            <Activity size={12} />
          </span>
          <span className="hx-card-id">Actividad</span>
          <span className="hx-card-spacer" />
          <span className="tag is-blue">
            <i className="tag-dot" />
            En vivo
          </span>
        </div>

        {/* Two records arriving, each on its own raised row. This is the card
            that shows the badge vocabulary doing its job: the same pill the
            ledger below uses, on the same kind of record. */}
        <ul className="hx-feed">
          <li className="hx-panel hx-feed-row">
            <span className="hx-feed-ico">
              <Receipt size={13} />
            </span>
            <span className="hx-feed-body">
              <b>Factura FV-0091</b>
              <em>DIAN · 08:42</em>
            </span>
            <span className="tag is-green">
              <Check size={12} />
              Aceptada
            </span>
          </li>
          <li className="hx-panel hx-feed-row">
            <span className="hx-feed-ico">
              <Users size={13} />
            </span>
            <span className="hx-feed-body">
              <b>Nómina de agosto</b>
              <em>12 empleados</em>
            </span>
            <span className="tag is-pink">
              <Clock size={12} />
              En revisión
            </span>
          </li>
        </ul>
      </div>

      {/* ─── oeste · el lead cruza el embudo ─── */}
      <div className="hx-card" data-slot="lead">
        <div className="hx-card-top">
          <span className="hx-glyph">
            <Users size={12} />
          </span>
          <span className="hx-card-id">LEAD-1287</span>
          <span className="hx-card-spacer" />
          <span className="tag is-orange">
            <TrendingUp size={13} />
            En embudo
          </span>
        </div>

        <div className="hx-lead">
          <span className="hx-avatar">JP</span>
          <span className="hx-lead-body">
            <b>Juan Pérez</b>
            <em>Transporte · COT-0142</em>
          </span>
          <span className="hx-lead-check">
            <Check size={10} />
          </span>
        </div>

        {/* Three stops on one rail. The fill and the nodes share the phase
            map, so the lead is never lit ahead of the rail that carried it. */}
        <div className="hx-step">
          <span className="hx-step-rail">
            <i />
          </span>
          <span className="hx-step-node n1" />
          <span className="hx-step-node n2" />
          <span className="hx-step-node n3" />
        </div>
        <div className="hx-step-labels">
          <span>Nuevo</span>
          <span>Calificado</span>
          <span>Propuesta</span>
        </div>

        {/* The flanking pair carries the same foot row so the two sides of the
            diamond are the same height — symmetry that stops at the outline is
            not symmetry. */}
        <div className="hx-card-foot">
          <span className="hx-card-meta">Valor estimado</span>
          <span className="hx-card-amount">$ 8.400.000</span>
        </div>
      </div>
    </div>
  )
}
