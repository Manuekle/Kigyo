'use client'

import { usePathname } from 'next/navigation'
import {
  Menu, Search, Bell, Volume, VolumeOff, Sun, Moon } from '@/lib/icons'
import { useState } from 'react'
import { useApp } from '@/lib/context/AppContext'
import { useSound } from '@/lib/context/SoundContext'
import { useTheme } from '@/lib/context/ThemeContext'
import { META } from '@/lib/data/nav'
import { NOTIFS } from '@/lib/data/dashboard'

export default function Topbar() {
  const pathname = usePathname()
  const { setSidebarOpen, setCmdOpen } = useApp()
  const { enabled: soundOn, toggle: toggleSound } = useSound()
  const { theme, toggle: toggleTheme } = useTheme()
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

      <button
        className="search"
        onClick={() => setCmdOpen(true)}
        style={{ cursor: 'pointer' }}
        data-cuelume-press="droplet"
      >
        <Search size={15} />
        <span style={{ color: 'var(--ink3)', fontSize: 13, fontWeight: 500, flex: 1, textAlign: 'left' }}>Buscar…</span>
        <span className="kbd">/</span>
      </button>

      <button
        className="ibtn"
        aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        data-tip={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
        onClick={toggleTheme}
        data-cuelume-press="tick"
      >
        <span className="t-icon-swap" data-state={theme === 'dark' ? 'a' : 'b'} aria-hidden="true">
          <span className="t-icon" data-icon="a"><Moon size={17} /></span>
          <span className="t-icon" data-icon="b"><Sun size={17} /></span>
        </span>
      </button>

      {/* The icon cross-fades through .t-icon-swap rather than swapping
          instantly, so the state change reads as one control changing rather
          than two icons trading places. */}
      <button
        className="ibtn"
        role="switch"
        aria-checked={soundOn}
        aria-label={soundOn ? 'Desactivar sonidos de interfaz' : 'Activar sonidos de interfaz'}
        data-tip={soundOn ? 'Sonido activado' : 'Sonido desactivado'}
        onClick={toggleSound}
      >
        <span className="t-icon-swap" data-state={soundOn ? 'a' : 'b'} aria-hidden="true">
          <span className="t-icon" data-icon="a"><Volume size={17} /></span>
          <span className="t-icon" data-icon="b"><VolumeOff size={17} /></span>
        </span>
      </button>

      <button
        className="btn top-meet"
        aria-label="Nueva reunión de Meet"
        onClick={() => window.open('https://meet.google.com/new', '_blank')}
        data-cuelume-press="press"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 10l4.553-2.277A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* Wrapped so the phone layout can drop the word and keep the icon —
            a bare text node has nothing for CSS to hide. */}
        <span className="btn-label">Meet</span>
      </button>

      <div className="notifwrap">
        <button
          className="nbell"
          aria-label="Notificaciones"
          aria-expanded={notifOpen}
          onClick={() => setNotifOpen((v) => !v)}
          data-cuelume-toggle="droplet"
        >
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
