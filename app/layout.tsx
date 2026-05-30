import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Müller Biegetechnik AG — Produktionskalender',
  description: 'Internes Planungstool für Müller Biegetechnik AG',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MB Kalender',
    startupImage: '/api/icon?size=512',
  },
};

export const viewport: Viewport = {
  themeColor: '#1e3a8a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        {/* iOS PWA Icons (verschiedene Gerätegrößen) */}
        <link rel="apple-touch-icon" href="/api/icon?size=180" />
        <link rel="apple-touch-icon" sizes="152x152" href="/api/icon?size=152" />
        <link rel="apple-touch-icon" sizes="167x167" href="/api/icon?size=167" />
        <link rel="apple-touch-icon" sizes="180x180" href="/api/icon?size=180" />
        {/* Favicon */}
        <link rel="icon" type="image/png" sizes="32x32" href="/api/icon?size=32" />
        <link rel="icon" type="image/png" sizes="16x16" href="/api/icon?size=16" />
        {/* Farbe für Browser-Chrome */}
        <meta name="msapplication-TileColor" content="#1e3a8a" />
        <meta name="msapplication-TileImage" content="/api/icon?size=144" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
