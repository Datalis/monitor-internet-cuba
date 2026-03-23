import type { Metadata } from 'next';
import Script from 'next/script';

const GA_ID = 'G-TP9EGE805R';

export const metadata: Metadata = {
  title: 'Cuba Internet Monitor — Estado de internet en Cuba en tiempo real',
  description: 'Monitoreo H24 del estado de internet en Cuba. Velocidad, latencia, interrupciones, censura y visibilidad BGP. Un proyecto de CubaPK y elToque.',
  keywords: ['Cuba', 'internet', 'monitor', 'velocidad', 'ETECSA', 'interrupción', 'censura', 'BGP', 'OONI', 'speed test'],
  authors: [{ name: 'CubaPK', url: 'https://cubapk.com' }, { name: 'elToque', url: 'https://eltoque.com' }],
  openGraph: {
    title: 'Cuba Internet Monitor',
    description: 'Monitoreo en tiempo real del estado de internet en Cuba. Velocidad, interrupciones, censura y mas.',
    url: 'https://internet.cubapk.com',
    siteName: 'Cuba Internet Monitor',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: 'https://internet.cubapk.com/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Cuba Internet Monitor — Estado de internet en Cuba',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cuba Internet Monitor',
    description: 'Monitoreo en tiempo real del estado de internet en Cuba. Velocidad, interrupciones, censura y mas.',
    images: ['https://internet.cubapk.com/og-image.png'],
  },
  metadataBase: new URL('https://internet.cubapk.com'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/logo-cubapk.png" />
      </head>
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#0f172a', color: '#e2e8f0' }}>
        {children}
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}
