import { fetchJson } from '../http.js';
import { insertMetrics } from '../db.js';

const BASE = 'https://api.cloudflare.com/client/v4/radar';

export async function collectCloudflare() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    console.warn('[Cloudflare] No API token configured, skipping');
    return [];
  }

  console.log('[Cloudflare] Collecting traffic data for Cuba');
  const headers = { Authorization: `Bearer ${token}` };

  const [timeseries, deviceSummary, botSummary] = await Promise.all([
    fetchJson(`${BASE}/http/timeseries?dateRange=1d&location=CU&format=json`, { headers })
      .catch(err => { console.error('[Cloudflare] timeseries error:', err.message); return null; }),
    fetchJson(`${BASE}/http/summary/device_type?dateRange=1d&location=CU&format=json`, { headers })
      .catch(err => { console.error('[Cloudflare] device_type error:', err.message); return null; }),
    fetchJson(`${BASE}/http/summary/bot_class?dateRange=1d&location=CU&format=json`, { headers })
      .catch(err => { console.error('[Cloudflare] bot_class error:', err.message); return null; }),
  ]);

  const allMetrics = [];

  // Traffic timeseries (normalized 0-1 values relative to max in period)
  if (timeseries?.result?.serie_0) {
    const { timestamps, values } = timeseries.result.serie_0;
    const metrics = (timestamps || []).map((ts, i) => ({
      timestamp: new Date(ts),
      metadata: { source: 'cloudflare', province_id: null, country: 'CU' },
      traffic_score: values[i] != null ? parseFloat(values[i]) * 100 : null,
    }));
    allMetrics.push(...metrics);
  } else {
    console.warn('[Cloudflare] No timeseries data');
  }

  // Device type and bot class summaries — store as a single snapshot metric
  const now = new Date();
  const summaryMetric = {
    timestamp: now,
    metadata: { source: 'cloudflare-summary', province_id: null, country: 'CU' },
  };

  if (deviceSummary?.result?.summary_0) {
    const d = deviceSummary.result.summary_0;
    summaryMetric.device_mobile_pct = parseFloat(d.mobile) || 0;
    summaryMetric.device_desktop_pct = parseFloat(d.desktop) || 0;
  }

  if (botSummary?.result?.summary_0) {
    const b = botSummary.result.summary_0;
    summaryMetric.human_pct = parseFloat(b.human) || 0;
    summaryMetric.bot_pct = parseFloat(b.bot) || 0;
  }

  if (summaryMetric.device_mobile_pct || summaryMetric.human_pct) {
    allMetrics.push(summaryMetric);
  }

  if (allMetrics.length) {
    await insertMetrics(allMetrics);
  }

  console.log(`[Cloudflare] Processed ${allMetrics.length} data points`);
  return allMetrics;
}
