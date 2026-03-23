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

  const [timeseries, deviceSummary, botSummary, worldTimeseries] = await Promise.all([
    fetchJson(`${BASE}/http/timeseries?dateRange=1d&location=CU&format=json`, { headers })
      .catch(err => { console.error('[Cloudflare] timeseries error:', err.message); return null; }),
    fetchJson(`${BASE}/http/summary/device_type?dateRange=1d&location=CU&format=json`, { headers })
      .catch(err => { console.error('[Cloudflare] device_type error:', err.message); return null; }),
    fetchJson(`${BASE}/http/summary/bot_class?dateRange=1d&location=CU&format=json`, { headers })
      .catch(err => { console.error('[Cloudflare] bot_class error:', err.message); return null; }),
    fetchJson(`${BASE}/http/timeseries?dateRange=1d&format=json`, { headers })
      .catch(err => { console.error('[Cloudflare] world timeseries error:', err.message); return null; }),
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

    // Inline annotations from timeseries meta (most reliable source for active outages)
    const inlineAnnotations = timeseries.result.meta?.confidenceInfo?.annotations || [];
    for (const ann of inlineAnnotations) {
      if (ann.eventType === 'OUTAGE' || ann.eventType === 'ANOMALY') {
        allMetrics.push({
          timestamp: new Date(ann.startDate),
          metadata: { source: 'cloudflare-alert', province_id: null, country: 'CU' },
          alert_type: ann.eventType.toLowerCase(),
          event_type: ann.eventType,
          description: ann.description || null,
          start_date: ann.startDate,
          end_date: ann.endDate || null,
          linked_url: ann.linkedUrl || null,
          is_instantaneous: ann.isInstantaneous || false,
          data_source: ann.dataSource || null,
        });
        console.log(`[Cloudflare] Inline annotation: ${ann.eventType} - ${ann.description}`);
      }
    }
  } else {
    console.warn('[Cloudflare] No timeseries data');
  }

  // Worldwide traffic timeseries (for Cuba vs World comparison)
  if (worldTimeseries?.result?.serie_0) {
    const { timestamps, values } = worldTimeseries.result.serie_0;
    const metrics = (timestamps || []).map((ts, i) => ({
      timestamp: new Date(ts),
      metadata: { source: 'cloudflare-world', province_id: null, country: null },
      traffic_score: values[i] != null ? parseFloat(values[i]) * 100 : null,
    }));
    allMetrics.push(...metrics);
    console.log(`[Cloudflare] World traffic: ${metrics.length} data points`);
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

  // Cloudflare Radar annotations: verified outages affecting Cuba
  const annotations = await fetchJson(
    `${BASE}/annotations/outages?dateRange=2d&format=json&location=CU`,
    { headers },
  ).catch(err => { console.error('[Cloudflare] annotations error:', err.message); return null; });

  if (annotations?.result?.annotations?.length) {
    for (const ann of annotations.result.annotations) {
      const isCuba = (ann.locations || []).some(l => l.toUpperCase() === 'CU')
        || (ann.asns || []).some(a => String(a) === '27725');
      if (!isCuba) continue;

      allMetrics.push({
        timestamp: new Date(ann.startDate),
        metadata: { source: 'cloudflare-alert', province_id: null, country: 'CU' },
        alert_type: 'outage',
        event_type: ann.eventType || 'unknown',
        outage_cause: ann.outage?.outageCause || null,
        outage_type: ann.outage?.outageType || null,
        description: ann.description || null,
        start_date: ann.startDate,
        end_date: ann.endDate || null,
        linked_url: ann.linkedUrl || null,
      });
    }
    console.log(`[Cloudflare] Found ${annotations.result.annotations.length} outage annotations`);
  }

  // Cloudflare Radar traffic anomalies for Cuba
  const anomalies = await fetchJson(
    `${BASE}/traffic_anomalies?dateRange=2d&format=json&location=CU&limit=10`,
    { headers },
  ).catch(err => { console.error('[Cloudflare] anomalies error:', err.message); return null; });

  if (anomalies?.result?.trafficAnomalies?.length) {
    for (const anom of anomalies.result.trafficAnomalies) {
      allMetrics.push({
        timestamp: new Date(anom.startDate),
        metadata: { source: 'cloudflare-alert', province_id: null, country: 'CU' },
        alert_type: 'anomaly',
        event_type: anom.type || 'unknown',
        status: anom.status || null,
        start_date: anom.startDate,
        end_date: anom.endDate || null,
        magnitude: anom.magnitude || null,
        asn: anom.asnDetails?.asn || null,
        asn_name: anom.asnDetails?.name || null,
      });
    }
    console.log(`[Cloudflare] Found ${anomalies.result.trafficAnomalies.length} traffic anomalies`);
  }

  if (allMetrics.length) {
    await insertMetrics(allMetrics);
  }

  console.log(`[Cloudflare] Processed ${allMetrics.length} data points`);
  return allMetrics;
}
