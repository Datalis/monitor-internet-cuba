import type { Metadata } from 'next';
import { getDb } from '../../lib/mongodb';
import IndiceClient from './indice-client';

const BASE_URL = 'https://internet.cubapk.com';

async function getIndexData() {
  const db = await getDb();
  const col = db.collection('metrics');
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [traffic, speed, outages, ooni, ripe, ioda, crowdTests] = await Promise.all([
    col.find({ 'metadata.source': 'cloudflare', timestamp: { $gte: since24h } })
      .sort({ timestamp: -1 }).limit(200).toArray(),
    col.find({ 'metadata.source': 'mlab', timestamp: { $gte: since7d } })
      .sort({ timestamp: -1 }).limit(14).toArray(),
    col.find({ 'metadata.source': 'cloudflare-alert', timestamp: { $gte: since7d } })
      .sort({ timestamp: -1 }).toArray(),
    col.find({ 'metadata.source': 'ooni', timestamp: { $gte: since7d } })
      .sort({ timestamp: -1 }).limit(30).toArray(),
    col.find({ 'metadata.source': 'ripe-stat', timestamp: { $gte: since24h } })
      .sort({ timestamp: -1 }).limit(50).toArray(),
    col.find({ 'metadata.source': 'ioda', timestamp: { $gte: since24h } })
      .sort({ timestamp: -1 }).limit(50).toArray(),
    col.find({ 'metadata.source': 'crowdsourced', timestamp: { $gte: since7d } })
      .sort({ timestamp: -1 }).toArray(),
  ]);

  function avg(arr: number[]) {
    if (!arr.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  // IODA
  const iodaScore = (1 - (ioda.length > 0 ? (ioda[0].outage_score as number) : 0)) * 100;

  // BGP
  const bgpScore = (ripe.length > 0 ? (ripe[0].bgp_visibility_pct as number) : 1) * 100;

  // Traffic
  const recentTraffic = traffic.slice(0, 6);
  const trafficScore = recentTraffic.length > 0
    ? recentTraffic.reduce((sum, d) => sum + ((d.traffic_score as number) || 0), 0) / recentTraffic.length
    : 50;

  // OONI 7d
  const ooniWithData = ooni.filter(d => (d.tests_count as number) > 0);
  const avgBlockingRate = ooniWithData.length > 0
    ? ooniWithData.reduce((sum, d) => sum + ((d.blocking_rate as number) || 0), 0) / ooniWithData.length
    : 0;
  const totalOoniTests = ooniWithData.reduce((sum, d) => sum + ((d.tests_count as number) || 0), 0);
  const totalConfirmed = ooniWithData.reduce((sum, d) => sum + ((d.confirmed_count as number) || 0), 0);
  const totalAnomalies = ooniWithData.reduce((sum, d) => sum + ((d.anomaly_count as number) || 0), 0);
  const confirmedAnomalyRate = totalOoniTests > 0 ? (totalConfirmed + totalAnomalies) / totalOoniTests : 0;
  const combinedBlockingRate = avgBlockingRate * 0.6 + confirmedAnomalyRate * 0.4;
  const ooniScore = (1 - combinedBlockingRate) * 100;

  // Cuba vs World (mlab)
  const cubaDownload = speed.length > 0 ? avg(speed.map(s => s.download_speed_mbps as number).filter(Boolean)) : null;
  const globalDownloads = speed.filter(s => s.global_download_mbps);
  const globalDownload = globalDownloads.length > 0 ? avg(globalDownloads.map(s => s.global_download_mbps as number)) : null;
  const cubaLatency = speed.length > 0 ? avg(speed.map(s => s.latency_ms as number).filter(Boolean)) : null;
  const globalLatencies = speed.filter(s => s.global_latency_ms);
  const globalLatency = globalLatencies.length > 0 ? avg(globalLatencies.map(s => s.global_latency_ms as number)) : null;

  let comparisonScore = 50;
  if (cubaDownload != null && globalDownload != null && globalDownload > 0) {
    const speedRatio = Math.min(1, cubaDownload / globalDownload);
    const speedScore = speedRatio * 100;
    let latScore = 50;
    if (cubaLatency != null && globalLatency != null && cubaLatency > 0) {
      latScore = Math.max(0, Math.min(100, (globalLatency / cubaLatency) * 100));
    }
    comparisonScore = speedScore * 0.7 + latScore * 0.3;
  }

  // Crowd
  const crowdAvg = crowdTests.length > 0 ? {
    download: avg(crowdTests.map(t => t.download_mbps as number).filter(Boolean)),
    latency: avg(crowdTests.map(t => t.latency_ms as number).filter(Boolean)),
  } : null;
  let crowdScore = 50;
  if (crowdTests.length > 0 && crowdAvg?.download != null) {
    const spdScore = Math.min(100, (crowdAvg.download / 5) * 100);
    const latPenalty = crowdAvg.latency != null ? Math.min(20, Math.max(0, (crowdAvg.latency - 200) / 15)) : 0;
    crowdScore = Math.max(0, spdScore - latPenalty);
  }
  const hasCrowd = crowdTests.length > 0;

  const hasCfOutage = outages.some(o => o.alert_type === 'outage' && !o.end_date);
  const cfOutageScore = hasCfOutage ? 0 : 100;

  // Weights
  const wIoda = hasCfOutage ? 0.05 : hasCrowd ? 0.10 : 0.15;
  const wBgp = hasCfOutage ? 0.05 : hasCrowd ? 0.10 : 0.15;
  const wTraffic = hasCfOutage ? 0.10 : hasCrowd ? 0.20 : 0.30;
  const wOoni = hasCfOutage ? 0.05 : hasCrowd ? 0.05 : 0.10;
  const wCfComparison = hasCfOutage ? 0.15 : hasCrowd ? 0.25 : 0.30;
  const wCrowd = hasCrowd ? (hasCfOutage ? 0.10 : 0.30) : 0;
  const wCfOutage = hasCfOutage ? 0.50 : 0;

  let composite = iodaScore * wIoda + bgpScore * wBgp + trafficScore * wTraffic
    + ooniScore * wOoni + comparisonScore * wCfComparison
    + crowdScore * wCrowd + cfOutageScore * wCfOutage;

  const dl = speed[0]?.download_speed_mbps as number | undefined;
  const lat = speed[0]?.latency_ms as number | undefined;
  let penalty = 0;
  if (dl != null && dl < 1) penalty += 3;
  if (lat != null && lat > 500) penalty += 2;
  composite = Math.max(0, Math.min(100, composite - penalty));

  const score = Math.round(composite);
  const status = score >= 70 ? 'OPERATIVO' : score >= 40 ? 'DEGRADADO' : 'BLOQUEADO';

  interface BreakdownItem { label: string; score: number; weight: number; description: string }
  const breakdown: BreakdownItem[] = [];
  if (hasCfOutage) {
    breakdown.push({ label: 'Cloudflare (interrupcion)', score: Math.round(cfOutageScore), weight: Math.round(wCfOutage * 100), description: 'Cloudflare ha detectado una interrupcion activa del servicio de internet en Cuba.' });
  }
  breakdown.push(
    { label: 'Cuba vs Mundo', score: Math.round(comparisonScore), weight: Math.round(wCfComparison * 100), description: `Comparacion de velocidad de descarga (${cubaDownload?.toFixed(1) ?? '?'} vs ${globalDownload?.toFixed(1) ?? '?'} Mbps global) y latencia (${cubaLatency?.toFixed(0) ?? '?'} vs ${globalLatency?.toFixed(0) ?? '?'} ms global). Fuente: Cloudflare Radar.` },
    { label: 'Trafico (Cloudflare)', score: Math.round(trafficScore), weight: Math.round(wTraffic * 100), description: 'Volumen de trafico HTTP normalizado medido por Cloudflare Radar para Cuba en las ultimas 24 horas.' },
    { label: 'IODA (interrupciones)', score: Math.round(iodaScore), weight: Math.round(wIoda * 100), description: 'Internet Outage Detection and Analysis (IODA) de Georgia Tech. Detecta interrupciones a gran escala mediante BGP, active probing y darknet.' },
    { label: 'BGP (visibilidad)', score: Math.round(bgpScore), weight: Math.round(wBgp * 100), description: 'Visibilidad de los prefijos BGP de ETECSA (AS27725) medida por RIPE Stat. Una caida indica problemas de enrutamiento.' },
    { label: 'Censura (OONI 7d)', score: Math.round(ooniScore), weight: Math.round(wOoni * 100), description: `Promedio de 7 dias de tests de OONI. ${totalOoniTests} tests realizados, ${totalAnomalies} anomalias y ${totalConfirmed} bloqueos confirmados.` },
  );
  if (hasCrowd) {
    breakdown.push({ label: 'Velocidad (usuarios)', score: Math.round(crowdScore), weight: Math.round(wCrowd * 100), description: 'Velocidad reportada por usuarios a traves del test de velocidad integrado.' });
  }

  return {
    score,
    status,
    breakdown,
    cubaDownload: cubaDownload?.toFixed(1) ?? null,
    globalDownload: globalDownload?.toFixed(1) ?? null,
    cubaLatency: cubaLatency?.toFixed(0) ?? null,
    globalLatency: globalLatency?.toFixed(0) ?? null,
    updatedAt: new Date().toISOString(),
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const data = await getIndexData();
  const ogParams = new URLSearchParams({
    score: String(data.score),
    status: data.status,
    ...(data.cubaDownload && { dl: data.cubaDownload }),
    ...(data.globalDownload && { gdl: data.globalDownload }),
    ...(data.cubaLatency && { lat: data.cubaLatency }),
    ...(data.globalLatency && { glat: data.globalLatency }),
  });
  const ogUrl = `${BASE_URL}/api/indice/og?${ogParams}`;
  const statusEs = data.status === 'OPERATIVO' ? 'Operativo' : data.status === 'DEGRADADO' ? 'Degradado' : 'Bloqueado';

  return {
    title: `Indice de Apertura: ${data.score}/100 (${statusEs}) — Cuba Internet Monitor`,
    description: `El internet en Cuba esta ${statusEs.toLowerCase()} con un indice de ${data.score}/100. Descarga: ${data.cubaDownload ?? '?'} Mbps (global: ${data.globalDownload ?? '?'}). Latencia: ${data.cubaLatency ?? '?'} ms (global: ${data.globalLatency ?? '?'}).`,
    openGraph: {
      title: `Internet en Cuba: ${data.score}/100 — ${statusEs}`,
      description: `Descarga: ${data.cubaDownload ?? '?'} Mbps vs ${data.globalDownload ?? '?'} global. Latencia: ${data.cubaLatency ?? '?'} ms vs ${data.globalLatency ?? '?'} global.`,
      url: `${BASE_URL}/indice`,
      siteName: 'Cuba Internet Monitor',
      locale: 'es_ES',
      type: 'website',
      images: [{ url: ogUrl, width: 1200, height: 630, alt: `Indice de Apertura de Internet en Cuba: ${data.score}/100` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Internet en Cuba: ${data.score}/100 — ${statusEs}`,
      description: `Descarga: ${data.cubaDownload ?? '?'} Mbps vs ${data.globalDownload ?? '?'} global. Latencia: ${data.cubaLatency ?? '?'} ms vs ${data.globalLatency ?? '?'} global.`,
      images: [ogUrl],
    },
  };
}

export const dynamic = 'force-dynamic'; // never pre-render, always fetch fresh data

export default async function IndicePage() {
  const data = await getIndexData();
  return <IndiceClient data={data} />;
}
