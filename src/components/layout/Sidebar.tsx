'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { ChevronDown, ChevronRight, HelpCircle, LogOut, Search, Settings, Star, X } from '@/lib/icons'
import Avatar from '@/components/ui/Avatar'
import CompanySwitcher from '@/components/layout/CompanySwitcher'
import { navFor, ROUTE_MAP } from '@/lib/data/nav'
import { navIcon } from '@/lib/data/nav-icons'
import {
  loadNavPrefs, navPrefsServerSnapshot, navPrefsSnapshot, saveNavPrefs, subscribeNavPrefs,
} from '@/lib/data/nav-prefs'
import { useApp } from '@/lib/context/AppContext'
import { useMember } from '@/lib/context/MemberContext'
import { ROUTE_PERMISSIONS } from '@/lib/auth/permissions'
import { DROPDOWN_CLOSE_MS, dropdownClass, useExitTransition } from '@/lib/hooks/use-exit-transition'

const DRAWER_CLOSE_MS = 200 // matches --drawer-close-dur

/**
 * How many modules can be pinned.
 *
 * Six, because the point of the shelf is that it is shorter than the list it
 * sits above. A sector preset switches on nineteen to twenty-five modules and
 * an administrator holds every one of them; a pinned section that grows to the
 * same size has restated the problem one row higher.
 */
const PIN_LIMIT = 6

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { sidebarOpen, setSidebarOpen } = useApp()
  const member = useMember()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const prefs = useSyncExternalStore(subscribeNavPrefs, navPrefsSnapshot, navPrefsServerSnapshot)
  const { open: openOverrides, pinned } = prefs

  // Holds the menu on screen for its close transition instead of cutting it.
  const userMenu = useExitTransition(userMenuOpen, DROPDOWN_CLOSE_MS)
  // Same for the drawer's scrim: the drawer itself slides out on a CSS
  // transition, but the scrim used to blink off the moment the flag flipped.
  const scrim = useExitTransition(sidebarOpen, DRAWER_CLOSE_MS)

  /**
   * The nav, shaped by the sector and narrowed to what this member can open.
   *
   * `navFor` decides the order and the headings — the vertical on top under the
   * name of the business, the general groups in the order that sector works in,
   * the tools at the bottom. This adds the thing that depends on who is
   * looking: the permission filter.
   *
   * The permission filter is not the control. Every route is still gated on the
   * server by `RequirePermission` — without this, though, the sidebar
   * advertises twenty modules and some of them answer "no tienes acceso" when
   * clicked.
   */
  const sections = useMemo(() => {
    const allowed = (k: string) => {
      const permission = ROUTE_PERMISSIONS[k]
      return !permission || member.can(permission)
    }

    return navFor(member.companyType)
      .map((section) => ({
        ...section,
        items: section.items
          .filter((item) => allowed(item.key))
          .map((item) => ({
            ...item,
            children: (item.children ?? []).filter((c) => allowed(c.key)),
          })),
      }))
      .filter((section) => section.items.length > 0)
  }, [member])

  /** Every item the nav can show, flattened — what a pin has to resolve to. */
  const byKey = useMemo(() => {
    const out = new Map<string, { key: string; label: string; icon: string }>()
    for (const section of sections) {
      for (const item of section.items) {
        out.set(item.key, item)
        for (const child of item.children) out.set(child.key, child)
      }
    }
    return out
  }, [sections])

  /**
   * Read after mount, deliberately.
   *
   * The server has no localStorage, so reading it during render would produce
   * markup the client immediately contradicts. The first paint is the default
   * shape and the stored one lands a frame later, which for a rail already on
   * screen reads as nothing at all.
   */
  useEffect(() => {
    loadNavPrefs(member.orgId)
  }, [member.orgId])

  /**
   * Pins are re-checked against the live nav on every render, not on read.
   *
   * A pin outlives the reason it was allowed: a role narrows, a plan is
   * downgraded, an administrator switches a module off. Filtering here rather
   * than when the value is loaded means the shelf can never advertise a door
   * that closed while this tab was open.
   */
  const pinnedItems = useMemo(
    () => pinned.map((k) => byKey.get(k)).filter((i) => i !== undefined).slice(0, PIN_LIMIT),
    [pinned, byKey],
  )

  /**
   * Which sections start open.
   *
   * The two the sector says come first — `navFor` has already put the vertical
   * and then the group that sector works in at the top — plus anything short
   * enough that collapsing it saves nothing. Everything else starts folded,
   * which is the whole point: an administrator opens on five or six rows
   * instead of twenty-five, and the rest is one click away rather than gone.
   */
  const defaultOpen = useMemo(() => {
    const labelled = sections.filter((s) => s.label)
    return new Set<string>([
      ...labelled.slice(0, 2).map((s) => s.label as string),
      ...labelled.filter((s) => s.items.length <= 2).map((s) => s.label as string),
    ])
  }, [sections])

  const filter = query.trim().toLowerCase()

  /** The nav under the filter. Children are matched on their own label too. */
  const shown = useMemo(() => {
    if (!filter) return sections
    return sections
      .map((section) => ({
        ...section,
        items: section.items
          .map((item) => ({
            ...item,
            children: item.children.filter((c) => c.label.toLowerCase().includes(filter)),
          }))
          .filter(
            (item) => item.label.toLowerCase().includes(filter) || item.children.length > 0,
          ),
      }))
      .filter((section) => section.items.length > 0)
  }, [sections, filter])

  function isOpen(label: string) {
    // While filtering, everything is open: a match hidden inside a folded
    // section is a search that answered nothing.
    if (filter) return true
    return openOverrides[label] ?? defaultOpen.has(label)
  }

  function toggleSection(label: string) {
    saveNavPrefs({ ...prefs, open: { ...openOverrides, [label]: !isOpen(label) } })
  }

  function togglePin(moduleKey: string) {
    // Past the limit the oldest pin drops rather than the click being refused:
    // a shelf that answers "no" to the seventh module is a shelf you stop using.
    saveNavPrefs({
      ...prefs,
      pinned: pinned.includes(moduleKey)
        ? pinned.filter((k) => k !== moduleKey)
        : [...pinned, moduleKey].slice(-PIN_LIMIT),
    })
  }

  function isActive(k: string) {
    const route = ROUTE_MAP[k]
    if (k === 'dashboard') return pathname === '/dashboard'
    return pathname.startsWith(route)
  }

  async function handleLogout() {
    await fetch('/api/auth/login', { method: 'DELETE' })
    router.push('/login')
  }

  /**
   * One row: a real link, plus the star that pins it.
   *
   * A `<Link>` and not a button with `router.push`. The rail was the only
   * navigation in the product that could not be middle-clicked, opened in a new
   * tab or prefetched, and it announced nothing to a screen reader beyond a
   * highlighted background — the marketing nav had `aria-current` and the app
   * did not. The star lives outside the anchor because a button inside a link
   * is not a thing a browser can resolve.
   */
  function row(
    item: { key: string; label: string; icon: string; badge?: string | number; badgeTone?: string },
    sub = false,
  ) {
    const on = isActive(item.key)
    const isPinned = pinned.includes(item.key)
    return (
      <div className="nitem-row" key={item.key}>
        <Link
          className={`nitem${sub ? ' nitem-sub' : ''}${on ? ' on' : ''}`}
          href={ROUTE_MAP[item.key]}
          aria-current={on ? 'page' : undefined}
          onClick={() => setSidebarOpen(false)}
          data-cuelume-press="tick"
        >
          {navIcon(item.icon, 18)}
          <span className="nitem-label">{item.label}</span>
          {item.badge !== undefined && (
            <span className={`nbadge ${item.badgeTone ?? 'a'}`}>{item.badge}</span>
          )}
        </Link>
        <button
          className={`npin${isPinned ? ' on' : ''}`}
          aria-label={isPinned ? `Quitar ${item.label} de Fijados` : `Fijar ${item.label}`}
          aria-pressed={isPinned}
          onClick={() => togglePin(item.key)}
        >
          <Star size={13} />
        </button>
      </div>
    )
  }

  return (
    <>
      {scrim.render && (
        <div
          className={`popcatch sb-scrim${scrim.closing ? ' is-closing' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sb${sidebarOpen ? ' open' : ''}`}>
        <div className="brand">
          <div className="mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="Kigyo" width={30} height={30} />
          </div>
          <div className="bname">Kigyo<div className="bsub">CRM · ERP · POS</div></div>
          {sidebarOpen && (
            <button className="ibtn" aria-label="Cerrar menú" style={{ marginLeft: 'auto' }} onClick={() => setSidebarOpen(false)}>
              <X size={15} />
            </button>
          )}
        </div>

        {/* Above the navigation, not in the user menu at the bottom: which
            company you are in changes what every item below means, so it has to
            read as context rather than as a preference. Renders nothing at all
            for the single-company case. */}
        <CompanySwitcher />

        {/* Designed and styled since the nav was written and never rendered.
            It is a control on the list and not a global search — the command
            palette is that, and it lives in the topbar. */}
        <div className="nav-find">
          <Search size={14} />
          <input
            className="nav-find-input"
            type="search"
            value={query}
            placeholder="Filtrar módulos"
            aria-label="Filtrar módulos"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <nav className="nav" aria-label="Navegación principal">
          {shown.flatMap((section, si) => {
            const label = section.label
            const open = !label || isOpen(label)
            const panelId = `nav-section-${label ? label.replace(/\s+/g, '-').toLowerCase() : si}`
            const node = (
              <div key={label ?? si}>
                {label && (
                  <button
                    className="nlabel"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => toggleSection(label)}
                  >
                    <span>{label}</span>
                    {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>
                )}
                <div id={panelId} hidden={!open}>
                  {section.items.map((item) => (
                    <div key={item.key}>
                      {row(item)}
                      {item.children.map((child) => row(child, true))}
                    </div>
                  ))}
                </div>
              </div>
            )

            /*
             * The shelf sits *under* Dashboard, not above it. Pinning is a
             * shortcut into the list; the home screen is not a shortcut, and
             * pushing it below a shelf that starts empty would move the one
             * item every person has in common.
             *
             * Hidden while filtering: a pinned module that matches is already
             * in its own section, and showing it twice in four rows of results
             * reads as two different things.
             */
            if (si !== 0 || filter || pinnedItems.length === 0) return [node]
            return [
              node,
              <div key="__pinned">
                <div className="nlabel">Fijados</div>
                {pinnedItems.map((item) => row(item))}
              </div>,
            ]
          })}

          {filter && shown.length === 0 && (
            <div className="nav-empty">
              Ningún módulo se llama así. Prueba con otra palabra, o búscalo todo con ⌘K.
            </div>
          )}
        </nav>

        <div className="sfoot">
          {userMenu.render && (
            <>
              <div className="popcatch" onClick={() => setUserMenuOpen(false)} />
              <div
                className={`usermenu ${dropdownClass(userMenu.shown, userMenu.closing)}`}
                role="menu"
                aria-label="Menú de usuario"
              >
                {/* "Notificaciones" and "Invitar equipo" used to live here.
                    The first only closed the menu — the bell in the topbar is
                    the real control and already carries the count. The second
                    reported "Enlace de invitación copiado" while copying
                    nothing. Inviting is real now, but it belongs on the Roles
                    y permisos tab beside the people it changes, not in a menu
                    that cannot show who has been invited. */}
                <Link
                  className="umitem"
                  role="menuitem"
                  href={ROUTE_MAP.configuracion}
                  onClick={() => { setUserMenuOpen(false); setSidebarOpen(false) }}
                >
                  <Settings size={16} />Configuración
                </Link>
                {/* "Ver como <rol>" was here. It wrote `viewAsRole` into
                    AppContext, toasted "Viendo como: Empleado", and nothing
                    anywhere read the value — the view never changed. In a
                    product whose selling point is per-role access that is the
                    most expensive lie in the menu: an administrator uses it to
                    check what an Empleado can see, sees the administrator view,
                    and concludes the restriction is working.

                    Real impersonation means resolving a different permission
                    set on the *server*; a client flag cannot do it, because
                    the server is what decides every page and every query. */}
                <div className="umdiv" role="separator" />
                <a className="umitem" role="menuitem" href="/contact">
                  <HelpCircle size={16} />Ayuda y soporte
                </a>
                <button className="umitem" role="menuitem" style={{ color: 'var(--redd)' }} onClick={handleLogout}>
                  <LogOut size={16} color="var(--redd)" />Cerrar sesión
                </button>
              </div>
            </>
          )}
          <button
            className="suser"
            onClick={() => setUserMenuOpen((v) => !v)}
          >
            <Avatar name={member.fullName} size={36} src={member.avatarUrl} />
            <div className="suser-info" style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
              <div style={{ fontWeight: 400, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.fullName}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{member.role}</div>
            </div>
            <ChevronRight className="suser-chev" size={16} color="var(--ink3)" style={{ transform: userMenuOpen ? 'rotate(90deg)' : 'none', transition: 'transform var(--acc-chevron) var(--acc-ease)' }} />
          </button>
        </div>
      </aside>
    </>
  )
}
