import { fetchJson } from '../http.js';
import { insertMetrics } from '../db.js';

const BASE = 'https://api.ioda.inetintel.cc.gatech.edu/v2';

export async function collectIoda() {
  console.log('[IODA] Collecting outage data for Cuba');

  const now = Math.floor(Date.now() / 1000);
  const from = now - 2 * 60 * 60; // last 2h

  const alerts = await fetchJson(
    `${BASE}/outages/alerts?from=${from}&until=${now}&entityType=country&entityCode=CU&limit=100`
  ).catch(err => {
    console.error('[IODA] alerts error:', err.message);
    return null;
  });

  const hasOutage = alerts?.data?.length > 0;
  const outageScore = hasOutage ? 1.0 : 0.0;

  const metric = {
    timestamp: new Date(),
    metadata: { source: 'ioda', province_id: null, country: 'CU' },
    outage_score: outageScore,
    outage_detected: hasOutage,
  };

  await insertMetrics([metric]);
  console.log(`[IODA] outage_detected=${hasOutage}, score=${outageScore.toFixed(3)}`);
  return metric;
}
