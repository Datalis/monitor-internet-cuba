import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = await getDb();

  const data = await db
    .collection('metrics')
    .find({ 'metadata.source': 'speedtest-index' })
    .sort({ timestamp: -1 })
    .limit(100)
    .toArray();

  // Split into mobile and fixed, sorted chronologically
  const mobile = data
    .filter(d => d.metadata?.type === 'mobile')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const fixed = data
    .filter(d => d.metadata?.type === 'fixed')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const latestMobile = mobile[mobile.length - 1] || null;
  const latestFixed = fixed[fixed.length - 1] || null;

  return NextResponse.json({
    mobile,
    fixed,
    latest: {
      mobile: latestMobile ? {
        download_mbps: latestMobile.download_speed_mbps,
        upload_mbps: latestMobile.upload_speed_mbps,
        latency_ms: latestMobile.latency_ms,
        rank: latestMobile.global_rank,
        month: latestMobile.month,
      } : null,
      fixed: latestFixed ? {
        download_mbps: latestFixed.download_speed_mbps,
        upload_mbps: latestFixed.upload_speed_mbps,
        latency_ms: latestFixed.latency_ms,
        rank: latestFixed.global_rank,
        month: latestFixed.month,
      } : null,
    },
  });
}
