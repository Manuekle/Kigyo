import type { Metadata, Viewport } from 'next'
import { Geist_Mono } from 'next/font/google'
import './globals.css'

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
})

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://whitebox.com'

export const viewport: Viewport = {
  themeColor: '#e5484d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    template: '%s | Kigyo',
    default: 'Kigyo — People Operating System',
  },
  description:
    'People Operating System para equipos modernos. Gestión de personas, nómina, documentos, vacaciones y más. Simplifica la administración de tu empresa.',
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
    'Kigyo',
  ],
  authors: [{ name: 'Kigyo', url: BASE_URL }],
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
      'People Operating System para equipos modernos. Gestión de personas, nómina, documentos, vacaciones y más.',
    url: BASE_URL,
    locale: 'es_MX',
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
      'People Operating System para equipos modernos. Gestión de personas, nómina, documentos, vacaciones y más.',
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
    canonical: BASE_URL,
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
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'MXN',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={geistMono.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="nrh" suppressHydrationWarning>{children}</body>
    </html>
  )
}
