'use client'

import { usePathname, useRouter } from 'next/navigation'
import {
  Menu, Search, Bell, Volume, VolumeOff, Sun, Moon,
  CalendarClock, FileSignature, ShieldAlert, AlertTriangle } from '@/lib/icons'
import { useState } from 'react'
import { DROPDOWN_CLOSE_MS, dropdownClass, useExitTransition } from '@/lib/hooks/use-exit-transition'
import { useApp } from '@/lib/context/AppContext'
import { useMember } from '@/lib/context/MemberContext'
import { useSound } from '@/lib/context/SoundContext'
import { useTheme } from '@/lib/context/ThemeContext'
import { META } from '@/lib/data/nav'
import type { Notificacion } from '@/server/queries/notificaciones'

/**
 * One glyph per source. Every entry used to render the same bell, so the icon
 * column carried no information at all — the reader had to parse the title to
 * learn whether a row was a signature, a risk or a meeting.
 */
const NOTIF_ICON: Record<string, typeof Bell> = {
  firmas: FileSignature,
  riesgos: ShieldAlert,
  hseq: AlertTriangle,
  calendario: CalendarClock,
}

export default function Topbar({ notificaciones }: { notificaciones: Notificacion[] }) {
  const pathname = usePathname()
  const router = useRouter()
  const { setSidebarOpen, setCmdOpen } = useApp()
  const { can } = useMember()
  const { enabled: soundOn, toggle: toggleSound } = useSound()
  const { theme, toggle: toggleTheme } = useTheme()
  const [notifOpen, setNotifOpen] = useState(false)
  // Keeps the panel painted for its close transition — React would otherwise
  // unmount it the instant the flag flips and the exit would never be seen.
  const notif = useExitTransition(notifOpen, DROPDOWN_CLOSE_MS)

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
        <span style={{ color: 'var(--ink3)', fontSize: 13, fontWeight: 400, flex: 1, textAlign: 'left' }}>Buscar…</span>
        <span className="kbd">/</span>
      </button>

      {/* `tip-down` is not optional here: `.main` clips its overflow, so a
          tooltip above a control in the 56px topbar is cut off entirely. */}
      <button
        className="ibtn tip-down"
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
        className="ibtn tip-down"
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

      {/* Books a meeting in this app's own calendar. It used to open
          `meet.google.com/new` in a new tab: a video room that nothing here
          knew about, attached to no event, no attendees and no record — the
          one thing the button could not do was schedule anything. Only shown
          to somebody who may actually write to the calendar. */}
      {can('calendario:write') && (
        <button
          className="btn top-meet"
          aria-label="Agendar reunión"
          onClick={() => router.push('/dashboard/calendario?agendar=1')}
          data-cuelume-press="press"
        >
          <CalendarClock size={16} />
          {/* Wrapped so the phone layout can drop the word and keep the icon —
              a bare text node has nothing for CSS to hide. */}
          <span className="btn-label">Agendar</span>
        </button>
      )}

      <div className="notifwrap">
        <button
          className="nbell"
          aria-label="Notificaciones"
          aria-expanded={notifOpen}
          onClick={() => setNotifOpen((v) => !v)}
          data-cuelume-toggle="droplet"
        >
          <Bell size={17} />
          {/* The count slides onto the bell and pops, rather than appearing
              fully formed on the first paint. */}
          <span className="nbadge2 t-badge" data-open={notificaciones.length > 0}>
            <span className="t-badge-dot">{notificaciones.length}</span>
          </span>
        </button>

        {notif.render && (
          <>
            <div className="popcatch" onClick={() => setNotifOpen(false)} />
            <div className={`notifpanel ${dropdownClass(notif.shown, notif.closing)}`}>
              <div className="notifhead">
                <b>Notificaciones</b>
                {/* "Marcar leídas" is gone: there is no read state to mark.
                    These are derived from live rows — a pending signature stops
                    appearing when it is signed, not when it is dismissed. */}
              </div>
              <div className="notiflist">
                {notificaciones.length === 0 ? (
                  <div className="notifempty">Nada pendiente por ahora.</div>
                ) : notificaciones.map((n) => {
                  const Icon = NOTIF_ICON[n.id] ?? Bell
                  return (
                    <button
                      key={n.id}
                      className="notifitem"
                      onClick={() => { setNotifOpen(false); router.push(n.href) }}
                    >
                      <span className={`nico ${n.tone}`}><Icon size={15} /></span>
                      <div className="ntxt">
                        <b>{n.title}</b>
                        <span>{n.body}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
