'use client';

import ShareButtons from '../components/share-buttons';

interface BreakdownItem {
  label: string;
  score: number;
  weight: number;
  description: string;
}

interface IndexData {
  score: number;
  status: string;
  breakdown: BreakdownItem[];
  cubaDownload: string | null;
  globalDownload: string | null;
  cubaLatency: string | null;
  globalLatency: string | null;
  updatedAt: string;
}

export default function IndiceClient({ data }: { data: IndexData }) {
  const { score, status, breakdown, cubaDownload, globalDownload, cubaLatency, globalLatency, updatedAt } = data;
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
  const statusEs = status === 'OPERATIVO' ? 'Operativo' : status === 'DEGRADADO' ? 'Degradado' : 'Bloqueado';
  const radius = 90;
  const circumference = Math.PI * radius;
  const fillLength = (score / 100) * circumference;

  const shareText = `Internet en Cuba: ${score}/100 (${statusEs}). Descarga: ${cubaDownload ?? '?'} Mbps vs ${globalDownload ?? '?'} global.`;

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: '24px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <a href="/dashboard" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 14 }}>
            &larr; Volver al Dashboard
          </a>
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>Indice de Apertura de Internet</h1>
        <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 24px' }}>
          Medicion compuesta del estado del acceso a internet en Cuba. Actualizado cada 5 minutos.
        </p>

        {/* Gauge */}
        <div style={{ background: '#1e293b', borderRadius: 16, padding: '32px 24px', textAlign: 'center', marginBottom: 24 }}>
          <svg width="240" height="140" viewBox="0 0 240 140" style={{ display: 'block', margin: '0 auto' }}>
            <path d="M 30 120 A 90 90 0 0 1 210 120" fill="none" stroke="#334155" strokeWidth="14" strokeLinecap="round" />
            <path d="M 30 120 A 90 90 0 0 1 210 120" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
              strokeDasharray={`${fillLength} ${circumference}`} />
            <text x="120" y="100" textAnchor="middle" fill="white" fontSize="52" fontWeight="700">{score}</text>
            <text x="120" y="125" textAnchor="middle" fill="#64748b" fontSize="14">de 100</text>
          </svg>
          <div style={{ color, fontWeight: 700, fontSize: 22, marginTop: 8 }}>{statusEs.toUpperCase()}</div>
          <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>
            Actualizado: {new Date(updatedAt).toLocaleString('es-ES', { timeZone: 'America/Havana', dateStyle: 'medium', timeStyle: 'short' })}
          </div>

          {/* Share */}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
            <ShareButtons text={shareText} url="https://internet.cubapk.com/indice" />
          </div>
        </div>

        {/* Speed comparison */}
        {cubaDownload && globalDownload && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 20 }}>
              <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Descarga (Cuba)</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#3b82f6' }}>{cubaDownload} <span style={{ fontSize: 14, color: '#64748b' }}>Mbps</span></div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Global: {globalDownload} Mbps</div>
              {(() => {
                const pct = Math.round((1 - parseFloat(cubaDownload) / parseFloat(globalDownload)) * 100);
                return pct > 0 ? <span style={{ fontSize: 11, background: '#991b1b', color: '#fca5a5', padding: '2px 8px', borderRadius: 4, marginTop: 6, display: 'inline-block' }}>{pct}% peor que el global</span> : null;
              })()}
            </div>
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 20 }}>
              <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Latencia (Cuba)</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#f59e0b' }}>{cubaLatency} <span style={{ fontSize: 14, color: '#64748b' }}>ms</span></div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Global: {globalLatency} ms</div>
              {(() => {
                if (!cubaLatency || !globalLatency) return null;
                const pct = Math.round((parseFloat(cubaLatency) / parseFloat(globalLatency) - 1) * 100);
                return pct > 0 ? <span style={{ fontSize: 11, background: '#991b1b', color: '#fca5a5', padding: '2px 8px', borderRadius: 4, marginTop: 6, display: 'inline-block' }}>{pct}% peor que el global</span> : null;
              })()}
            </div>
          </div>
        )}

        {/* Breakdown */}
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px' }}>Desglose del indice</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {breakdown.map((item) => {
            const barColor = item.score >= 70 ? '#22c55e' : item.score >= 40 ? '#f59e0b' : '#ef4444';
            return (
              <div key={item.label} style={{ background: '#1e293b', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{item.label} <span style={{ color: '#64748b', fontWeight: 400 }}>({item.weight}%)</span></span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: barColor }}>{item.score}</span>
                </div>
                <div style={{ height: 6, background: '#334155', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ width: `${item.score}%`, height: '100%', borderRadius: 3, background: barColor, transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{item.description}</div>
              </div>
            );
          })}
        </div>

        {/* Methodology */}
        <div style={{ background: '#1e293b', borderRadius: 12, padding: '20px 24px', marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Metodologia</h2>
          <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
            <p style={{ margin: '0 0 10px' }}>
              El Indice de Apertura de Internet es una puntuacion compuesta de 0 a 100 que combina multiples fuentes de datos independientes
              para reflejar el estado real del acceso a internet en Cuba.
            </p>
            <p style={{ margin: '0 0 10px' }}>
              <strong style={{ color: '#e2e8f0' }}>Fuentes de datos:</strong> Cloudflare Radar (trafico HTTP y velocidad global),
              IODA de Georgia Tech (deteccion de interrupciones), RIPE Stat (visibilidad BGP de AS27725/ETECSA),
              y OONI (tests de censura y bloqueo de sitios web).
            </p>
            <p style={{ margin: '0 0 10px' }}>
              <strong style={{ color: '#e2e8f0' }}>Clasificacion:</strong>
            </p>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li><span style={{ color: '#22c55e', fontWeight: 600 }}>Operativo (70-100):</span> Internet funciona dentro de parametros normales para Cuba.</li>
              <li><span style={{ color: '#f59e0b', fontWeight: 600 }}>Degradado (40-69):</span> Se detectan problemas significativos de acceso, velocidad o censura.</li>
              <li><span style={{ color: '#ef4444', fontWeight: 600 }}>Bloqueado (0-39):</span> Interrupcion grave o bloqueo generalizado del servicio.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', color: '#475569', fontSize: 12, paddingBottom: 32 }}>
          <p>Un proyecto de <a href="https://cubapk.com" style={{ color: '#3b82f6', textDecoration: 'none' }}>CubaPK</a> y <a href="https://eltoque.com" style={{ color: '#3b82f6', textDecoration: 'none' }}>elToque</a></p>
        </div>
      </div>
    </div>
  );
}
