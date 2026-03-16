import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const dl = searchParams.get('dl');
  const ul = searchParams.get('ul');
  const lat = searchParams.get('lat');
  const hasResults = dl && ul && lat;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          padding: '60px 80px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: '#e2e8f0',
            }}
          >
            Cuba Internet Monitor
          </div>
        </div>
        <div style={{ fontSize: 18, color: '#94a3b8', marginBottom: 48 }}>
          Test de Velocidad desde Cuba
        </div>

        {hasResults ? (
          <div style={{ display: 'flex', gap: 40, flex: 1, alignItems: 'center' }}>
            {/* Download */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: '#334155',
                borderRadius: 24,
                padding: '40px 48px',
                flex: 1,
              }}
            >
              <div style={{ fontSize: 16, color: '#94a3b8', marginBottom: 8 }}>Descarga</div>
              <div style={{ fontSize: 64, fontWeight: 700, color: '#3b82f6' }}>{dl}</div>
              <div style={{ fontSize: 20, color: '#64748b' }}>Mbps</div>
            </div>
            {/* Upload */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: '#334155',
                borderRadius: 24,
                padding: '40px 48px',
                flex: 1,
              }}
            >
              <div style={{ fontSize: 16, color: '#94a3b8', marginBottom: 8 }}>Subida</div>
              <div style={{ fontSize: 64, fontWeight: 700, color: '#8b5cf6' }}>{ul}</div>
              <div style={{ fontSize: 20, color: '#64748b' }}>Mbps</div>
            </div>
            {/* Latency */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: '#334155',
                borderRadius: 24,
                padding: '40px 48px',
                flex: 1,
              }}
            >
              <div style={{ fontSize: 16, color: '#94a3b8', marginBottom: 8 }}>Latencia</div>
              <div style={{ fontSize: 64, fontWeight: 700, color: '#22c55e' }}>{lat}</div>
              <div style={{ fontSize: 20, color: '#64748b' }}>ms</div>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              gap: 24,
            }}
          >
            <div style={{ fontSize: 48, fontWeight: 700, color: '#e2e8f0' }}>
              Mide tu velocidad
            </div>
            <div style={{ fontSize: 24, color: '#94a3b8' }}>
              Descarga, subida y latencia desde Cuba
            </div>
            <div
              style={{
                marginTop: 16,
                padding: '16px 48px',
                borderRadius: 16,
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                color: 'white',
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              Iniciar test
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 40,
          }}
        >
          <div style={{ fontSize: 16, color: '#475569' }}>internet.cubapk.com/speedtest</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 14, color: '#475569' }}>Un proyecto de CubaPK y elToque</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
