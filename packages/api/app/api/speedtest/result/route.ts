import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { createHash } from 'crypto';

const CUBA_PROVINCE_IDS = new Set([
  'PRI', 'ART', 'HAB', 'MAY', 'MAT', 'CFG', 'VCL', 'SSP',
  'CAV', 'CMG', 'LTU', 'HOL', 'GRA', 'SCU', 'GTM', 'IJV',
]);

// Simple in-memory rate limiter: 1 test per IP every 5 minutes
const recentTests = new Map<string, number>();
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [ip, ts] of recentTests) {
    if (ts < cutoff) recentTests.delete(ip);
  }
}, 10 * 60 * 1000);

function getClientIp(req: NextRequest): string {
  return req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

export async function POST(req: NextRequest) {
  // Re-verify Cuba origin server-side
  const country = req.headers.get('cf-ipcountry');
  if (process.env.NODE_ENV !== 'development' && country !== 'CU') {
    return NextResponse.json({ error: 'No disponible fuera de Cuba' }, { status: 403 });
  }

  const ip = getClientIp(req);

  // Rate limit check
  const lastTest = recentTests.get(ip);
  if (lastTest && Date.now() - lastTest < 5 * 60 * 1000) {
    const waitSecs = Math.ceil((5 * 60 * 1000 - (Date.now() - lastTest)) / 1000);
    return NextResponse.json(
      { error: `Espera ${waitSecs} segundos antes de repetir el test` },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { download_mbps, upload_mbps, latency_ms, jitter_ms, province_id,
    user_agent, connection_type, connection_downlink, screen_width, screen_height,
    test_duration_ms } = body as Record<string, unknown>;

  // Validate required fields
  if (typeof download_mbps !== 'number' || download_mbps < 0 ||
      typeof upload_mbps !== 'number' || upload_mbps < 0 ||
      typeof latency_ms !== 'number' || latency_ms < 0) {
    return NextResponse.json({ error: 'Campos invalidos' }, { status: 400 });
  }

  // Validate province
  const prov = typeof province_id === 'string' && CUBA_PROVINCE_IDS.has(province_id) ? province_id : null;

  // Hash IP for storage (privacy)
  const ipHash = createHash('sha256').update(ip + (process.env.IP_SALT || 'cuba-monitor')).digest('hex').slice(0, 16);

  const doc = {
    timestamp: new Date(),
    metadata: { source: 'crowdsourced' as const, province_id: prov, country: 'CU' as const },
    download_mbps: Math.round((download_mbps as number) * 100) / 100,
    upload_mbps: Math.round((upload_mbps as number) * 100) / 100,
    latency_ms: Math.round(latency_ms as number),
    jitter_ms: typeof jitter_ms === 'number' ? Math.round(jitter_ms) : null,
    user_agent: typeof user_agent === 'string' ? (user_agent as string).slice(0, 300) : null,
    connection_type: typeof connection_type === 'string' ? connection_type : null,
    connection_downlink: typeof connection_downlink === 'number' ? connection_downlink : null,
    screen_width: typeof screen_width === 'number' ? Math.round(screen_width as number) : null,
    screen_height: typeof screen_height === 'number' ? Math.round(screen_height as number) : null,
    test_duration_ms: typeof test_duration_ms === 'number' ? Math.round(test_duration_ms as number) : null,
    client_ip_hash: ipHash,
  };

  try {
    const db = await getDb();
    const result = await db.collection('metrics').insertOne(doc);
    recentTests.set(ip, Date.now());
    return NextResponse.json({ ok: true, id: result.insertedId });
  } catch (err) {
    console.error('[speedtest/result] Error:', err);
    return NextResponse.json({ error: 'Error al guardar resultado' }, { status: 500 });
  }
}
