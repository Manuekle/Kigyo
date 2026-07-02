'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu } from '@/lib/icons'

const LINKS = [
  { href: '/#features', label: 'Producto' },
  { href: '/pricing', label: 'Precios' },
  { href: '/faq', label: 'FAQ' },
  { href: '/about', label: 'Nosotros' },
  { href: '/contact', label: 'Contacto' },
]

export default function PublicNav() {
  const [open, setOpen] = useState(false)

  return (
    <header className="pub-nav">
      <div className="pub-nav-inner">
        <Link href="/" className="pub-nav-brand" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="Kigyo" width={28} height={28} />
          <span>Kigyo</span>
        </Link>

        <nav className="pub-nav-links">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="pub-nav-actions">
          <Link href="/login" className="btn">
            Iniciar sesión
          </Link>
          <Link href="/login" className="btn pri">
            Comenzar
          </Link>
        </div>

        <button
          type="button"
          className="pub-nav-burger"
          aria-label="Abrir menú"
          onClick={() => setOpen((v) => !v)}
        >
          <Menu size={20} />
        </button>
      </div>

      {open && (
        <div className="pub-nav-mobile">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <div className="pub-nav-mobile-actions">
            <Link href="/login" className="btn" onClick={() => setOpen(false)}>
              Iniciar sesión
            </Link>
            <Link href="/login" className="btn pri" onClick={() => setOpen(false)}>
              Comenzar
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
