import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const source = searchParams.get('source');
  const province = searchParams.get('province');
  const hours = parseInt(searchParams.get('hours') || '24');
  const limit = Math.min(parseInt(searchParams.get('limit') || '1000'), 5000);

  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const matchStage: Record<string, unknown> = { timestamp: { $gte: since } };
  if (source) matchStage['metadata.source'] = source;
  if (province) matchStage['metadata.province_id'] = province;

  const db = await getDb();

  // Deduplicate by timestamp to avoid inflated results from repeated ETL runs
  const metrics = await db
    .collection('metrics')
    .aggregate([
      { $match: matchStage },
      { $sort: { timestamp: -1 } },
      { $group: {
        _id: '$timestamp',
        doc: { $first: '$$ROOT' },
      }},
      { $replaceRoot: { newRoot: '$doc' } },
      { $sort: { timestamp: -1 } },
      { $limit: limit },
    ])
    .toArray();

  return NextResponse.json({ count: metrics.length, data: metrics });
}
