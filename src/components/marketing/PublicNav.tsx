'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Menu, X } from '@/lib/icons'

const LINKS = [
  { href: '/#features', label: 'Producto' },
  { href: '/pricing', label: 'Precios' },
  { href: '/faq', label: 'FAQ' },
  { href: '/about', label: 'Nosotros' },
  { href: '/contact', label: 'Contacto' },
]

/** The ids the hash entries above point at, in the order they appear. */
const SECTION_IDS = LINKS.filter((l) => l.href.startsWith('/#')).map((l) =>
  l.href.slice(2),
)

/**
 * Put a landing section under the nav, and keep it there while the page
 * settles. The browser's own hash jump fires once, but the landing's hero
 * mounts a canvas and a shader that change its height afterwards — so a jump
 * that was correct at navigation time ends up hundreds of pixels short. This
 * re-aims each frame until the target stops moving, which is normally two or
 * three frames and is capped either way.
 *
 * Returns a cancel function; the caller is responsible for calling it if the
 * visitor navigates away mid-flight.
 */
function scrollToSection(id: string) {
  let frames = 0
  let settled = 0
  let last = Number.NaN
  let raf = 0

  function aim() {
    const el = document.getElementById(id)
    if (el) {
      const top = el.getBoundingClientRect().top
      // `scroll-margin-top` on the target is what clears the fixed bar.
      el.scrollIntoView({ block: 'start', behavior: 'auto' })
      settled = Math.abs(top - last) < 1 ? settled + 1 : 0
      last = top
    }
    // Two still frames means the layout has stopped growing under us.
    if (settled < 2 && ++frames < 60) raf = requestAnimationFrame(aim)
  }

  raf = requestAnimationFrame(aim)
  return () => cancelAnimationFrame(raf)
}

export default function PublicNav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  // Which landing section is on screen. Empty until one is, so the hero shows
  // no marker rather than lighting "Producto" the moment the page loads.
  const [activeSection, setActiveSection] = useState('')
  const pathname = usePathname()

  /**
   * Which link the current page belongs to. The hash entries point at sections
   * of the landing page rather than routes of their own, so they only count as
   * current while the visitor is on `/` *and* that section is the one in view —
   * otherwise "Producto" would sit lit through the whole landing page.
   */
  function isCurrent(href: string) {
    if (href.startsWith('/#')) {
      return pathname === '/' && activeSection === href.slice(2)
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  /**
   * Scroll-spy for the hash entries. The observer's root is the `.landing`
   * scroller rather than the viewport, because that element — not the
   * document — is what actually scrolls on these pages. The top margin cancels
   * the fixed bar so a section counts as reached at the same point the hash
   * jump parks it.
   */
  useEffect(() => {
    // Nothing to spy on off the landing page. The last value is left alone
    // rather than cleared: `isCurrent` already gates on `pathname === '/'`, so
    // it can't be read here, and the observer re-reports on its first callback
    // the moment the visitor comes back.
    if (pathname !== '/') return
    const root = document.querySelector('.landing')
    const targets = SECTION_IDS
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)
    if (targets.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Only the crossing matters, not which entry the batch happens to
          // end on: leaving a section clears it, entering sets it.
          if (entry.isIntersecting) setActiveSection(entry.target.id)
          else setActiveSection((prev) => (prev === entry.target.id ? '' : prev))
        }
      },
      { root, rootMargin: '-88px 0px 0px 0px', threshold: 0 },
    )
    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [pathname])

  /**
   * Arriving at `/#features` from another page. Next scrolls to the hash on
   * navigation, but on this page that jump lands short — see
   * `scrollToSection` — so it is re-run here once the route has committed.
   */
  useEffect(() => {
    if (pathname !== '/') return
    const id = window.location.hash.slice(1)
    if (!id || !SECTION_IDS.includes(id)) return
    return scrollToSection(id)
  }, [pathname])

  /**
   * Clicking a hash link while already on the landing page. The route doesn't
   * change, so the effect above never re-runs and the scroll has to come from
   * the click. Delegated rather than wired per link so the footer's "Funciones"
   * — which points at the same anchor from a server component — behaves the
   * same as the nav's "Producto".
   */
  useEffect(() => {
    if (pathname !== '/') return
    let cancel: (() => void) | undefined
    function onClick(e: MouseEvent) {
      // Modified clicks open a new tab; that navigation is not ours to hijack.
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as Element | null)?.closest?.('a[href^="/#"]')
      if (!(anchor instanceof HTMLAnchorElement)) return
      const id = anchor.getAttribute('href')?.slice(2)
      if (!id || !document.getElementById(id)) return
      cancel?.()
      cancel = scrollToSection(id)
    }
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('click', onClick)
      cancel?.()
    }
  }, [pathname])

  /**
   * The public pages scroll inside `.landing`, not the document — a listener
   * on `window` alone would never fire. Scroll events don't bubble, but they
   * do reach a capturing listener, so one handler covers both cases.
   */
  useEffect(() => {
    function onScroll(e: Event) {
      const target = e.target
      const y =
        target instanceof HTMLElement ? target.scrollTop : window.scrollY
      setScrolled(y > 8)
    }
    window.addEventListener('scroll', onScroll, true)
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [])

  // Escape closes the panel; so does growing past the mobile breakpoint,
  // otherwise the drawer stays "open" behind a desktop layout that no longer
  // renders it and reopens on the way back down.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    const mq = window.matchMedia('(min-width: 901px)')
    const onChange = () => { if (mq.matches) setOpen(false) }
    window.addEventListener('keydown', onKey)
    mq.addEventListener('change', onChange)
    return () => {
      window.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onChange)
    }
  }, [open])

  return (
    <>
      <header className="pub-nav" data-scrolled={scrolled} data-open={open}>
        <div className="pub-nav-inner">
          <Link href="/" className="pub-nav-brand" onClick={() => setOpen(false)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="Kigyo" width={28} height={28} />
            <span>Kigyo</span>
          </Link>

          <nav className="pub-nav-links">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isCurrent(link.href) ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="pub-nav-actions">
            <Link href="/login" className="btn">
              Iniciar sesión
            </Link>
            {/* `ink`, not `pri`: the blue fill is the in-app action colour.
                The public pages are monochrome, so the nav CTA uses the same
                high-contrast fill as the auth screens. */}
            <Link href="/register" className="btn ink">
              Comenzar
            </Link>
          </div>

          <button
            type="button"
            className="pub-nav-burger"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
            aria-controls="pub-nav-mobile"
            onClick={() => setOpen((v) => !v)}
          >
            {/* Cross-fades rather than swapping instantly, so the burger reads
                as one control changing state. */}
            <span className="t-icon-swap" data-state={open ? 'b' : 'a'} aria-hidden="true">
              <span className="t-icon" data-icon="a"><Menu size={20} /></span>
              <span className="t-icon" data-icon="b"><X size={20} /></span>
            </span>
          </button>
        </div>

        {/* Always mounted: the panel animates between states, so unmounting it
            when closed would leave nothing to animate out of. */}
        <div className="pub-nav-drawer" data-open={open}>
          <div className="pub-nav-drawer-clip">
            {/* Closed, the panel is still in the DOM at opacity 0 — `inert` is
                what keeps its links out of the tab order. */}
            <div
              id="pub-nav-mobile"
              className="pub-nav-mobile t-panel-slide"
              data-open={open}
              inert={!open}
            >
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isCurrent(link.href) ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pub-nav-mobile-actions">
                <Link href="/login" className="btn" onClick={() => setOpen(false)}>
                  Iniciar sesión
                </Link>
                <Link href="/register" className="btn ink" onClick={() => setOpen(false)}>
                  Comenzar
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div
        className="pub-nav-catch"
        data-open={open}
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />
    </>
  )
}
