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

  // Cloudflare active alerts: deduplicate by start_date + alert_type, keep richest record
  const now = new Date();
  const maxAlertAge = 24 * 60 * 60 * 1000; // 24h: if no end_date and older than this, consider resolved
  const seen = new Map<string, typeof cfAlerts[0]>();
  for (const a of cfAlerts) {
    if (a.end_date && new Date(a.end_date) <= now) continue;
    // If no end_date but start_date is too old, treat as stale/resolved
    if (!a.end_date && a.start_date && (now.getTime() - new Date(a.start_date).getTime()) > maxAlertAge) continue;
    const key = `${a.alert_type}:${a.start_date}`;
    const existing = seen.get(key);
    // Keep the record with more data (e.g. has outage_cause)
    if (!existing || (a.outage_cause && !existing.outage_cause)) {
      seen.set(key, a);
    }
  }
  const activeCfAlerts = Array.from(seen.values());

  return NextResponse.json({
    ioda: iodaData,
    ripe: ripeData,
    cloudflare_alerts: activeCfAlerts,
    active_cf_alerts: activeCfAlerts.length,
    active_outages: outageEvents.length + activeCfAlerts.filter(a => a.alert_type === 'outage').length,
    latest_ioda: iodaData[0] || null,
    latest_ripe: ripeData[0] || null,
    // Prioritize outage over anomaly for display
    latest_cf_alert: activeCfAlerts.find(a => a.alert_type === 'outage') || activeCfAlerts[0] || null,
  });
}
