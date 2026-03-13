import { fetchJson } from '../http.js';
import { insertMetrics } from '../db.js';

// Uses Cloudflare Radar Speed API for Cuba internet quality metrics
// Fetches daily summaries for the last 7 days using multi-series requests

const RADAR = 'https://api.cloudflare.com/client/v4/radar/quality/speed/summary';

export async function collectMlab() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    console.warn('[Speed] No Cloudflare token configured, skipping');
    return [];
  }

  console.log('[Speed] Collecting internet speed data for Cuba (7-day history)');

  try {
    const headers = { Authorization: `Bearer ${token}` };

    // Build multi-series request: one series per day for the last 7 days
    const params = new URLSearchParams({ format: 'json' });
    const today = new Date();
    const days = 7;

    for (let i = 0; i < days; i++) {
      const end = new Date(today);
      end.setUTCDate(end.getUTCDate() - i);
      end.setUTCHours(0, 0, 0, 0);

      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 1);

      params.append('name', `day${i}`);
      params.append('dateStart', start.toISOString());
      params.append('dateEnd', end.toISOString());
      params.append('location', 'CU');
    }

    const data = await fetchJson(`${RADAR}?${params}`, { headers });

    if (!data?.result) {
      console.warn('[Speed] No speed data returned for Cuba');
      return [];
    }

    const metrics = [];
    for (let i = 0; i < days; i++) {
      const s = data.result[`day${i}`];
      if (!s || !s.bandwidthDownload) continue;

      const date = new Date(today);
      date.setUTCDate(date.getUTCDate() - i);
      date.setUTCHours(12, 0, 0, 0);

      metrics.push({
        timestamp: date,
        metadata: { source: 'mlab', province_id: null, country: 'CU', actual_source: 'cloudflare_radar_speed' },
        download_speed_mbps: Number(parseFloat(s.bandwidthDownload).toFixed(2)),
        upload_speed_mbps: Number(parseFloat(s.bandwidthUpload || 0).toFixed(2)),
        latency_ms: Number(parseFloat(s.latencyIdle || s.latencyLoaded || 0).toFixed(2)),
        jitter_ms: Number(parseFloat(s.jitterIdle || s.jitterLoaded || 0).toFixed(2)),
        packet_loss_pct: Number(parseFloat(s.packetLoss || 0).toFixed(3)),
        tests_count: 0,
      });
    }

    if (metrics.length) {
      await insertMetrics(metrics);
    }

    const latest = metrics[0];
    if (latest) {
      console.log(`[Speed] ${metrics.length} days loaded. Latest: ${latest.download_speed_mbps} Mbps down, ${latest.latency_ms} ms latency`);
    }
    return metrics;
  } catch (err) {
    console.error('[Speed] Collection error:', err.message);
    return [];
  }
}
