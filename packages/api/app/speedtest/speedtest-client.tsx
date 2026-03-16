'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import ShareButtons from '../components/share-buttons';

const PROVINCES = [
  { id: 'PRI', name: 'Pinar del Rio' }, { id: 'ART', name: 'Artemisa' },
  { id: 'HAB', name: 'La Habana' }, { id: 'MAY', name: 'Mayabeque' },
  { id: 'MAT', name: 'Matanzas' }, { id: 'CFG', name: 'Cienfuegos' },
  { id: 'VCL', name: 'Villa Clara' }, { id: 'SSP', name: 'Sancti Spiritus' },
  { id: 'CAV', name: 'Ciego de Avila' }, { id: 'CMG', name: 'Camaguey' },
  { id: 'LTU', name: 'Las Tunas' }, { id: 'HOL', name: 'Holguin' },
  { id: 'GRA', name: 'Granma' }, { id: 'SCU', name: 'Santiago de Cuba' },
  { id: 'GTM', name: 'Guantanamo' }, { id: 'IJV', name: 'Isla de la Juventud' },
];

type Phase = 'idle' | 'latency' | 'download' | 'upload' | 'submitting' | 'complete' | 'error';

interface TestResult {
  download_mbps: number;
  upload_mbps: number;
  latency_ms: number;
  jitter_ms: number;
}

const PHASE_LABELS: Record<Phase, string> = {
  idle: '', latency: 'Midiendo latencia...', download: 'Midiendo descarga...',
  upload: 'Midiendo subida...', submitting: 'Guardando resultado...', complete: '', error: '',
};

// ——— Speed Test Algorithm ———

async function measureLatency(signal: AbortSignal): Promise<{ latency: number; jitter: number }> {
  const samples: number[] = [];
  for (let i = 0; i < 10; i++) {
    const t0 = performance.now();
    await fetch('/api/speedtest/ping', { cache: 'no-store', signal });
    const rtt = performance.now() - t0;
    if (i > 0) samples.push(rtt); // skip first (warmup)
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)] || 0;
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
  const jitter = Math.sqrt(samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length);
  return { latency: Math.round(median), jitter: Math.round(jitter) };
}

async function measureDownload(
  signal: AbortSignal,
  onProgress: (mbps: number) => void,
): Promise<number> {
  const sizes = [51200, 102400, 256000, 512000, 1048576]; // 50KB → 1MB (conservador para Cuba)
  const MAX_BYTES = 3 * 1024 * 1024; // 3MB tope total
  const samples: { bytes: number; ms: number }[] = [];
  const deadline = performance.now() + 8000;
  let sizeIdx = 0;
  let transferred = 0;

  while (performance.now() < deadline && transferred < MAX_BYTES && !signal.aborted) {
    const size = sizes[Math.min(sizeIdx, sizes.length - 1)];
    const t0 = performance.now();
    const res = await fetch(`/api/speedtest/download?size=${size}`, { cache: 'no-store', signal });
    await res.arrayBuffer();
    const elapsed = performance.now() - t0;
    samples.push({ bytes: size, ms: elapsed });
    transferred += size;

    const mbps = (size * 8) / (elapsed / 1000) / 1_000_000;
    onProgress(mbps);

    // Adaptive: only increase chunk size if this one completed in < 2s
    if (elapsed < 2000 && sizeIdx < sizes.length - 1) sizeIdx++;
    // If too slow, don't increase
    if (elapsed > 4000) break;
  }

  if (samples.length === 0) return 0;
  // Weighted average (larger samples are more accurate)
  const totalBytes = samples.reduce((s, d) => s + d.bytes, 0);
  const totalMs = samples.reduce((s, d) => s + d.ms, 0);
  return (totalBytes * 8) / (totalMs / 1000) / 1_000_000;
}

async function measureUpload(
  signal: AbortSignal,
  onProgress: (mbps: number) => void,
): Promise<number> {
  const sizes = [51200, 102400, 256000, 512000]; // 50KB → 512KB (conservador para Cuba)
  const MAX_BYTES = 2 * 1024 * 1024; // 2MB tope total
  const samples: { bytes: number; ms: number }[] = [];
  const deadline = performance.now() + 6000;
  let sizeIdx = 0;
  let transferred = 0;

  while (performance.now() < deadline && transferred < MAX_BYTES && !signal.aborted) {
    const size = sizes[Math.min(sizeIdx, sizes.length - 1)];
    const blob = new Uint8Array(size); // zeros are fine for upload measurement
    const t0 = performance.now();
    await fetch('/api/speedtest/upload', {
      method: 'POST', body: blob, signal,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    const elapsed = performance.now() - t0;
    samples.push({ bytes: size, ms: elapsed });
    transferred += size;

    const mbps = (size * 8) / (elapsed / 1000) / 1_000_000;
    onProgress(mbps);

    if (elapsed < 2000 && sizeIdx < sizes.length - 1) sizeIdx++;
    if (elapsed > 4000) break;
  }

  if (samples.length === 0) return 0;
  const totalBytes = samples.reduce((s, d) => s + d.bytes, 0);
  const totalMs = samples.reduce((s, d) => s + d.ms, 0);
  return (totalBytes * 8) / (totalMs / 1000) / 1_000_000;
}

// ——— Helpers ———

function formatSpeed(mbps: number): { value: string; unit: string } {
  if (mbps < 0.1) {
    return { value: Math.round(mbps * 1000).toString(), unit: 'Kbps' };
  }
  return { value: mbps.toFixed(1), unit: 'Mbps' };
}

// ——— Components ———

function SpeedGauge({ value, max, label, unit, color }: {
  value: number; max: number; label: string; unit: string; color: string;
}) {
  const radius = 70;
  const circumference = Math.PI * radius;
  const fillLength = Math.min(value / max, 1) * circumference;

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width="180" height="105" viewBox="0 0 180 105">
        <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="#334155" strokeWidth="12" strokeLinecap="round" />
        <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${fillLength} ${circumference}`}
          style={{ transition: 'stroke-dasharray 0.3s ease' }} />
        <text x="90" y="72" textAnchor="middle" fill="white" fontSize="32" fontWeight="700">
          {value > 0 ? value.toFixed(1) : '--'}
        </text>
        <text x="90" y="95" textAnchor="middle" fill="#64748b" fontSize="12">{unit}</text>
      </svg>
      <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function ResultCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 12, padding: 16, textAlign: 'center' }}>
      <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>{unit}</div>
    </div>
  );
}

// ——— Main Page ———

export default function SpeedTestClient() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [province, setProvince] = useState('');
  const [result, setResult] = useState<TestResult | null>(null);
  const [liveSpeed, setLiveSpeed] = useState(0);
  const [error, setError] = useState('');
  const [testStart, setTestStart] = useState(0);
  const [avg24h, setAvg24h] = useState<{ download: number; upload: number; latency: number; count: number } | null>(null);

  useEffect(() => {
    fetch('/api/speedtest/stats?hours=24')
      .then(r => r.json())
      .then(res => {
        if (res.summary?.test_count > 0) {
          setAvg24h({
            download: res.summary.avg_download,
            upload: res.summary.avg_upload,
            latency: res.summary.avg_latency,
            count: res.summary.test_count,
          });
        }
      })
      .catch(() => {});
  }, [phase]); // refetch after test completes

  const runTest = useCallback(async () => {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 30000);
    setResult(null);
    setError('');
    setLiveSpeed(0);
    const start = performance.now();
    setTestStart(start);

    let latency = 0;
    let jitter = 0;
    let download = 0;
    let upload = 0;
    let timedOut = false;

    try {
      // Phase 1: Latency
      setPhase('latency');
      const latResult = await measureLatency(ac.signal);
      latency = latResult.latency;
      jitter = latResult.jitter;

      // Phase 2: Download
      setPhase('download');
      download = await measureDownload(ac.signal, setLiveSpeed);

      // Phase 3: Upload
      setPhase('upload');
      setLiveSpeed(0);
      upload = await measureUpload(ac.signal, setLiveSpeed);
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        timedOut = true;
      } else {
        setError('Error durante el test. Intenta de nuevo.');
        console.error('[speedtest]', err);
        setPhase('error');
        clearTimeout(timeout);
        return;
      }
    }

    // Save whatever we managed to measure (even partial/timeout results)
    const testResult: TestResult = {
      download_mbps: Math.round(download * 100) / 100,
      upload_mbps: Math.round(upload * 100) / 100,
      latency_ms: latency,
      jitter_ms: jitter,
    };
    setResult(testResult);
    setLiveSpeed(0);

    // Submit partial or full result
    setPhase('submitting');
    try {
      const nav = navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number } };
      await fetch('/api/speedtest/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...testResult,
          province_id: province || null,
          user_agent: navigator.userAgent,
          connection_type: nav.connection?.effectiveType || null,
          connection_downlink: nav.connection?.downlink || null,
          screen_width: screen.width,
          screen_height: screen.height,
          test_duration_ms: Math.round(performance.now() - start),
          timed_out: timedOut,
        }),
      });
    } catch {
      // Submit failed, but we still show the result
    }

    if (timedOut) {
      setError('La conexion es muy lenta. Se guardaron los datos parciales.');
    }
    setPhase('complete');
    clearTimeout(timeout);
  }, [province, testStart]);

  const isRunning = phase !== 'idle' && phase !== 'complete' && phase !== 'error';
  const gaugeColor = phase === 'download' ? '#3b82f6' : phase === 'upload' ? '#8b5cf6' : '#22c55e';
  const gaugeMax = phase === 'upload' ? 20 : 50;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 16px' }}>
      <Link href="/dashboard" style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none' }}>
        &larr; Volver al dashboard
      </Link>

      <h1 style={{ fontSize: 22, margin: '16px 0 4px' }}>Test de Velocidad</h1>
      <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 24px' }}>
        Mide tu velocidad de internet desde Cuba. Los resultados se agregan de forma anonima para mejorar nuestras estadisticas.
      </p>

      {/* Province selector */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 6 }}>
          Provincia
        </label>
        <select
          value={province}
          onChange={e => setProvince(e.target.value)}
          disabled={isRunning}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8,
            border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0',
            fontSize: 14, outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="">Selecciona tu provincia</option>
          {PROVINCES.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Gauge area */}
      <div style={{
        background: '#1e293b', borderRadius: 16, padding: '32px 24px',
        textAlign: 'center', marginBottom: 24, minHeight: 200,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        {phase === 'idle' ? (
          <>
            <button
              onClick={runTest}
              disabled={!province}
              style={{
                width: 140, height: 140, borderRadius: '50%',
                background: province ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : '#334155',
                border: 'none', color: province ? 'white' : '#64748b', fontSize: 18, fontWeight: 700,
                cursor: province ? 'pointer' : 'not-allowed', transition: 'transform 0.2s',
                opacity: province ? 1 : 0.6,
              }}
              onMouseOver={e => { if (province) e.currentTarget.style.transform = 'scale(1.05)'; }}
              onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              INICIAR
            </button>
            {!province && (
              <div style={{ color: '#f59e0b', fontSize: 12, marginTop: 12 }}>
                Selecciona tu provincia para iniciar el test
              </div>
            )}
          </>
        ) : isRunning ? (
          <>
            <SpeedGauge
              value={liveSpeed}
              max={gaugeMax}
              label={phase === 'latency' ? 'Latencia' : phase === 'download' ? 'Descarga' : 'Subida'}
              unit={phase === 'latency' ? 'ms' : 'Mbps'}
              color={gaugeColor}
            />
            <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 12 }}>
              {PHASE_LABELS[phase]}
            </div>
          </>
        ) : phase === 'complete' && result ? (
          <div style={{ width: '100%' }}>
            <div style={{ color: error ? '#f59e0b' : '#22c55e', fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
              {error || 'Test completado'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <ResultCard label="Descarga" value={formatSpeed(result.download_mbps).value} unit={formatSpeed(result.download_mbps).unit} />
              <ResultCard label="Subida" value={formatSpeed(result.upload_mbps).value} unit={formatSpeed(result.upload_mbps).unit} />
              <ResultCard label="Latencia" value={result.latency_ms.toString()} unit="ms" />
            </div>
            {result.jitter_ms > 0 && (
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 12 }}>
                Jitter: {result.jitter_ms} ms
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <ShareButtons
                text={`Mi velocidad de internet en Cuba: \u2B07 ${formatSpeed(result.download_mbps).value} ${formatSpeed(result.download_mbps).unit} \u2B06 ${formatSpeed(result.upload_mbps).value} ${formatSpeed(result.upload_mbps).unit} | Latencia: ${result.latency_ms} ms. Prueba la tuya:`}
                url={`https://internet.cubapk.com/speedtest?dl=${formatSpeed(result.download_mbps).value}&ul=${formatSpeed(result.upload_mbps).value}&lat=${result.latency_ms}`}
              />
            </div>
            {avg24h && (
              <div style={{ marginTop: 16, padding: '12px 16px', background: '#0f172a', borderRadius: 10 }}>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 8 }}>
                  Promedio ultimas 24h ({avg24h.count} tests)
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: 12 }}>
                  <div><span style={{ color: '#94a3b8' }}>Descarga:</span> <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{formatSpeed(avg24h.download).value} {formatSpeed(avg24h.download).unit}</span></div>
                  <div><span style={{ color: '#94a3b8' }}>Subida:</span> <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{formatSpeed(avg24h.upload).value} {formatSpeed(avg24h.upload).unit}</span></div>
                  <div><span style={{ color: '#94a3b8' }}>Latencia:</span> <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{avg24h.latency.toFixed(0)} ms</span></div>
                </div>
              </div>
            )}
          </div>
        ) : phase === 'error' ? (
          <div style={{ color: '#ef4444', fontSize: 14 }}>{error}</div>
        ) : null}
      </div>

      {/* Action buttons */}
      {(phase === 'complete' || phase === 'error') && (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={() => { setPhase('idle'); setResult(null); setError(''); }}
            style={{
              padding: '10px 24px', borderRadius: 8, border: '1px solid #334155',
              background: '#1e293b', color: '#e2e8f0', fontSize: 14, cursor: 'pointer',
            }}
          >
            Volver a probar
          </button>
          <Link href="/dashboard" style={{
            padding: '10px 24px', borderRadius: 8, background: '#3b82f6',
            color: 'white', fontSize: 14, textDecoration: 'none',
          }}>
            Ver dashboard
          </Link>
        </div>
      )}

      {/* Info */}
      <div style={{ marginTop: 32, color: '#475569', fontSize: 12, lineHeight: 1.6 }}>
        <p>
          Este test mide la velocidad de tu conexion realizando descargas y subidas de datos contra nuestro servidor.
          Los resultados se guardan de forma anonima (sin tu IP) y se usan para generar estadisticas sobre la calidad
          de internet en Cuba.
        </p>
      </div>
    </div>
  );
}
