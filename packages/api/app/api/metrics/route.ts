import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const source = searchParams.get('source');
  const province = searchParams.get('province');
  const hours = parseInt(searchParams.get('hours') || '24');
  const limit = Math.min(parseInt(searchParams.get('limit') || '500'), 2000);

  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const filter: Record<string, unknown> = { timestamp: { $gte: since } };
  if (source) filter['metadata.source'] = source;
  if (province) filter['metadata.province_id'] = province;

  const db = await getDb();
  const metrics = await db
    .collection('metrics')
    .find(filter)
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();

  return NextResponse.json({ count: metrics.length, data: metrics });
}
