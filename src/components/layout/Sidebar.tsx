'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Users, PenLine, Calendar, Clock, Wallet, GraduationCap,
  Package, FileText, MessageSquare, Ticket, ShieldAlert, ShieldCheck, Activity, Sparkles, Settings,
  X, LogOut, Bell, Plus, Check, HelpCircle, Eye, Kanban, Receipt, ShoppingCart,
  FileCheck2, LayoutGrid, UserPlus, Tag, ChevronRight,
} from '@/lib/icons'
import Avatar from '@/components/ui/Avatar'
import { NAV, ROLES } from '@/lib/data/nav'
import { NOTIFS } from '@/lib/data/dashboard'
import { useApp } from '@/lib/context/AppContext'

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
}

const ROUTE_MAP: Record<string, string> = {
  dashboard: '/dashboard',
  empleados: '/dashboard/empleados',
  firmas: '/dashboard/firmas',
  canales: '/dashboard/canales',
  calendario: '/dashboard/calendario',
  asistencia: '/dashboard/asistencia',
  nomina: '/dashboard/nomina',
  proyectos: '/dashboard/proyectos',
  cotizaciones: '/dashboard/cotizaciones',
  compras: '/dashboard/compras',
  'ordenes-compra': '/dashboard/ordenes-compra',
  tienda: '/dashboard/tienda',
  catalogos: '/dashboard/catalogos',
  inventario: '/dashboard/inventario',
  documentos: '/dashboard/documentos',
  consultoria: '/dashboard/consultoria',
  hseq: '/dashboard/hseq',
  tickets: '/dashboard/tickets',
  riesgos: '/dashboard/riesgos',
  trazabilidad: '/dashboard/trazabilidad',
  ia: '/dashboard/ia',
  configuracion: '/dashboard/configuracion',
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { sidebarOpen, setSidebarOpen, viewAsRole, setViewAsRole, addToast } = useApp()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

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
      {sidebarOpen && (
        <div className="popcatch sb-scrim" onClick={() => setSidebarOpen(false)} />
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
          {NAV.map((section, si) => (
            <div key={si}>
              {section.label && <div className="nlabel">{section.label}</div>}
              {section.items.map((item) => (
                <button
                  key={item.key}
                  className={`nitem${isActive(item.key) ? ' on' : ''}`}
                  onClick={() => navigate(item.key)}
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
          {userMenuOpen && (
            <>
              <div className="popcatch" onClick={() => setUserMenuOpen(false)} />
              <div className="usermenu" role="menu" aria-label="Menú de usuario">
                <button className="umitem" role="menuitem" onClick={() => { setUserMenuOpen(false); }}>
                  <Bell size={16} />Notificaciones
                  {NOTIFS.length > 0 && <span className="umbadge">{NOTIFS.length}</span>}
                </button>
                <button className="umitem" role="menuitem" onClick={() => { setUserMenuOpen(false); addToast('Enlace de invitación copiado', 'ok') }}>
                  <Plus size={16} />Invitar equipo
                </button>
                <button className="umitem" role="menuitem" onClick={() => { setUserMenuOpen(false); navigate('configuracion') }}>
                  <Settings size={16} />Configuración
                </button>
                <div className="umdiv" role="separator" />
                <div className="umlabel" id="um-view-as-label"><Eye size={12} />Ver como</div>
                <div role="group" aria-labelledby="um-view-as-label">
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      className="umitem"
                      role="menuitemradio"
                      aria-checked={r === viewAsRole}
                      onClick={() => { setViewAsRole(r); setUserMenuOpen(false); addToast(`Viendo como: ${r}`, 'info') }}
                    >
                      <span style={{ width: 14, display: 'inline-flex' }}>
                        {r === viewAsRole && <Check size={14} style={{ color: 'var(--red)' }} />}
                      </span>
                      {r}
                    </button>
                  ))}
                </div>
                <div className="umdiv" role="separator" />
                <button className="umitem" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                  <HelpCircle size={16} />Ayuda y soporte
                </button>
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
            <Avatar name="Camila Restrepo" size={36} />
            <div className="suser-info" style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>Camila Restrepo</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>Líder de RRHH</div>
            </div>
            <ChevronRight className="suser-chev" size={16} color="#c4c4cc" style={{ transform: userMenuOpen ? 'rotate(90deg)' : 'none', transition: '.15s' }} />
          </button>
        </div>
      </aside>
    </>
  )
}
