import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30');
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const db = await getDb();
  const data = await db.collection('metrics').find({
    'metadata.source': 'ooni',
    timestamp: { $gte: since },
    tests_count: { $exists: true },
  }).sort({ timestamp: 1 }).limit(1000).toArray();

  return NextResponse.json({ count: data.length, data });
}
