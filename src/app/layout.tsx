import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { THEME_INIT_SCRIPT, ThemeProvider } from '@/lib/context/ThemeContext'
import { lowestMonthlyUsd } from '@/lib/pricing'
import { SITE_URL } from '@/lib/site'
import './globals.css'

// Typography is declared in globals.css: Saans for display and Inter for text,
// both self-hosted from /public/fonts, plus the platform's own monospace for
// figures. No Google Fonts request.

export const viewport: Viewport = {
  // One entry per scheme so the browser chrome matches the rendered theme.
  // A single value would tint the address bar dark for a light-mode visitor.
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#161616' },
    { media: '(prefers-color-scheme: light)', color: '#F7F7F8' },
  ],
  width: 'device-width',
  initialScale: 1,
  // No maximumScale / userScalable. Capping zoom at 1 fails WCAG 1.4.4
  // (Resize Text) and blocks anyone who needs to pinch-zoom to read.
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: '%s | Kigyo',
    default: 'Kigyo — People Operating System',
  },
  description:
    'People Operating System para equipos modernos en Colombia. Nómina, prestaciones sociales, documentos, vacaciones y más. Simplifica la administración de tu empresa.',
  keywords: [
    'recursos humanos',
    'RRHH',
    'HR',
    'people ops',
    'people operating system',
    'gestión de personas',
    'nómina',
    'documentos laborales',
    'vacaciones',
    'administración de personal',
    // The terms someone actually searches for here — the generic ones above
    // compete with the whole Spanish-speaking web.
    'software de nómina Colombia',
    'RRHH Colombia',
    'prestaciones sociales',
    'cesantías',
    'prima de servicios',
    'seguridad social',
    'Kigyo',
  ],
  authors: [{ name: 'Kigyo', url: SITE_URL }],
  creator: 'Kigyo',
  publisher: 'Kigyo',
  applicationName: 'Kigyo — People Operating System',
  category: 'business',
  formatDetection: {
    email: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Kigyo',
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    siteName: 'Kigyo — People Operating System',
    title: 'Kigyo — People Operating System',
    description:
      'People Operating System para equipos modernos en Colombia. Nómina, prestaciones sociales, documentos, vacaciones y más.',
    url: SITE_URL,
    locale: 'es_CO',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Kigyo — People Operating System',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kigyo — People Operating System',
    description:
      'People Operating System para equipos modernos en Colombia. Nómina, prestaciones sociales, documentos, vacaciones y más.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Kigyo — People Operating System',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'People Operating System para equipos modernos. Gestión de personas, nómina, documentos, vacaciones y más.',
  /*
   * Decía `price: '0'`, o sea que Kigyo es gratis, mientras /pricing cobra
   * desde $80.000 al mes. Los datos estructurados los lee Google para los
   * resultados enriquecidos y los leen los rastreadores de IA, así que era una
   * afirmación falsa dicha exactamente donde más se propaga — la misma familia
   * que las cuatro del FAQ.
   *
   * `AggregateOffer` y no `Offer` porque hay tres planes y ninguno es «el»
   * precio; `lowPrice` es la respuesta correcta a «¿desde cuánto?». El número
   * sale de `lib/pricing.ts`, que es de donde salen también las tarjetas, así
   * que no pueden divergir.
   */
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: String(lowestMonthlyUsd()),
    priceCurrency: 'USD',
    offerCount: 3,
    // Derivada, no escrita: la copia a mano decía `kigyo.app` mientras el
    // dominio es `kigyo.pro`, y este bloque es JSON-LD — se lo comen los
    // buscadores y no se ve en pantalla, así que un TLD equivocado aquí puede
    // sobrevivir años. Mismo motivo por el que `lowPrice` se deriva de
    // lib/pricing en vez de repetir la cifra.
    url: `${SITE_URL}/pricing`,
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Minted per request in proxy.ts. Without it this inline script is blocked
  // by the Content-Security-Policy that the same proxy sets.
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    // `data-theme` is stamped by the script below before first paint, so the
    // server's dark default and the client's resolved theme differ on the
    // <html> element by design — hence suppressHydrationWarning here too.
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* Must stay the first script in <head> and stay synchronous: it sets
            the theme attribute before the browser paints, which is what keeps
            a light-mode visitor from seeing a dark flash on every load. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      {/* Mounted at the root, not just the dashboard, so a 'system' preference
          keeps following the OS on the marketing pages too. */}
      <body className="nrh" suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
