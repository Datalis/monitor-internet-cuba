'use client';

import { useEffect, useState, lazy, Suspense } from 'react';

const Charts = lazy(() => import('./charts'));
const CubaSpeedMap = lazy(() => import('./cuba-map'));
import ShareButtons from '../components/share-buttons';

interface Metric {
  timestamp: string;
  metadata: { source: string; province_id: string | null };
  [key: string]: unknown;
}

interface CfAlert {
  alert_type: string;
  event_type: string;
  outage_cause?: string;
  outage_type?: string;
  description?: string;
  start_date: string;
  end_date?: string;
  status?: string;
  magnitude?: number;
  linked_url?: string;
}

interface OutageData {
  active_outages: number;
  active_cf_alerts: number;
  latest_ioda: { outage_score: number; outage_detected: boolean; timestamp: string } | null;
  latest_ripe: { bgp_prefix_count: number; bgp_visibility_pct: number; timestamp: string } | null;
  latest_cf_alert: CfAlert | null;
  cloudflare_alerts: CfAlert[];
  ioda: Metric[];
  ripe: Metric[];
}

const OUTAGE_CAUSE_ES: Record<string, string> = {
  POWER_OUTAGE: 'Apagon electrico',
  CABLE_CUT: 'Corte de cable',
  GOVERNMENT_ORDER: 'Orden gubernamental',
  TECHNICAL_FAILURE: 'Fallo tecnico',
  NATURAL_DISASTER: 'Desastre natural',
  MAINTENANCE: 'Mantenimiento',
  CYBER_ATTACK: 'Ciberataque',
  UNKNOWN: 'Causa desconocida',
};

const OUTAGE_TYPE_ES: Record<string, string> = {
  NATIONWIDE: 'Alcance nacional',
  REGIONAL: 'Alcance regional',
  LOCAL: 'Alcance local',
  MULTI_LOCATION: 'Multiples ubicaciones',
};

interface CfSummary {
  device_mobile_pct?: number;
  device_desktop_pct?: number;
  human_pct?: number;
  bot_pct?: number;
}

interface CrowdStats {
  avg_download: number | null;
  avg_upload: number | null;
  avg_latency: number | null;
  test_count: number;
}

interface SubScore { label: string; score: number; weight: number }

function computeBlockingIndex(
  outages: OutageData | null,
  traffic: Metric[],
  blocking: Metric[],
  mlab: Metric[],
  crowd: CrowdStats | null,
): { score: number; breakdown: SubScore[] } {
  const iodaRaw = outages?.latest_ioda?.outage_score ?? 0;
  const iodaScore = (1 - iodaRaw) * 100;

  const bgpRaw = outages?.latest_ripe?.bgp_visibility_pct ?? 1;
  const bgpScore = bgpRaw * 100;

  const recentTraffic = traffic.slice(0, 6);
  const trafficScore = recentTraffic.length > 0
    ? recentTraffic.reduce((sum, d) => sum + (d.traffic_score as number || 0), 0) / recentTraffic.length
    : 50;

  // OONI: 7-day average blocking rate (blocked + anomalies) instead of single day
  const ooniWithData = blocking.filter(d => (d.tests_count as number) > 0);
  const avgBlockingRate = ooniWithData.length > 0
    ? ooniWithData.reduce((sum, d) => sum + ((d.blocking_rate as number) || 0), 0) / ooniWithData.length
    : 0;
  const totalOoniTests = ooniWithData.reduce((sum, d) => sum + ((d.tests_count as number) || 0), 0);
  const totalConfirmed = ooniWithData.reduce((sum, d) => sum + ((d.confirmed_count as number) || 0), 0);
  const totalAnomalies = ooniWithData.reduce((sum, d) => sum + ((d.anomaly_count as number) || 0), 0);
  const confirmedAnomalyRate = totalOoniTests > 0
    ? (totalConfirmed + totalAnomalies) / totalOoniTests
    : 0;
  const combinedBlockingRate = avgBlockingRate * 0.6 + confirmedAnomalyRate * 0.4;
  const ooniScore = (1 - combinedBlockingRate) * 100;

  // Cuba vs World: compare speed and latency from mlab (global averages)
  const cubaDownload = mlab.length > 0
    ? mlab.map(s => s.download_speed_mbps as number).filter(Boolean).reduce((a, b, _, arr) => a + b / arr.length, 0)
    : null;
  const globalDownloads = mlab.filter(s => s.global_download_mbps);
  const globalDownload = globalDownloads.length > 0
    ? globalDownloads.map(s => s.global_download_mbps as number).reduce((a, b, _, arr) => a + b / arr.length, 0)
    : null;
  const cubaLatency = mlab.length > 0
    ? mlab.map(s => s.latency_ms as number).filter(Boolean).reduce((a, b, _, arr) => a + b / arr.length, 0)
    : null;
  const globalLatencies = mlab.filter(s => s.global_latency_ms);
  const globalLatency = globalLatencies.length > 0
    ? globalLatencies.map(s => s.global_latency_ms as number).reduce((a, b, _, arr) => a + b / arr.length, 0)
    : null;

  let cfComparisonScore = 50;
  if (cubaDownload != null && globalDownload != null && globalDownload > 0) {
    const speedRatio = Math.min(1, cubaDownload / globalDownload);
    const speedScore = speedRatio * 100;
    let latencyScore = 50;
    if (cubaLatency != null && globalLatency != null && cubaLatency > 0) {
      latencyScore = Math.max(0, Math.min(100, (globalLatency / cubaLatency) * 100));
    }
    cfComparisonScore = speedScore * 0.7 + latencyScore * 0.3;
  }

  // Crowdsourced speed quality score (0-100)
  let crowdScore = 50; // default when no data
  if (crowd && crowd.test_count > 0 && crowd.avg_download != null) {
    const speedScore = Math.min(100, (crowd.avg_download / 5) * 100);
    const latPenalty = crowd.avg_latency != null ? Math.min(20, Math.max(0, (crowd.avg_latency - 200) / 15)) : 0;
    crowdScore = Math.max(0, speedScore - latPenalty);
  }
  const hasCrowd = crowd != null && crowd.test_count > 0;

  // Cloudflare verified outage: if active, force traffic score to 0
  const hasCfOutage = (outages?.active_cf_alerts ?? 0) > 0;
  const cfOutageScore = hasCfOutage ? 0 : 100;

  // Weights: Cuba vs World and Cloudflare traffic dominate
  const wIoda = hasCfOutage ? 0.05 : hasCrowd ? 0.10 : 0.15;
  const wBgp = hasCfOutage ? 0.05 : hasCrowd ? 0.10 : 0.15;
  const wTraffic = hasCfOutage ? 0.10 : hasCrowd ? 0.20 : 0.30;
  const wOoni = hasCfOutage ? 0.05 : hasCrowd ? 0.05 : 0.10;
  const wCfComparison = hasCfOutage ? 0.15 : hasCrowd ? 0.25 : 0.30;
  const wCrowd = hasCrowd ? (hasCfOutage ? 0.10 : 0.30) : 0;
  const wCfOutage = hasCfOutage ? 0.50 : 0;

  let composite = iodaScore * wIoda + bgpScore * wBgp + trafficScore * wTraffic
    + ooniScore * wOoni + cfComparisonScore * wCfComparison
    + crowdScore * wCrowd + cfOutageScore * wCfOutage;

  const dl = mlab[0]?.download_speed_mbps as number | undefined;
  const lat = mlab[0]?.latency_ms as number | undefined;
  let penalty = 0;
  if (dl != null && dl < 1) penalty += 3;
  if (lat != null && lat > 500) penalty += 2;
  composite = Math.max(0, Math.min(100, composite - penalty));

  const breakdown: SubScore[] = [];
  if (hasCfOutage) {
    breakdown.push({ label: 'Cloudflare (interrupción)', score: Math.round(cfOutageScore), weight: Math.round(wCfOutage * 100) });
  }
  breakdown.push(
    { label: 'Censura (OONI 7d)', score: Math.round(ooniScore), weight: Math.round(wOoni * 100) },
    { label: 'Tráfico vs Mundo', score: Math.round(cfComparisonScore), weight: Math.round(wCfComparison * 100) },
    { label: 'Tráfico (Cloudflare)', score: Math.round(trafficScore), weight: Math.round(wTraffic * 100) },
    { label: 'IODA (interrupciones)', score: Math.round(iodaScore), weight: Math.round(wIoda * 100) },
    { label: 'BGP (visibilidad)', score: Math.round(bgpScore), weight: Math.round(wBgp * 100) },
  );
  if (hasCrowd) {
    breakdown.push({ label: 'Velocidad (usuarios)', score: Math.round(crowdScore), weight: Math.round(wCrowd * 100) });
  }

  return { score: Math.round(composite), breakdown };
}

export default function Dashboard() {
  const [outages, setOutages] = useState<OutageData | null>(null);
  const [blocking, setBlocking] = useState<Metric[]>([]);
  const [traffic, setTraffic] = useState<Metric[]>([]);
  const [cfSummary, setCfSummary] = useState<CfSummary | null>(null);
  const [mlab, setMlab] = useState<Metric[]>([]);
  const [crowdStats, setCrowdStats] = useState<CrowdStats | null>(null);
  const [crowdByProvince, setCrowdByProvince] = useState<{ province_id: string; avg_download: number; avg_upload: number; avg_latency: number; test_count: number }[]>([]);
  const [notes, setNotes] = useState<{ type: string; content: string; generated_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOutageInfo, setShowOutageInfo] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [outRes, blockRes, cfRes, summaryRes, mlabRes, crowdRes, notesRes] = await Promise.all([
          fetch('/api/outages?hours=48').then(r => r.json()),
          fetch('/api/blocking?days=7').then(r => r.json()),
          fetch('/api/metrics?source=cloudflare&hours=24').then(r => r.json()),
          fetch('/api/metrics?source=cloudflare-summary&hours=24&limit=1').then(r => r.json()),
          fetch('/api/metrics?source=mlab&hours=336').then(r => r.json()),
          fetch('/api/speedtest/stats?hours=168').then(r => r.json()).catch(() => null),
          fetch('/api/notes?limit=1').then(r => r.json()).catch(() => null),
        ]);
        setOutages(outRes);
        setBlocking(blockRes.data || []);
        setTraffic(cfRes.data || []);
        setMlab(mlabRes.data || []);
        if (summaryRes.data?.[0]) setCfSummary(summaryRes.data[0]);
        if (crowdRes?.summary) setCrowdStats(crowdRes.summary);
        if (crowdRes?.by_province) setCrowdByProvince(crowdRes.by_province);
        if (notesRes?.data) setNotes(notesRes.data);
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  function fmtSpeed(mbps: number | null | undefined): string {
    if (mbps == null) return 'N/A';
    if (mbps < 0.1) return `${Math.round(mbps * 1000)} Kbps`;
    return `${mbps.toFixed(1)} Mbps`;
  }

  const isOutage = outages?.latest_ioda?.outage_detected || false;
  const lowVisibility = (outages?.latest_ripe?.bgp_visibility_pct ?? 1) < 0.7;

  // Cloudflare traffic drop detection: average of last 6 readings below threshold
  const recentTrafficScores = traffic.slice(0, 6).map(d => d.traffic_score as number).filter(v => v != null);
  const avgRecentTraffic = recentTrafficScores.length > 0
    ? recentTrafficScores.reduce((a, b) => a + b, 0) / recentTrafficScores.length
    : 100;
  const trafficDrop = avgRecentTraffic < 29;

  // Cloudflare Radar verified outage/anomaly alerts
  const hasCfAlert = (outages?.active_cf_alerts ?? 0) > 0;
  const cfAlertIsOutage = outages?.latest_cf_alert?.alert_type === 'outage';

  const isAlert = isOutage || lowVisibility || trafficDrop || hasCfAlert;
  const statusColor = (isOutage || cfAlertIsOutage) ? '#ef4444' : (lowVisibility || trafficDrop || hasCfAlert) ? '#f59e0b' : '#22c55e';
  const statusText = (isOutage || cfAlertIsOutage) ? 'INTERRUPCIÓN DETECTADA' : (lowVisibility || trafficDrop || hasCfAlert) ? 'DEGRADADO' : 'OPERATIVO';
  const activeOutages = outages?.active_outages ?? 0;
  const outageTagColor = activeOutages >= 2 ? '#ef4444' : activeOutages >= 1 ? '#f59e0b' : '#94a3b8';

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px' }}>
      {!loading && isAlert && (() => {
        const isCritical = isOutage || cfAlertIsOutage;
        const alertColor = isCritical ? '#ef4444' : '#f59e0b';
        const cfAlert = outages?.latest_cf_alert;
        const cfStartTime = cfAlert?.start_date
          ? new Date(cfAlert.start_date).toLocaleString('es-CU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : null;

        return (
          <div style={{
            background: alertColor + '22',
            border: `2px solid ${alertColor}`,
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 20,
            animation: isCritical ? 'pulse-alert 2s ease-in-out infinite' : undefined,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 32 }}>{isCritical ? '\u{1F6A8}' : '\u26A0\uFE0F'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: alertColor }}>
                  {isOutage ? 'ALERTA: Interrupción de internet detectada en Cuba'
                    : cfAlertIsOutage ? 'ALERTA: Interrupción verificada por Cloudflare Radar'
                    : hasCfAlert ? 'ALERTA: Anomalia de trafico detectada por Cloudflare Radar'
                    : trafficDrop ? 'ALERTA: Caida de trafico HTTP detectada'
                    : 'ALERTA: Visibilidad BGP degradada'}
                </div>
                {/* Cloudflare alert description */}
                {hasCfAlert && cfAlert?.description && (
                  <div style={{ fontSize: 14, color: '#e2e8f0', marginTop: 6, fontWeight: 500 }}>
                    {cfAlert.description}
                  </div>
                )}
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                  {isOutage
                    ? `IODA ha detectado una interrupcion activa. Score: ${outages?.latest_ioda?.outage_score?.toFixed(3) ?? 'N/A'}`
                    : hasCfAlert && cfAlert
                    ? `${cfAlert.outage_cause ? `Causa: ${OUTAGE_CAUSE_ES[cfAlert.outage_cause] || cfAlert.outage_cause}` : cfAlert.event_type || 'Alerta activa'}${cfAlert.outage_type ? ` — ${OUTAGE_TYPE_ES[cfAlert.outage_type] || cfAlert.outage_type}` : ''}${cfStartTime ? ` — Desde ${cfStartTime}` : ''}`
                    : trafficDrop
                    ? `El trafico HTTP desde Cuba cayo por debajo del umbral de alerta (25). Score promedio reciente: ${avgRecentTraffic.toFixed(1)}`
                    : `La visibilidad BGP de ETECSA (AS27725) esta por debajo del 70%: ${((outages?.latest_ripe?.bgp_visibility_pct ?? 0) * 100).toFixed(1)}%`}
                </div>
                <div style={{ marginTop: 10 }}>
                  <ShareButtons
                    compact
                    text={isOutage
                      ? `\u{1F6A8} Interrupción de internet detectada en Cuba. IODA score: ${outages?.latest_ioda?.outage_score?.toFixed(3) ?? 'N/A'}. Monitorea en tiempo real:`
                      : cfAlertIsOutage
                      ? `\u{1F6A8} Interrupción verificada por Cloudflare Radar en Cuba${cfAlert?.outage_cause ? ` (${OUTAGE_CAUSE_ES[cfAlert.outage_cause]?.toLowerCase() || cfAlert.outage_cause})` : ''}. Monitorea en tiempo real:`
                      : hasCfAlert
                      ? `\u26A0\uFE0F Anomalia de trafico detectada en Cuba por Cloudflare Radar. Monitorea en tiempo real:`
                      : trafficDrop
                      ? `\u26A0\uFE0F Caida de trafico HTTP detectada en Cuba. Score: ${avgRecentTraffic.toFixed(1)}. Monitorea en tiempo real:`
                      : `\u26A0\uFE0F Visibilidad BGP degradada en Cuba: ${((outages?.latest_ripe?.bgp_visibility_pct ?? 0) * 100).toFixed(1)}%. Monitorea en tiempo real:`
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      <style>{`
        @keyframes pulse-alert { 0%,100% { opacity: 1; } 50% { opacity: 0.7; } }
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px; }
        .grid-1-2 { display: grid; grid-template-columns: 1fr 2fr; gap: 16px; margin-bottom: 16px; }
        .grid-rest { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 16px; }
        @media (max-width: 768px) {
          .grid-3, .grid-1-2, .grid-rest { grid-template-columns: 1fr; }
          .dash-header { flex-direction: column; align-items: flex-start !important; gap: 8px; }
        }
      `}</style>

      <header className="dash-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Cuba Internet Monitor</h1>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 14 }}>Monitoreo H24 del estado de internet en Cuba</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            padding: '8px 16px', borderRadius: 8,
            background: statusColor + '22', color: statusColor,
            fontWeight: 700, fontSize: 14,
          }}>
            {loading ? 'CARGANDO...' : statusText}
          </div>
          {!loading && (
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setShowOutageInfo(v => !v)}
                style={{
                  padding: '8px 12px', borderRadius: 8,
                  background: activeOutages > 0 ? outageTagColor + '22' : '#1e293b',
                  color: activeOutages > 0 ? outageTagColor : '#94a3b8',
                  fontSize: 13, cursor: 'pointer',
                  fontWeight: activeOutages > 0 ? 600 : 400,
                  userSelect: 'none',
                }}
              >
                <span style={{ fontWeight: 700 }}>{activeOutages}</span> {activeOutages === 1 ? 'INTERRUPCION' : 'INTERRUPCIONES'}
              </div>
              {showOutageInfo && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 8,
                  background: '#0f172a', border: '1px solid #334155', borderRadius: 10,
                  padding: '12px 16px', width: 280, zIndex: 50,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>
                    {activeOutages} {activeOutages === 1 ? 'interrupción detectada' : 'interrupciones detectadas'}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                    Cantidad de apagones de internet detectados en Cuba en las últimas 48 horas.
                  </div>
                  <div
                    onClick={() => setShowOutageInfo(false)}
                    style={{ fontSize: 11, color: '#64748b', marginTop: 8, cursor: 'pointer', textAlign: 'right' }}
                  >
                    Cerrar
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {loading ? (
        <p style={{ textAlign: 'center', padding: 40 }}>Cargando datos...</p>
      ) : (
        <>
          {/* Fila 1: Grafica de trafico principal */}
          <Suspense fallback={<p>Cargando graficos...</p>}>
            <Charts blocking={blocking} traffic={traffic} outages={outages} mlab={mlab} section="traffic" />
          </Suspense>

          {/* Fila 2: Datos de Cloudflare/infraestructura */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 16 }}>
            <ComparisonCard
              label="Descarga (Cloudflare)"
              cubaValue={mlab[0]?.download_speed_mbps as number | undefined}
              globalValue={mlab[0]?.global_download_mbps as number | undefined}
              unit="Mbps"
              hint="Velocidad promedio de descarga medida por Cloudflare Radar (speed.cloudflare.com). Cuba vs promedio global."
              lowerIsBetter={false}
            />
            <ComparisonCard
              label="Latencia (Cloudflare)"
              cubaValue={mlab[0]?.latency_ms as number | undefined}
              globalValue={mlab[0]?.global_latency_ms as number | undefined}
              unit="ms"
              decimals={0}
              hint="Latencia promedio medida por Cloudflare Radar. Cuba vs promedio global. Menor es mejor."
              lowerIsBetter={true}
            />
          </div>

          {/* Fila 3: Crowdsourced speed test stats */}
          <div className="grid-3">
            <StatCard label="Descarga (usuarios)" value={fmtSpeed(crowdStats?.avg_download)} sub="Promedio crowdsourced" hint="Velocidad promedio de descarga reportada por usuarios que hicieron el test desde Cuba en los ultimos 7 dias." />
            <StatCard label="Subida (usuarios)" value={fmtSpeed(crowdStats?.avg_upload)} sub="Promedio crowdsourced" hint="Velocidad promedio de subida reportada por usuarios que hicieron el test desde Cuba en los ultimos 7 dias." />
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Tests esta semana</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{crowdStats?.test_count ?? 0}</div>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>Contribuciones de usuarios</div>
              </div>
              <a href="/speedtest" style={{
                display: 'block', marginTop: 12, padding: '10px 0', borderRadius: 8,
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                color: 'white', fontSize: 14, fontWeight: 700,
                textAlign: 'center', textDecoration: 'none',
                boxShadow: '0 0 16px rgba(59,130,246,0.4)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
                onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 0 24px rgba(59,130,246,0.6)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(59,130,246,0.4)'; }}
              >
                &#x1F680; Haz tu propio test &rarr;
              </a>
            </div>
          </div>

          {/* Mapa de velocidad por provincia */}
          <div style={{ marginBottom: 16 }}>
            <Suspense fallback={<p>Cargando mapa...</p>}>
              <CubaSpeedMap data={crowdByProvince} />
            </Suspense>
          </div>

          {/* Fila 4: Indice de Apertura + OONI */}
          <div className="grid-1-2">
            <BlockingIndexGauge {...computeBlockingIndex(outages, traffic, blocking, mlab, crowdStats)} />
            <Suspense fallback={<p>Cargando graficos...</p>}>
              <Charts blocking={blocking} traffic={traffic} outages={outages} mlab={mlab} section="ooni" />
            </Suspense>
          </div>

          {/* Fila 5: barras laterales + widgets tecnicos */}
          <div className="grid-3">
            <MiniBarCard label="Movil vs Desktop" a={cfSummary?.device_mobile_pct} b={cfSummary?.device_desktop_pct} aLabel="Movil" bLabel="Desktop" aColor="#3b82f6" bColor="#64748b" hint="Porcentaje del trafico web cubano que viene de telefonos vs computadoras, segun Cloudflare Radar." />
            <MiniBarCard label="Humano vs Bot" a={cfSummary?.human_pct} b={cfSummary?.bot_pct} aLabel="Humano" bLabel="Bot" aColor="#22c55e" bColor="#ef4444" hint="Porcentaje de trafico generado por personas reales vs bots automatizados, segun Cloudflare Radar." />
            <StatCard label="Visibilidad BGP" value={outages?.latest_ripe?.bgp_visibility_pct != null ? `${(outages.latest_ripe.bgp_visibility_pct * 100).toFixed(1)}%` : 'N/A'} sub="AS27725 (ETECSA)" hint="Que tan visible es la red de ETECSA para el resto de internet. Menos de 70% indica problemas serios de conectividad." />
          </div>

          {/* Resto de graficas */}
          <Suspense fallback={<p>Cargando graficos...</p>}>
            <Charts blocking={blocking} traffic={traffic} outages={outages} mlab={mlab} section="rest" />
          </Suspense>

          {/* Notas de IA */}
          {notes.length > 0 && (
            <div style={{ background: '#1e293b', borderRadius: 12, padding: '20px 24px', marginTop: 24 }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: 16, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>&#x1F4DD;</span> Notas sobre el estado de internet
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {notes.map((note, i) => (
                  <div key={i} style={{
                    background: '#0f172a', borderRadius: 10, padding: '16px 20px',
                    borderLeft: `3px solid ${note.type === 'outage' ? '#ef4444' : '#3b82f6'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        color: note.type === 'outage' ? '#ef4444' : '#3b82f6',
                        background: (note.type === 'outage' ? '#ef4444' : '#3b82f6') + '18',
                        padding: '2px 8px', borderRadius: 4,
                      }}>
                        {note.type === 'outage' ? 'ALERTA' : 'RESUMEN SEMANAL'}
                      </span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>
                        {new Date(note.generated_at).toLocaleString('es-CU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {note.content}
                    </div>
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #1e293b' }}>
                      <ShareButtons
                        compact
                        text={note.content.split('\n')[0] || 'Estado de internet en Cuba'}
                        url="https://internet.cubapk.com/dashboard"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Acerca de los datos</h2>
            <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.8 }}>
              <p style={{ marginBottom: 12 }}>Este panel recopila datos de multiples fuentes independientes para ofrecer una vista integral del estado de internet en Cuba:</p>
              <ul style={{ paddingLeft: 20, margin: 0 }}>
                <li><strong style={{ color: '#cbd5e1' }}>Cloudflare Radar</strong> — Volumen relativo de trafico HTTP desde Cuba (0-100). Un score bajo indica que hay menos trafico de lo normal, posible senal de interrupcion.</li>
                <li><strong style={{ color: '#cbd5e1' }}>RIPE Stat (BGP)</strong> — Mide cuantas redes en el mundo pueden &quot;ver&quot; las IPs de ETECSA (AS27725). Si la visibilidad cae, Cuba se esta desconectando del internet global.</li>
                <li><strong style={{ color: '#cbd5e1' }}>IODA (Georgia Tech)</strong> — Combina datos de BGP, traceroutes y DNS para detectar apagones de internet a nivel de pais. El score va de 0 (normal) a 1 (apagon total).</li>
                <li><strong style={{ color: '#cbd5e1' }}>OONI</strong> — Tests de conectividad web ejecutados por voluntarios dentro de Cuba. Detectan si sitios especificos estan bloqueados o censurados.</li>
                <li><strong style={{ color: '#cbd5e1' }}>Test de Velocidad</strong> — Datos crowdsourced de usuarios que ejecutan nuestro <a href="/speedtest" style={{ color: '#3b82f6' }}>test de velocidad</a> desde Cuba. Mide descarga, subida y latencia real.</li>
              </ul>
            </div>
          </div>

          {/* Footer: proyecto de CubaPK y elToque */}
          <footer style={{
            marginTop: 40,
            borderTop: '1px solid #1e293b',
            paddingTop: 32,
            paddingBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}>
            <div style={{ color: '#64748b', fontSize: 13 }}>Un proyecto de</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
              <a href="https://cubapk.com" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#e2e8f0' }}>
                <img src="/logo-cubapk.png" alt="CubaPK" style={{ height: 40, width: 40 }} />
                <span style={{ fontSize: 16, fontWeight: 600 }}>CubaPK</span>
              </a>
              <a href="https://eltoque.com" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#e2e8f0' }}>
                <img src="/logo-eltoque.png" alt="elToque" style={{ height: 32 }} />
              </a>
            </div>
            <div style={{ color: '#475569', fontSize: 11, marginTop: 8, textAlign: 'center', maxWidth: 500, lineHeight: 1.6 }}>
              Datos recopilados de fuentes publicas (Cloudflare Radar, RIPE, IODA, OONI) y contribuciones de usuarios desde Cuba.
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, hint }: { label: string; value: string; sub: string; hint?: string }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 12, padding: 16 }} title={hint}>
      <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>{sub}</div>
      {hint && <div style={{ color: '#475569', fontSize: 11, marginTop: 8, lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
}

function ComparisonCard({ label, cubaValue, globalValue, unit, decimals, hint, lowerIsBetter }: {
  label: string; cubaValue?: number; globalValue?: number; unit: string; decimals?: number; hint?: string; lowerIsBetter: boolean;
}) {
  const dec = decimals ?? 1;
  const cubaStr = cubaValue != null ? `${cubaValue.toFixed(dec)} ${unit}` : 'N/A';
  const globalStr = globalValue != null ? `${globalValue.toFixed(dec)} ${unit}` : 'N/A';

  let ratio: number | null = null;
  let ratioColor = '#64748b';
  let ratioLabel = '';
  if (cubaValue != null && globalValue != null && globalValue > 0) {
    ratio = cubaValue / globalValue;
    const better = lowerIsBetter ? ratio < 1 : ratio > 1;
    const worse = lowerIsBetter ? ratio > 1 : ratio < 1;
    ratioColor = better ? '#22c55e' : worse ? '#ef4444' : '#f59e0b';
    const pct = Math.abs((ratio - 1) * 100);
    if (pct < 1) {
      ratioLabel = 'Similar al global';
    } else {
      ratioLabel = `${pct.toFixed(0)}% ${better ? 'mejor' : 'peor'} que el global`;
    }
  }

  return (
    <div style={{ background: '#1e293b', borderRadius: 12, padding: 16 }} title={hint}>
      <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>{cubaStr}</div>
        <div style={{ fontSize: 13, color: '#64748b' }}>Cuba</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <div style={{ fontSize: 14, color: '#94a3b8' }}>Global: {globalStr}</div>
        {ratioLabel && (
          <span style={{
            fontSize: 11, fontWeight: 600, color: ratioColor,
            background: ratioColor + '18', padding: '2px 8px', borderRadius: 4,
          }}>
            {ratioLabel}
          </span>
        )}
      </div>
      {hint && <div style={{ color: '#475569', fontSize: 11, marginTop: 8, lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
}

function BlockingIndexGauge({ score, breakdown }: { score: number; breakdown: SubScore[] }) {
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
  const statusLabel = score >= 70 ? 'OPERATIVO' : score >= 40 ? 'DEGRADADO' : 'BLOQUEADO';
  const radius = 70;
  const circumference = Math.PI * radius;
  const fillLength = (score / 100) * circumference;
  const shareText = `Internet en Cuba: ${score}/100 (${statusLabel === 'OPERATIVO' ? 'Operativo' : statusLabel === 'DEGRADADO' ? 'Degradado' : 'Bloqueado'})`;

  return (
    <div style={{ background: '#1e293b', borderRadius: 12, padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ color: '#94a3b8', fontSize: 12 }}>INDICE DE APERTURA DE INTERNET</div>
        <a href="/indice" style={{ color: '#3b82f6', fontSize: 11, textDecoration: 'none' }}>Ver mas &rarr;</a>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <svg width="180" height="105" viewBox="0 0 180 105">
          <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="#334155" strokeWidth="12" strokeLinecap="round" />
          <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${fillLength} ${circumference}`} />
          <text x="90" y="78" textAnchor="middle" fill="white" fontSize="36" fontWeight="700">{score}</text>
          <text x="90" y="98" textAnchor="middle" fill="#64748b" fontSize="11">de 100</text>
        </svg>
        <div style={{ color, fontWeight: 700, fontSize: 14, marginTop: 2 }}>{statusLabel}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {breakdown.map((sub) => {
          const barColor = sub.score >= 70 ? '#22c55e' : sub.score >= 40 ? '#f59e0b' : '#ef4444';
          return (
            <div key={sub.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>
                <span>{sub.label} ({sub.weight}%)</span>
                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{sub.score}</span>
              </div>
              <div style={{ height: 5, background: '#334155', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${sub.score}%`, height: '100%', borderRadius: 3, background: barColor }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12 }}>
        <ShareButtons text={shareText} url="https://internet.cubapk.com/indice" compact />
      </div>
    </div>
  );
}

function MiniBarCard({ label, a, b, aLabel, bLabel, aColor, bColor, hint }: {
  label: string; a?: number; b?: number; aLabel: string; bLabel: string; aColor: string; bColor: string; hint?: string;
}) {
  const hasData = a != null && b != null;

  return (
    <div style={{ background: '#1e293b', borderRadius: 12, padding: 16 }}>
      <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>{label}</div>
      {hasData ? (
        <div>
          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ width: `${a}%`, background: aColor }} />
            <div style={{ width: `${b}%`, background: bColor }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <div><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: aColor, marginRight: 6 }} /><span style={{ color: '#e2e8f0', fontWeight: 700 }}>{a.toFixed(1)}%</span> <span style={{ color: '#94a3b8' }}>{aLabel}</span></div>
            <div><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: bColor, marginRight: 6 }} /><span style={{ color: '#e2e8f0', fontWeight: 700 }}>{b.toFixed(1)}%</span> <span style={{ color: '#94a3b8' }}>{bLabel}</span></div>
          </div>
          {hint && <div style={{ color: '#475569', fontSize: 11, marginTop: 8, lineHeight: 1.4 }}>{hint}</div>}
        </div>
      ) : (
        <div style={{ fontSize: 28, fontWeight: 700 }}>N/A</div>
      )}
    </div>
  );
}
