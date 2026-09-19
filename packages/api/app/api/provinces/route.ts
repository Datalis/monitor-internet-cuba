import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { PROVINCES } from '@/lib/provinces';

export const dynamic = 'force-dynamic';


export async function GET() {
  const db = await getDb();
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const pipeline = [
    {
      $match: {
        'metadata.province_id': { $ne: null },
        timestamp: { $gte: since },
        download_mbps: { $exists: true },
      },
    },
    {
      $group: {
        _id: '$metadata.province_id',
        avg_download: { $avg: '$download_mbps' },
        avg_upload: { $avg: '$upload_mbps' },
        avg_latency: { $avg: '$latency_ms' },
        tests: { $sum: '$tests_count' },
      },
    },
  ];

  const stats = await db.collection('metrics').aggregate(pipeline).toArray();
  const statsMap = Object.fromEntries(stats.map(s => [s._id, s]));

  const result = PROVINCES.map(p => ({
    ...p,
    ...(statsMap[p.id] || { avg_download: null, avg_upload: null, avg_latency: null, tests: 0 }),
  }));

  return NextResponse.json({ data: result });
}
