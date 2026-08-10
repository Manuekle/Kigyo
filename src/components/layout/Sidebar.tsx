'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Users, PenLine, Calendar, Clock, Wallet, GraduationCap,
  Package, FileText, MessageSquare, Ticket, ShieldAlert, ShieldCheck, Activity, Sparkles, Settings,
  X, LogOut, HelpCircle, Kanban, Receipt, ShoppingCart,
  FileCheck2, LayoutGrid, UserPlus, Tag, ChevronRight,
  Wrench, Car, Factory, Stethoscope, School, Restaurant, Sprout, Home, Bed,
  Handshake, UserSearch, Target, Building2, DollarSign, Truck, BookOpen,
} from '@/lib/icons'
import Avatar from '@/components/ui/Avatar'
import { NAV, ROUTE_MAP } from '@/lib/data/nav'
import { useApp } from '@/lib/context/AppContext'
import { useMember } from '@/lib/context/MemberContext'
import { ROUTE_PERMISSIONS } from '@/lib/auth/permissions'
import { DROPDOWN_CLOSE_MS, dropdownClass, useExitTransition } from '@/lib/hooks/use-exit-transition'

const DRAWER_CLOSE_MS = 200 // matches --drawer-close-dur

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

  /**
   * The nav only lists what this member can actually open. Every route is
   * still gated on the server by `RequirePermission`, so this is not the
   * control — without it, though, the sidebar advertises twenty modules and
   * some of them answer "no tienes acceso" when clicked.
   */
  const sections = NAV
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const permission = ROUTE_PERMISSIONS[item.key]
        return !permission || member.can(permission)
      }),
    }))
    .filter((section) => section.items.length > 0)

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

        <nav className="nav">
          {sections.map((section, si) => (
            <div key={si}>
              {section.label && <div className="nlabel">{section.label}</div>}
              {section.items.map((item) => (
                <button
                  key={item.key}
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
              ))}
            </div>
          ))}
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
