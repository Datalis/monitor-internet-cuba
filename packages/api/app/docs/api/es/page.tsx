import type { Metadata } from 'next';
import { ApiDocs, BASE, DICTS, PATHS } from '../content';

const t = DICTS.es;

export const metadata: Metadata = {
  title: t.htmlTitle,
  description: t.description,
  alternates: {
    canonical: `${BASE}${PATHS.es}`,
    languages: {
      en: `${BASE}${PATHS.en}`,
      es: `${BASE}${PATHS.es}`,
    },
  },
  openGraph: {
    title: t.htmlTitle,
    description: t.description,
    url: `${BASE}${PATHS.es}`,
    siteName: 'Cuba Internet Monitor',
    locale: 'es_ES',
    alternateLocale: ['en_US'],
    type: 'website',
    images: [{ url: `${BASE}/og-image.png`, width: 1200, height: 630, alt: 'Cuba Internet Monitor' }],
  },
  twitter: { card: 'summary_large_image' },
};

export default function ApiDocsPageEs() {
  return <ApiDocs lang="es" />;
}
