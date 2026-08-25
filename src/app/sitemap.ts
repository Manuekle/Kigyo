import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

const dashboardRoutes = [
  '/dashboard',
  '/dashboard/empleados',
  '/dashboard/nomina',
  '/dashboard/asistencia',
  '/dashboard/documentos',
  '/dashboard/calendario',
  '/dashboard/proyectos',
  '/dashboard/tickets',
  '/dashboard/consultoria',
  '/dashboard/canales',
  '/dashboard/trazabilidad',
  '/dashboard/compras',
  '/dashboard/cotizaciones',
  '/dashboard/ordenes-compra',
  '/dashboard/inventario',
  '/dashboard/tienda',
  '/dashboard/riesgos',
  '/dashboard/hseq',
  '/dashboard/catalogos',
  '/dashboard/firmas',
  '/dashboard/configuracion',
  '/dashboard/ia',
]

const publicRoutes = ['/about', '/pricing', '/faq', '/contact', '/terms', '/privacy']

export default function sitemap(): MetadataRoute.Sitemap {
  const landing = {
    url: SITE_URL,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 1,
  }

  const publicPages = publicRoutes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  const pages = dashboardRoutes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [landing, ...publicPages, ...pages]
}
