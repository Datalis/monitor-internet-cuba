import type { Metadata } from 'next';
import SpeedTestClient from './speedtest-client';

const BASE = 'https://internet.cubapk.com';

interface Props {
  searchParams: Promise<{ dl?: string; ul?: string; lat?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const { dl, ul, lat } = params;
  const hasResults = dl && ul && lat;

  const title = hasResults
    ? `Velocidad en Cuba: ${dl} Mbps descarga, ${ul} Mbps subida, ${lat} ms — Cuba Internet Monitor`
    : 'Test de Velocidad — Cuba Internet Monitor';

  const description = hasResults
    ? `Resultado del test de velocidad desde Cuba: Descarga ${dl} Mbps, Subida ${ul} Mbps, Latencia ${lat} ms. Mide tu velocidad tambien.`
    : 'Mide tu velocidad de internet desde Cuba. Descarga, subida y latencia en tiempo real. Contribuye a las estadisticas de conectividad.';

  const ogImageUrl = hasResults
    ? `${BASE}/api/speedtest/og?dl=${dl}&ul=${ul}&lat=${lat}`
    : `${BASE}/api/speedtest/og`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE}/speedtest`,
      siteName: 'Cuba Internet Monitor',
      locale: 'es_ES',
      type: 'website',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default function SpeedTestPage() {
  return <SpeedTestClient />;
}
