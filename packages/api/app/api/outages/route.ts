import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  const hours = parseInt(req.nextUrl.searchParams.get('hours') || '72');
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const db = await getDb();

  const [iodaData, ripeData, cfAlerts] = await Promise.all([
    db.collection('metrics').find({
      'metadata.source': 'ioda',
      timestamp: { $gte: since },
    }).sort({ timestamp: -1 }).limit(500).toArray(),

    db.collection('metrics').find({
      'metadata.source': 'ripe-stat',
      timestamp: { $gte: since },
    }).sort({ timestamp: -1 }).limit(500).toArray(),

    db.collection('metrics').find({
      'metadata.source': 'cloudflare-alert',
      timestamp: { $gte: since },
    }).sort({ timestamp: -1 }).limit(50).toArray(),
  ]);

  const outageEvents = iodaData.filter(d => d.outage_detected);

  // Cloudflare active alerts: outages or anomalies without end_date or end_date in the future
  const now = new Date();
  const activeCfAlerts = cfAlerts.filter(a =>
    !a.end_date || new Date(a.end_date) > now
  );

  return NextResponse.json({
    ioda: iodaData,
    ripe: ripeData,
    cloudflare_alerts: cfAlerts,
    active_cf_alerts: activeCfAlerts.length,
    active_outages: outageEvents.length + activeCfAlerts.filter(a => a.alert_type === 'outage').length,
    latest_ioda: iodaData[0] || null,
    latest_ripe: ripeData[0] || null,
    // Prioritize outage over anomaly for display
    latest_cf_alert: activeCfAlerts.find(a => a.alert_type === 'outage') || activeCfAlerts[0] || null,
  });
}
