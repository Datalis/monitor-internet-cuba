import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  const hours = parseInt(req.nextUrl.searchParams.get('hours') || '168');
  const province = req.nextUrl.searchParams.get('province');
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const db = await getDb();
  const col = db.collection('metrics');

  const matchStage: Record<string, unknown> = {
    'metadata.source': 'crowdsourced',
    timestamp: { $gte: since },
  };
  if (province) matchStage['metadata.province_id'] = province;

  // Overall summary
  const [summary] = await col.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        avg_download: { $avg: '$download_mbps' },
        avg_upload: { $avg: '$upload_mbps' },
        avg_latency: { $avg: '$latency_ms' },
        test_count: { $sum: 1 },
        min_download: { $min: '$download_mbps' },
        max_download: { $max: '$download_mbps' },
      },
    },
  ]).toArray();

  // By province
  const byProvince = await col.aggregate([
    { $match: { 'metadata.source': 'crowdsourced', timestamp: { $gte: since }, 'metadata.province_id': { $ne: null } } },
    {
      $group: {
        _id: '$metadata.province_id',
        avg_download: { $avg: '$download_mbps' },
        avg_upload: { $avg: '$upload_mbps' },
        avg_latency: { $avg: '$latency_ms' },
        test_count: { $sum: 1 },
      },
    },
    { $sort: { test_count: -1 } },
  ]).toArray();

  // Daily trend (last 7 days)
  const trend = await col.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
        },
        avg_download: { $avg: '$download_mbps' },
        avg_upload: { $avg: '$upload_mbps' },
        test_count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]).toArray();

  return NextResponse.json({
    summary: summary || { avg_download: null, avg_upload: null, avg_latency: null, test_count: 0 },
    by_province: byProvince.map(p => ({ province_id: p._id, ...p, _id: undefined })),
    trend: trend.map(t => ({ date: t._id, ...t, _id: undefined })),
  });
}
