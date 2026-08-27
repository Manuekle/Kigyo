import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { canonicalRedirect } from './proxy'

/**
 * Un solo host para el navegador, sin bloquear a las máquinas.
 *
 * `kigyo.pro` y `www.kigyo.pro` contestaban las dos con 200 y la aplicación
 * entera. Como las cookies son host-only, eso son dos orígenes: iniciar sesión
 * bajo una grafía y llegar por la otra te deja fuera, y `kigyo_ctx` puede
 * apuntar a empresas distintas en cada una sin que nada lo diga.
 *
 * Las tres cosas que esta regla no puede hacer mal, porque cada una rompe algo
 * que solo se descubre en producción: mandar un 308 a un webhook que no sigue
 * redirecciones, rebotar los despliegues de vista previa a producción, y
 * dispararse en desarrollo.
 */

const APEX = 'https://kigyo.pro'
const WWW = 'https://www.kigyo.pro'

const ask = (url: string, site = APEX) =>
  canonicalRedirect(new NextRequest(new Request(url)), site)

describe('canonicalRedirect', () => {
  it('manda el alias al canónico, conservando ruta y query', () => {
    const target = ask('https://www.kigyo.pro/soluciones/salud?utm_source=x')
    expect(target?.toString()).toBe('https://kigyo.pro/soluciones/salud?utm_source=x')
  })

  it('deja en paz al canónico', () => {
    expect(ask('https://kigyo.pro/pricing')).toBeNull()
  })

  it('funciona al revés si el canónico es el www', () => {
    expect(ask('https://kigyo.pro/pricing', WWW)?.toString()).toBe('https://www.kigyo.pro/pricing')
    expect(ask('https://www.kigyo.pro/pricing', WWW)).toBeNull()
  })

  /**
   * El webhook de Polar está registrado contra `www`, y Polar NO sigue
   * redirecciones en POST: `billing_events` tuvo cero filas hasta que se
   * reapuntó el 2026-08-25. Un 308 aquí convierte cada aviso de pago en un
   * no-op silencioso.
   */
  it('no toca /api, que es donde llaman las máquinas', () => {
    expect(ask('https://www.kigyo.pro/api/billing/webhook')).toBeNull()
    expect(ask('https://www.kigyo.pro/api/wompi/webhook')).toBeNull()
    expect(ask('https://www.kigyo.pro/api/auth/confirm')).toBeNull()
  })

  /**
   * Una vista previa cuyo único objeto es diferir contestaría con producción.
   * Por eso la regla nombra un alias y no «todo lo que no sea el canónico».
   */
  it('no rebota los despliegues de vista previa ni ningún otro host', () => {
    expect(ask('https://kigyo-git-rama.vercel.app/dashboard')).toBeNull()
    expect(ask('https://kigyo.pro.evil.example/dashboard')).toBeNull()
    expect(ask('https://otrodominio.com/')).toBeNull()
  })

  it('nunca en desarrollo', () => {
    expect(ask('http://www.localhost:3000/', 'http://localhost:3000')).toBeNull()
    expect(ask('http://localhost:3000/', 'http://localhost:3000')).toBeNull()
  })

  it('aguanta un NEXT_PUBLIC_APP_URL inservible sin tumbar la petición', () => {
    expect(ask('https://www.kigyo.pro/', 'no-es-una-url')).toBeNull()
  })
})
