'use client';

import { useRouter } from 'next/navigation';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
  BarChart, Bar, Legend,
} from 'recharts';

interface Metric {
  timestamp: string;
  metadata: { source: string };
  [key: string]: unknown;
}

interface OutageData {
  active_outages: number;
  latest_ioda: { outage_score: number; outage_detected: boolean; timestamp: string } | null;
  latest_ripe: { bgp_prefix_count: number; bgp_visibility_pct: number; timestamp: string } | null;
  ioda: Metric[];
  ripe: Metric[];
}

interface Props {
  blocking: Metric[];
  traffic: Metric[];
  outages: OutageData | null;
  mlab: Metric[];
  section?: 'traffic' | 'ooni' | 'rest';
}

const fmtTime = (ts: string) => new Date(ts).toLocaleString('es-CU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDay = (ts: string) => new Date(ts).toLocaleString('es-CU', { month: 'short', day: 'numeric' });

export default function Charts({ blocking, traffic, outages, mlab, section }: Props) {
  const router = useRouter();

  const blockingData = blocking.map(d => ({
    time: fmtDay(d.timestamp),
    date: d.timestamp.split('T')[0] || new Date(d.timestamp).toISOString().split('T')[0],
    ok: (d.ok_count as number) || 0,
    confirmed: (d.confirmed_count as number) || 0,
    anomaly: (d.anomaly_count as number) || 0,
    failure: (d.failure_count as number) || 0,
  }));

  const trafficData = traffic.map(d => ({
    time: fmtTime(d.timestamp),
    score: d.traffic_score as number,
  })).reverse();

  const iodaData = (outages?.ioda || []).map(d => ({
    time: fmtTime(d.timestamp),
    score: d.outage_score as number,
  })).reverse();

  const bgpData = (outages?.ripe || []).map(d => ({
    time: fmtTime(d.timestamp),
    visibility: ((d.bgp_visibility_pct as number) * 100),
    prefixes: d.bgp_prefix_count as number,
  })).reverse();

  const mlabData = mlab.map(d => ({
    time: fmtDay(d.timestamp),
    download: d.download_speed_mbps as number,
    latency: d.latency_ms as number,
  })).reverse();

  const chartStyle = { background: '#1e293b', borderRadius: 12, padding: '16px 8px 8px', marginBottom: 16 };

  if (section === 'traffic') {
    return (
      <div style={chartStyle}>
        <h3 style={{ margin: '0 0 4px 8px', fontSize: 14, color: '#94a3b8' }}>Trafico HTTP Cuba (Cloudflare Radar)</h3>
        <p style={{ margin: '0 0 12px 8px', fontSize: 11, color: '#475569' }}>Score relativo de trafico (0-100). Por debajo de 25 se considera anomalo.</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={trafficData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} domain={[0, 100]} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
            <Area type="monotone" dataKey="score" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} />
            <ReferenceLine y={25} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Umbral alerta', fill: '#ef4444', fontSize: 10 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (section === 'ooni') {
    return (
      <div style={{ ...chartStyle, marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 4px 8px', fontSize: 14, color: '#94a3b8' }}>Censura Web — Cuba (OONI, 15 dias)</h3>
        <p style={{ margin: '0 0 8px 8px', fontSize: 11, color: '#475569' }}>Tests de voluntarios dentro de Cuba. Haz click en una barra para ver detalles.</p>
        <div style={{ flex: 1, minHeight: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={blockingData} style={{ cursor: 'pointer' }} onClick={(state) => {
              if (state?.activePayload?.[0]?.payload?.date) {
                router.push(`/dashboard/ooni/${state.activePayload[0].payload.date}`);
              }
            }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="ok" stackId="a" fill="#22c55e" name="OK" />
              <Bar dataKey="confirmed" stackId="a" fill="#ef4444" name="Bloqueado" />
              <Bar dataKey="anomaly" stackId="a" fill="#f59e0b" name="Anomalia" />
              <Bar dataKey="failure" stackId="a" fill="#94a3b8" name="Fallo" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Velocidad y latencia */}
      {mlabData.length > 0 && (
        <div className="grid-rest">
          <div style={chartStyle}>
            <h3 style={{ margin: '0 0 4px 8px', fontSize: 14, color: '#94a3b8' }}>Velocidad de Descarga (Cloudflare Radar)</h3>
            <p style={{ margin: '0 0 12px 8px', fontSize: 11, color: '#475569' }}>Velocidad de descarga medida por speed.cloudflare.com desde Cuba.</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={mlabData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} unit=" Mbps" />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                <Line type="monotone" dataKey="download" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Descarga (Mbps)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={chartStyle}>
            <h3 style={{ margin: '0 0 4px 8px', fontSize: 14, color: '#94a3b8' }}>Latencia (Cloudflare Radar)</h3>
            <p style={{ margin: '0 0 12px 8px', fontSize: 11, color: '#475569' }}>Latencia promedio medida por speed.cloudflare.com desde Cuba.</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={mlabData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} unit=" ms" />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                <Line type="monotone" dataKey="latency" stroke="#ec4899" strokeWidth={2} dot={false} name="Latencia (ms)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tecnico — BGP e IODA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 16 }}>
        <div style={chartStyle}>
          <h3 style={{ margin: '0 0 4px 8px', fontSize: 14, color: '#94a3b8' }}>Visibilidad BGP AS27725</h3>
          <p style={{ margin: '0 0 12px 8px', fontSize: 11, color: '#475569' }}>Porcentaje de peers globales que ven las rutas de ETECSA. Linea amarilla = umbral de degradacion (70%).</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={bgpData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} domain={[0, 100]} unit="%" />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
              <Line type="monotone" dataKey="visibility" stroke="#22c55e" strokeWidth={2} dot={false} />
              <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={chartStyle}>
          <h3 style={{ margin: '0 0 4px 8px', fontSize: 14, color: '#94a3b8' }}>IODA Outage Score</h3>
          <p style={{ margin: '0 0 12px 8px', fontSize: 11, color: '#475569' }}>Indice compuesto de interrupcion (0=normal, 1=apagon total). Por encima de 0.5 se declara outage.</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={iodaData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} domain={[0, 1]} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
              <Line type="monotone" dataKey="score" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <ReferenceLine y={0.5} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Outage', fill: '#ef4444', fontSize: 10 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
