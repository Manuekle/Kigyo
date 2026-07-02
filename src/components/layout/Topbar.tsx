'use client'

import { usePathname } from 'next/navigation'
import {
  Menu, Search, Bell, X,
} from '@/lib/icons'
import { useState } from 'react'
import { useApp } from '@/lib/context/AppContext'
import { META } from '@/lib/data/nav'
import { NOTIFS } from '@/lib/data/dashboard'

export default function Topbar() {
  const pathname = usePathname()
  const { setSidebarOpen, setCmdOpen } = useApp()
  const [notifOpen, setNotifOpen] = useState(false)

  const segment = pathname.split('/')[2] ?? 'dashboard'
  const title = META[segment] ?? 'Dashboard'

  return (
    <header className="top">
      <button className="ibtn ham" aria-label="Abrir menú" onClick={() => setSidebarOpen(true)}>
        <Menu size={18} />
      </button>

      <div className="crumb mono">{title}</div>

      <div style={{ flex: 1 }} />

      <button className="search" onClick={() => setCmdOpen(true)} style={{ cursor: 'pointer' }}>
        <Search size={15} />
        <span style={{ color: 'var(--ink3)', fontSize: 13, fontWeight: 500, flex: 1, textAlign: 'left' }}>Buscar…</span>
        <span className="kbd">/</span>
      </button>

      <button
        className="btn"
        style={{ gap: 7, paddingLeft: 12 }}
        onClick={() => window.open('https://meet.google.com/new', '_blank')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M15 10l4.553-2.277A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Meet
      </button>

      <div className="notifwrap">
        <button className="nbell" aria-label="Notificaciones" aria-expanded={notifOpen} onClick={() => setNotifOpen((v) => !v)}>
          <Bell size={17} />
          {NOTIFS.length > 0 && <span className="nbadge2">{NOTIFS.length}</span>}
        </button>

        {notifOpen && (
          <>
            <div className="popcatch" onClick={() => setNotifOpen(false)} />
            <div className="notifpanel">
              <div className="notifhead">
                <b>Notificaciones</b>
                <button className="notiflink" onClick={() => setNotifOpen(false)}>Marcar leídas</button>
              </div>
              <div className="notiflist">
                {NOTIFS.map((n, i) => (
                  <div key={i} className="notifitem">
                    <span className={`nico ${n.tone}`}><Bell size={15} /></span>
                    <div className="ntxt">
                      <b>{n.title}</b>
                      <span>{n.body} · {n.time}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="notiffoot">
                <button onClick={() => setNotifOpen(false)}>Ver toda la actividad</button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
