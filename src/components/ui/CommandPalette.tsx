'use client'

import { useEffect, useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, LayoutDashboard, Users, PenTool, Calendar, Clock, DollarSign, BookOpen, Package, FileText, MessageSquare, Ticket, ShieldAlert, Activity, Sparkles, Settings, ArrowRight, Wallet, Kanban, Receipt, ShoppingCart, FileCheck2, LayoutGrid, PenLine, Tag, ShieldCheck } from '@/lib/icons'
import Avatar from '@/components/ui/Avatar'
import { EMPLEADOS } from '@/lib/data/empleados'
import { NAV } from '@/lib/data/nav'
import { useApp } from '@/lib/context/AppContext'
import { useFocusTrap } from '@/lib/hooks/use-focus-trap'

const ICON_MAP: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard size={15} />,
  Users: <Users size={15} />,
  PenTool: <PenTool size={15} />,
  Calendar: <Calendar size={15} />,
  Clock: <Clock size={15} />,
  DollarSign: <DollarSign size={15} />,
  BookOpen: <BookOpen size={15} />,
  Package: <Package size={15} />,
  FileText: <FileText size={15} />,
  MessageSquare: <MessageSquare size={15} />,
  Ticket: <Ticket size={15} />,
  ShieldAlert: <ShieldAlert size={15} />,
  Activity: <Activity size={15} />,
  Sparkles: <Sparkles size={15} />,
  Settings: <Settings size={15} />,
  Wallet: <Wallet size={15} />,
  Kanban: <Kanban size={15} />,
  Receipt: <Receipt size={15} />,
  ShoppingCart: <ShoppingCart size={15} />,
  FileCheck2: <FileCheck2 size={15} />,
  LayoutGrid: <LayoutGrid size={15} />,
  PenLine: <PenLine size={15} />,
  Tag: <Tag size={15} />,
  ShieldCheck: <ShieldCheck size={15} />,
}

const ROUTE_MAP: Record<string, string> = {
  dashboard: '/dashboard', empleados: '/dashboard/empleados', firmas: '/dashboard/firmas',
  calendario: '/dashboard/calendario', asistencia: '/dashboard/asistencia', nomina: '/dashboard/nomina',
  inventario: '/dashboard/inventario', documentos: '/dashboard/documentos',
  consultoria: '/dashboard/consultoria', tickets: '/dashboard/tickets', riesgos: '/dashboard/riesgos',
  trazabilidad: '/dashboard/trazabilidad', ia: '/dashboard/ia', configuracion: '/dashboard/configuracion',
}

type Result =
  | { kind: 'emp'; id: number; name: string; role: string; dept: string }
  | { kind: 'page'; key: string; label: string; icon: string }

export default function CommandPalette() {
  const { cmdOpen, setCmdOpen } = useApp()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setCmdOpen])

  // The palette body mounts only while open, so the query and the highlighted
  // row reset by remounting rather than through an effect that fired an extra
  // render on every open. Escape is handled by the focus trap inside.
  if (!cmdOpen) return null
  return <CommandPaletteBody onClose={() => setCmdOpen(false)} />
}

function CommandPaletteBody({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const router = useRouter()
  const listId = useId()

  const trapRef = useFocusTrap<HTMLDivElement>(true, { onEscape: onClose })

  const pages = NAV.flatMap((s) => s.items)
  const empResults: Result[] = EMPLEADOS
    .filter((e) => !q || e.name.toLowerCase().includes(q.toLowerCase()) || e.dept.toLowerCase().includes(q.toLowerCase()) || e.role.toLowerCase().includes(q.toLowerCase()))
    .slice(0, q ? 5 : 3)
    .map((e) => ({ kind: 'emp', id: e.id, name: e.name, role: e.role, dept: e.dept }))

  const pageResults: Result[] = pages
    .filter((p) => !q || p.label.toLowerCase().includes(q.toLowerCase()))
    .slice(0, q ? 6 : 8)
    .map((p) => ({ kind: 'page', key: p.key, label: p.label, icon: p.icon }))

  const results: Result[] = [...empResults, ...pageResults]

  function go(r: Result) {
    if (r.kind === 'emp') router.push(`/dashboard/empleados/${r.id}`)
    else router.push(ROUTE_MAP[r.key] ?? '/dashboard')
    onClose()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    if (e.key === 'Enter' && results[active]) go(results[active])
  }

  const activeId = results[active] ? `${listId}-opt-${active}` : undefined

  return (
    <div ref={trapRef} role="dialog" aria-modal="true" aria-label="Buscador de comandos">
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,18,.55)', backdropFilter: 'blur(4px)', zIndex: 200 }}
        onClick={onClose}
      />
      <div className="cmdpal">
        <div className="cmdinput">
          <Search size={16} style={{ color: 'var(--ink3)', flexShrink: 0 }} aria-hidden="true" />
          <input
            // autoFocus is correct here: the palette exists to receive typing,
            // and it only mounts in response to the user opening it.
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0) }}
            onKeyDown={onKeyDown}
            placeholder="Buscar empleados, páginas…"
            aria-label="Buscar empleados o páginas"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
          />
          <span className="kbd" style={{ flexShrink: 0 }} aria-hidden="true">Esc</span>
        </div>

        <div className="cmdlist" id={listId} role="listbox" aria-label="Resultados">
          {empResults.length > 0 && (
            <>
              <div className="cmdgrp">Personas</div>
              {empResults.map((r, i) => r.kind === 'emp' && (
                <button
                  key={r.id}
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={active === i}
                  tabIndex={-1}
                  className={`cmditem${active === i ? ' on' : ''}`}
                  onClick={() => go(r)}
                  onMouseEnter={() => setActive(i)}
                >
                  <Avatar name={r.name} size={26} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{r.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{r.role} · {r.dept}</div>
                  </div>
                  <ArrowRight size={13} style={{ marginLeft: 'auto', color: 'var(--ink3)', flexShrink: 0 }} />
                </button>
              ))}
            </>
          )}

          {pageResults.length > 0 && (
            <>
              <div className="cmdgrp">Páginas</div>
              {pageResults.map((r, i) => r.kind === 'page' && (
                <button
                  key={r.key}
                  id={`${listId}-opt-${empResults.length + i}`}
                  role="option"
                  aria-selected={active === empResults.length + i}
                  tabIndex={-1}
                  className={`cmditem${active === empResults.length + i ? ' on' : ''}`}
                  onClick={() => go(r)}
                  onMouseEnter={() => setActive(empResults.length + i)}
                >
                  <div className="cmdico">{ICON_MAP[r.icon]}</div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{r.label}</span>
                  <ArrowRight size={13} style={{ marginLeft: 'auto', color: 'var(--ink3)', flexShrink: 0 }} />
                </button>
              ))}
            </>
          )}

          {results.length === 0 && (
            <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>
              Sin resultados para &ldquo;{q}&rdquo;
            </div>
          )}
        </div>

        <div className="cmdfooter">
          <span><kbd>↑↓</kbd> navegar</span>
          <span><kbd>↵</kbd> abrir</span>
          <span><kbd>Esc</kbd> cerrar</span>
        </div>
      </div>
    </div>
  )
}
