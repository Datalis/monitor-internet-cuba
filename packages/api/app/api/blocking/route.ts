import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30');
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const db = await getDb();
  const data = await db.collection('metrics').aggregate([
    {
      $match: {
        'metadata.source': 'ooni',
        timestamp: { $gte: since },
        tests_count: { $exists: true },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
        timestamp: { $first: '$timestamp' },
        ok_count: { $sum: '$ok_count' },
        confirmed_count: { $sum: '$confirmed_count' },
        anomaly_count: { $sum: '$anomaly_count' },
        failure_count: { $sum: '$failure_count' },
        tests_count: { $sum: '$tests_count' },
      },
    },
    { $sort: { _id: 1 } },
  ]).toArray();

  return NextResponse.json({ count: data.length, data });
}
