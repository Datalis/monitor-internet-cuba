import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

// Mismo orden que packages/etl/collectors/etecsa-nodes.js (oeste a este)
const NODES = [
  { id: 'lh', name: 'La Habana', province_id: 'HAB' },
  { id: 'sj', name: 'Mayabeque', province_id: 'MAY' },
  { id: 'lt', name: 'Las Tunas', province_id: 'LTU' },
];

export async function GET(req: NextRequest) {
  const hours = Math.min(parseInt(req.nextUrl.searchParams.get('hours') || '24') || 24, 720);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const db = await getDb();
  const docs = await db
    .collection('metrics')
    .find({ 'metadata.source': 'etecsa-node', timestamp: { $gte: since } })
    .sort({ timestamp: -1 })
    .toArray();

  const nodes = NODES.map(node => {
    const rows = docs.filter(d => d.metadata?.node === node.id);
    const latest = rows[0];
    const upRows = rows.filter(r => r.up);
    const latencies = upRows.map(r => r.latency_ms as number).filter(v => v != null);
    const lastDownload = rows.find(r => r.download_mbps != null);
    const downloads = rows.map(r => r.download_mbps as number).filter(v => v != null);
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    return {
      ...node,
      checks: rows.length,
      up: latest ? Boolean(latest.up) : null,
      last_check: latest?.timestamp ?? null,
      last_up: upRows[0]?.timestamp ?? null,
      latency_ms: latest?.latency_ms ?? null,
      uptime_pct: rows.length ? Math.round((upRows.length / rows.length) * 1000) / 10 : null,
      avg_latency_ms: latencies.length ? Math.round(avg(latencies)!) : null,
      download_mbps: lastDownload?.download_mbps ?? null,
      download_at: lastDownload?.timestamp ?? null,
      avg_download_mbps: downloads.length ? Math.round(avg(downloads)! * 10) / 10 : null,
    };
  });

  return NextResponse.json({ hours, nodes });
}
