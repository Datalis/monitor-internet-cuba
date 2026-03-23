import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const score = parseInt(searchParams.get('score') || '0', 10);
  const status = searchParams.get('status') || 'DEGRADADO';
  const dl = searchParams.get('dl') || '';
  const globalDl = searchParams.get('gdl') || '';
  const latency = searchParams.get('lat') || '';
  const globalLat = searchParams.get('glat') || '';

  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
  const bgGradient = score >= 70
    ? 'linear-gradient(135deg, #0f172a 0%, #132218 100%)'
    : score >= 40
      ? 'linear-gradient(135deg, #0f172a 0%, #1a1a0e 100%)'
      : 'linear-gradient(135deg, #0f172a 0%, #1a0e0e 100%)';

  // Arc gauge math
  const radius = 120;
  const circumference = Math.PI * radius;
  const fillLength = (score / 100) * circumference;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: bgGradient,
          padding: '50px 70px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#e2e8f0' }}>
            Cuba Internet Monitor
          </div>
        </div>
        <div style={{ fontSize: 18, color: '#94a3b8', marginBottom: 32 }}>
          Indice de Apertura de Internet
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 60 }}>
          {/* Gauge */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <svg width="300" height="175" viewBox="0 0 300 175">
              <path d="M 30 150 A 120 120 0 0 1 270 150" fill="none" stroke="#334155" strokeWidth="20" strokeLinecap="round" />
              <path d="M 30 150 A 120 120 0 0 1 270 150" fill="none" stroke={color} strokeWidth="20" strokeLinecap="round"
                strokeDasharray={`${fillLength} ${circumference}`} />
              <text x="150" y="128" textAnchor="middle" fill="white" fontSize="72" fontWeight="700">{score}</text>
              <text x="150" y="158" textAnchor="middle" fill="#64748b" fontSize="18">de 100</text>
            </svg>
            <div style={{ color, fontWeight: 700, fontSize: 28, marginTop: 8 }}>{status}</div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
            {dl && globalDl && (
              <div style={{ display: 'flex', flexDirection: 'column', background: '#1e293b', borderRadius: 16, padding: '20px 28px' }}>
                <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 6 }}>Velocidad de descarga</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ fontSize: 42, fontWeight: 700, color: '#3b82f6' }}>{dl}</span>
                  <span style={{ fontSize: 18, color: '#64748b' }}>Mbps</span>
                </div>
                <div style={{ fontSize: 16, color: '#94a3b8', marginTop: 4 }}>
                  Global: {globalDl} Mbps
                </div>
              </div>
            )}
            {latency && globalLat && (
              <div style={{ display: 'flex', flexDirection: 'column', background: '#1e293b', borderRadius: 16, padding: '20px 28px' }}>
                <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 6 }}>Latencia</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ fontSize: 42, fontWeight: 700, color: '#f59e0b' }}>{latency}</span>
                  <span style={{ fontSize: 18, color: '#64748b' }}>ms</span>
                </div>
                <div style={{ fontSize: 16, color: '#94a3b8', marginTop: 4 }}>
                  Global: {globalLat} ms
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
          <div style={{ fontSize: 16, color: '#475569' }}>internet.cubapk.com/indice</div>
          <div style={{ fontSize: 14, color: '#475569' }}>Un proyecto de CubaPK y elToque</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
