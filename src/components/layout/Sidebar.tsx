'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useMemo, useState, useSyncExternalStore } from 'react'
import {
  LayoutDashboard, Users, PenLine, Calendar, Clock, Wallet, GraduationCap,
  Package, FileText, MessageSquare, Ticket, ShieldAlert, ShieldCheck, Activity, Sparkles, Settings,
  X, LogOut, HelpCircle, Kanban, Receipt, ShoppingCart, Cashier, Store,
  FileCheck2, LayoutGrid, UserPlus, Tag, ChevronRight, Search,
  Wrench, Car, Factory, Stethoscope, School, Restaurant, Sprout, Home, Bed,
  Handshake, UserSearch, UserCheck, Target, Building2, DollarSign, Truck, BookOpen,
} from '@/lib/icons'
import Avatar from '@/components/ui/Avatar'
import CompanySwitcher from '@/components/layout/CompanySwitcher'
import { navFor, ROUTE_MAP } from '@/lib/data/nav'
import { useApp } from '@/lib/context/AppContext'
import { useMember } from '@/lib/context/MemberContext'
import { ROUTE_PERMISSIONS } from '@/lib/auth/permissions'
import { DROPDOWN_CLOSE_MS, dropdownClass, useExitTransition } from '@/lib/hooks/use-exit-transition'

const DRAWER_CLOSE_MS = 200 // matches --drawer-close-dur

/* ═══════════════════════════════════════════════════════════════════════════
 * Which headings are collapsed
 *
 * Kept in `localStorage` and read through `useSyncExternalStore` rather than
 * copied into React state by an effect. The effect version renders the sidebar
 * fully expanded, then immediately re-renders it collapsed — a visible flicker
 * on every page load for somebody who has folded a section away. This is the
 * shape React provides for exactly this: an external store with a server
 * snapshot, so hydration starts from "nothing collapsed" without a mismatch and
 * the real value arrives in the same commit.
 *
 * Per browser rather than per account: it is a preference about this screen on
 * this machine, nobody else is affected, and a round trip would make the
 * chevron feel slower than the section it opens.
 * ═══════════════════════════════════════════════════════════════════════════ */

const COLLAPSED_KEY = 'kigyo.nav.collapsed'

const NO_COLLAPSED: ReadonlySet<string> = new Set()

/**
 * `getSnapshot` must return the same object until the value actually changes,
 * or React re-renders forever. So the parse is memoised on the raw string.
 */
let snapshotCache: { raw: string | null; value: ReadonlySet<string> } = {
  raw: null,
  value: NO_COLLAPSED,
}

const collapsedListeners = new Set<() => void>()

function subscribeCollapsed(onChange: () => void) {
  collapsedListeners.add(onChange)
  // Another tab folding a section should fold it here too. `storage` does not
  // fire in the document that wrote the value, which is what the local set is
  // for.
  window.addEventListener('storage', onChange)
  return () => {
    collapsedListeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

function readCollapsed(): ReadonlySet<string> {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(COLLAPSED_KEY)
  } catch {
    // Private mode, a blocked store, a quota error. Nothing collapsed is a
    // perfectly usable sidebar, so this is not worth telling anybody about.
    return NO_COLLAPSED
  }
  if (raw !== snapshotCache.raw) {
    let value: ReadonlySet<string> = NO_COLLAPSED
    try {
      if (raw) value = new Set(JSON.parse(raw) as string[])
    } catch {
      // Somebody edited the key by hand, or an older format. Treated as empty.
    }
    snapshotCache = { raw, value }
  }
  return snapshotCache.value
}

function writeCollapsed(next: ReadonlySet<string>) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]))
  } catch {
    // See above: the sidebar still works, it just forgets.
  }
  for (const listener of collapsedListeners) listener()
}

/**
 * Folds accents, so typing "nomina" finds «Nómina» and "operacion" finds
 * «Operación». Half the nav is accented and nobody reaches for the dead key
 * while filtering a list.
 */
function fold(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

const ICON_MAP: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard size={18} />,
  Users: <Users size={18} />,
  PenLine: <PenLine size={18} />,
  Calendar: <Calendar size={18} />,
  Clock: <Clock size={18} />,
  Wallet: <Wallet size={18} />,
  GraduationCap: <GraduationCap size={18} />,
  Package: <Package size={18} />,
  FileText: <FileText size={18} />,
  MessageSquare: <MessageSquare size={18} />,
  Ticket: <Ticket size={18} />,
  ShieldAlert: <ShieldAlert size={18} />,
  ShieldCheck: <ShieldCheck size={18} />,
  Activity: <Activity size={18} />,
  Sparkles: <Sparkles size={18} />,
  Settings: <Settings size={18} />,
  Kanban: <Kanban size={18} />,
  Receipt: <Receipt size={18} />,
  ShoppingCart: <ShoppingCart size={18} />,
  Cashier: <Cashier size={18} />,
  Store: <Store size={18} />,
  FileCheck2: <FileCheck2 size={18} />,
  LayoutGrid: <LayoutGrid size={18} />,
  UserPlus: <UserPlus size={18} />,
  Tag: <Tag size={18} />,
  Wrench: <Wrench size={18} />,
  Car: <Car size={18} />,
  Factory: <Factory size={18} />,
  Stethoscope: <Stethoscope size={18} />,
  School: <School size={18} />,
  Restaurant: <Restaurant size={18} />,
  Sprout: <Sprout size={18} />,
  Home: <Home size={18} />,
  Bed: <Bed size={18} />,
  Handshake: <Handshake size={18} />,
  UserSearch: <UserSearch size={18} />,
  UserCheck: <UserCheck size={18} />,
  Target: <Target size={18} />,
  Building2: <Building2 size={18} />,
  DollarSign: <DollarSign size={18} />,
  Truck: <Truck size={18} />,
  BookOpen: <BookOpen size={18} />,
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { sidebarOpen, setSidebarOpen } = useApp()
  const member = useMember()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  // Holds the menu on screen for its close transition instead of cutting it.
  const userMenu = useExitTransition(userMenuOpen, DROPDOWN_CLOSE_MS)
  // Same for the drawer's scrim: the drawer itself slides out on a CSS
  // transition, but the scrim used to blink off the moment the flag flipped.
  const scrim = useExitTransition(sidebarOpen, DRAWER_CLOSE_MS)

  const [query, setQuery] = useState('')
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsed,
    () => NO_COLLAPSED,
  )

  function toggleSection(label: string) {
    const next = new Set(collapsed)
    if (next.has(label)) next.delete(label)
    else next.add(label)
    writeCollapsed(next)
  }

  /**
   * The nav, shaped by the sector and narrowed to what this member can open.
   *
   * `navFor` decides the order and the headings — the vertical on top under the
   * name of the business, the general groups in the order that sector works in,
   * the tools at the bottom. This adds the two things that depend on who is
   * looking: the permission filter and the search box.
   *
   * The permission filter is not the control. Every route is still gated on the
   * server by `RequirePermission` — without this, though, the sidebar
   * advertises twenty modules and some of them answer "no tienes acceso" when
   * clicked.
   */
  const sections = useMemo(() => {
    const needle = fold(query.trim())
    const allowed = (key: string) => {
      const permission = ROUTE_PERMISSIONS[key]
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
          }))
          // A parent matching keeps its children; a child matching pulls its
          // parent in as its own row, because a nested item with no heading
          // above it is a link to nowhere the reader can place.
          .filter((item) =>
            !needle ||
            fold(item.label).includes(needle) ||
            item.children.some((c) => fold(c.label).includes(needle)),
          ),
      }))
      .filter((section) => section.items.length > 0)
  }, [member, query])

  /** While searching, every heading opens: a hidden match is not a match. */
  const searching = query.trim().length > 0

  function isActive(key: string) {
    const route = ROUTE_MAP[key]
    if (key === 'dashboard') return pathname === '/dashboard'
    return pathname.startsWith(route)
  }

  function navigate(key: string) {
    router.push(ROUTE_MAP[key])
    setSidebarOpen(false)
  }

  async function handleLogout() {
    await fetch('/api/auth/login', { method: 'DELETE' })
    router.push('/login')
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
          <div className="bname">Kigyo<div className="bsub">People Operating System</div></div>
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

        {/* Thirty-seven items is more than anybody scans. The filter is not a
            command palette — it does not leave the sidebar or search data — it
            just shortens the list you are already looking at, which is the
            thing people were doing by eye. */}
        <div className="nav-find">
          <Search size={14} />
          <input
            className="nav-find-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar módulo"
            aria-label="Buscar en el menú"
          />
        </div>

        <nav className="nav">
          {sections.map((section, si) => {
            const shut = !searching && section.label !== undefined && collapsed.has(section.label)
            return (
              <div key={section.label ?? si}>
                {section.label && (
                  <button
                    type="button"
                    className={`nlabel nlabel-btn${shut ? ' is-shut' : ''}`}
                    onClick={() => toggleSection(section.label as string)}
                    aria-expanded={!shut}
                  >
                    <ChevronRight className="nlabel-chev" size={12} />
                    {section.label}
                    {/* The count, only while folded. Without it a collapsed
                        heading is indistinguishable from an empty one — a
                        heading with nothing under it reads as something broken,
                        which is exactly how «Comercial» looked the first time
                        this shipped. */}
                    {shut && <span className="nlabel-count">{section.items.length}</span>}
                  </button>
                )}
                {!shut && section.items.map((item) => (
                  <div key={item.key}>
                    <button
                      className={`nitem${isActive(item.key) ? ' on' : ''}`}
                      onClick={() => navigate(item.key)}
                      data-cuelume-press="tick"
                    >
                      {ICON_MAP[item.icon]}
                      <span className="nitem-label">{item.label}</span>
                      {item.badge !== undefined && (
                        <span className={`nbadge ${item.badgeTone ?? 'a'}`}>{item.badge}</span>
                      )}
                    </button>
                    {item.children.map((child) => (
                      <button
                        key={child.key}
                        className={`nitem nitem-sub${isActive(child.key) ? ' on' : ''}`}
                        onClick={() => navigate(child.key)}
                        data-cuelume-press="tick"
                      >
                        {ICON_MAP[child.icon]}
                        <span className="nitem-label">{child.label}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )
          })}
          {sections.length === 0 && (
            <p className="nav-empty">Ningún módulo coincide con «{query.trim()}».</p>
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
                <button className="umitem" role="menuitem" onClick={() => { setUserMenuOpen(false); navigate('configuracion') }}>
                  <Settings size={16} />Configuración
                </button>
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
            <Avatar name={member.fullName} size={36} />
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
