import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = await getDb();

  const data = await db
    .collection('metrics')
    .find({ 'metadata.source': 'speedtest-index' })
    .sort({ timestamp: -1 })
    .limit(200)
    .toArray();

  // Split by type, sorted chronologically
  const sort = (arr: typeof data) =>
    arr.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const fixedMedian = sort(data.filter(d => d.metadata?.type === 'fixed_median'));
  const fixedMean = sort(data.filter(d => d.metadata?.type === 'fixed_mean'));
  const mobileMedian = sort(data.filter(d => d.metadata?.type === 'mobile_median'));
  const mobileMean = sort(data.filter(d => d.metadata?.type === 'mobile_mean'));

  function formatLatest(arr: typeof data) {
    const entry = arr[arr.length - 1];
    if (!entry) return null;
    return {
      download_mbps: entry.download_speed_mbps,
      upload_mbps: entry.upload_speed_mbps,
      latency_ms: entry.latency_ms,
      rank: entry.global_rank,
      total_countries: entry.total_countries || null,
      month: entry.month,
    };
  }

  return NextResponse.json({
    fixed_median: fixedMedian,
    fixed_mean: fixedMean,
    mobile_median: mobileMedian,
    mobile_mean: mobileMean,
    latest: {
      fixed_median: formatLatest(fixedMedian),
      fixed_mean: formatLatest(fixedMean),
      mobile_median: formatLatest(mobileMedian),
      mobile_mean: formatLatest(mobileMean),
    },
  });
}
