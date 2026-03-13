import Link from 'next/link';

export default function SpeedTestBlocked() {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '80px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>&#x1F6AB;</div>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>No disponible</h1>
      <p style={{ color: '#94a3b8', fontSize: 15, marginBottom: 12, lineHeight: 1.6 }}>
        Este test de velocidad solo esta disponible para usuarios conectados desde Cuba.
      </p>
      <p style={{ color: '#f59e0b', fontSize: 14, marginBottom: 32, lineHeight: 1.6, background: '#1e293b', padding: '12px 16px', borderRadius: 8, display: 'inline-block', textAlign: 'left' }}>
        &#x26A0;&#xFE0F; Si estas en Cuba y usas una VPN, desconectala para poder acceder al test.
        Es necesario evaluar tu conexion real sin intermediarios para obtener resultados precisos.
      </p>
      <Link href="/dashboard" style={{
        display: 'inline-block', padding: '10px 24px', borderRadius: 8,
        background: '#1e293b', color: '#e2e8f0', textDecoration: 'none', fontSize: 14,
      }}>
        Ir al Dashboard
      </Link>
    </div>
  );
}
