import { fetchJson } from '../http.js';
import { insertMetrics } from '../db.js';

const BASE = 'https://api.ooni.org/api/v1/aggregation';

export async function collectOoni() {
  console.log('[OONI] Collecting censorship data for Cuba');

  const now = new Date();
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fmtDate = d => d.toISOString().split('T')[0];

  const data = await fetchJson(
    `${BASE}?probe_cc=CU&test_name=web_connectivity&since=${fmtDate(since)}&until=${fmtDate(now)}&time_grain=day&axis_x=measurement_start_day`
  ).catch(err => {
    console.error('[OONI] aggregation error:', err.message);
    return null;
  });

  if (!data?.result || !Array.isArray(data.result)) {
    console.warn('[OONI] No aggregation data returned');
    return [];
  }

  const metrics = data.result.map(row => ({
    timestamp: new Date(row.measurement_start_day + 'T12:00:00Z'),
    metadata: { source: 'ooni', province_id: null, country: 'CU' },
    blocking_rate: row.measurement_count > 0 ? row.anomaly_count / row.measurement_count : 0,
    tests_count: row.measurement_count,
    ok_count: row.ok_count ?? 0,
    confirmed_count: row.confirmed_count ?? 0,
    anomaly_count: row.anomaly_count ?? 0,
    failure_count: row.failure_count ?? 0,
  }));

  if (metrics.length) {
    await insertMetrics(metrics);
  }
  console.log(`[OONI] Processed ${metrics.length} data points`);
  return metrics;
}
