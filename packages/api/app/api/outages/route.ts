import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  const hours = parseInt(req.nextUrl.searchParams.get('hours') || '72');
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const db = await getDb();

  const [iodaData, ripeData] = await Promise.all([
    db.collection('metrics').find({
      'metadata.source': 'ioda',
      timestamp: { $gte: since },
    }).sort({ timestamp: -1 }).limit(500).toArray(),

    db.collection('metrics').find({
      'metadata.source': 'ripe-stat',
      timestamp: { $gte: since },
    }).sort({ timestamp: -1 }).limit(500).toArray(),
  ]);

  const outageEvents = iodaData.filter(d => d.outage_detected);

  return NextResponse.json({
    ioda: iodaData,
    ripe: ripeData,
    active_outages: outageEvents.length,
    latest_ioda: iodaData[0] || null,
    latest_ripe: ripeData[0] || null,
  });
}
