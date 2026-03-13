'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface OoniMeasurement {
  input: string;
  measurement_count: number;
  ok_count: number;
  confirmed_count: number;
  anomaly_count: number;
  failure_count: number;
}

export default function OoniDetailPage() {
  const { date } = useParams<{ date: string }>();
  const router = useRouter();
  const [data, setData] = useState<OoniMeasurement[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!date) return;
    fetch(`/api/ooni-detail?date=${date}`)
      .then(r => r.json())
      .then(res => setData(res.data || []))
      .catch(err => console.error('Failed to load OONI detail:', err))
      .finally(() => setLoading(false));
  }, [date]);

  const statusColor = (m: OoniMeasurement) => {
    if (m.confirmed_count > 0) return '#ef4444';
    if (m.anomaly_count > 0) return '#f59e0b';
    return '#22c55e';
  };

  const statusLabel = (m: OoniMeasurement) => {
    if (m.confirmed_count > 0) return 'Bloqueado';
    if (m.anomaly_count > 0) return 'Anomalia';
    return 'OK';
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>
      <button
        onClick={() => router.push('/dashboard')}
        style={{
          background: 'none', border: '1px solid #334155', borderRadius: 8,
          color: '#94a3b8', padding: '6px 14px', cursor: 'pointer', fontSize: 13, marginBottom: 16,
        }}
      >
        &larr; Volver al dashboard
      </button>

      <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>OONI Web Connectivity — {date}</h1>
      <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 20px' }}>
        Resultados individuales de tests de conectividad web ejecutados por voluntarios en Cuba.
      </p>

      {!loading && data.length > 0 && (
        <input
          type="text"
          placeholder="Buscar sitio..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #334155',
            background: '#1e293b', color: '#e2e8f0', fontSize: 14, marginBottom: 16,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      )}

      {loading ? (
        <p style={{ textAlign: 'center', padding: 40 }}>Cargando...</p>
      ) : data.length === 0 ? (
        <p style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>No hay datos para esta fecha.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.filter(m => !search || m.input.toLowerCase().includes(search.toLowerCase())).map((m, i) => (
            <div key={i} style={{
              background: '#1e293b', borderRadius: 10, padding: '12px 16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderLeft: `3px solid ${statusColor(m)}`,
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, wordBreak: 'break-all', color: '#e2e8f0' }}>{m.input}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  {m.measurement_count} tests — OK: {m.ok_count}, Anomaly: {m.anomaly_count}, Confirmed: {m.confirmed_count}, Failure: {m.failure_count}
                </div>
              </div>
              <div style={{
                marginLeft: 12, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                background: statusColor(m) + '22', color: statusColor(m), whiteSpace: 'nowrap',
              }}>
                {statusLabel(m)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
