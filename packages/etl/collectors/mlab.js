import { fetchJson } from '../http.js';
import { insertMetrics } from '../db.js';

// Uses Cloudflare Radar Speed API for Cuba internet quality metrics
// Fetches daily summaries for the last 7 days using multi-series requests
// Also fetches global averages for comparison

const RADAR = 'https://api.cloudflare.com/client/v4/radar/quality/speed/summary';

async function fetchSpeedData(headers, location = null) {
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
    if (location) params.append('location', location);
  }

  return fetchJson(`${RADAR}?${params}`, { headers });
}

export async function collectMlab() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    console.warn('[Speed] No Cloudflare token configured, skipping');
    return [];
  }

  console.log('[Speed] Collecting internet speed data for Cuba + global (7-day history)');

  try {
    const headers = { Authorization: `Bearer ${token}` };

    // Fetch Cuba and global data in parallel
    const [cubaData, globalData] = await Promise.all([
      fetchSpeedData(headers, 'CU'),
      fetchSpeedData(headers),
    ]);

    if (!cubaData?.result) {
      console.warn('[Speed] No speed data returned for Cuba');
      return [];
    }

    // Parse global averages per day
    const globalByDay = {};
    const today = new Date();
    const days = 7;
    if (globalData?.result) {
      for (let i = 0; i < days; i++) {
        const s = globalData.result[`day${i}`];
        if (s && s.bandwidthDownload) {
          globalByDay[i] = {
            download: Number(parseFloat(s.bandwidthDownload).toFixed(2)),
            upload: Number(parseFloat(s.bandwidthUpload || 0).toFixed(2)),
            latency: Number(parseFloat(s.latencyIdle || s.latencyLoaded || 0).toFixed(2)),
            jitter: Number(parseFloat(s.jitterIdle || s.jitterLoaded || 0).toFixed(2)),
          };
        }
      }
    }

    const metrics = [];
    for (let i = 0; i < days; i++) {
      const s = cubaData.result[`day${i}`];
      if (!s || !s.bandwidthDownload) continue;

      const date = new Date(today);
      date.setUTCDate(date.getUTCDate() - i);
      date.setUTCHours(12, 0, 0, 0);

      const global = globalByDay[i] || {};

      metrics.push({
        timestamp: date,
        metadata: { source: 'mlab', province_id: null, country: 'CU', actual_source: 'cloudflare_radar_speed' },
        download_speed_mbps: Number(parseFloat(s.bandwidthDownload).toFixed(2)),
        upload_speed_mbps: Number(parseFloat(s.bandwidthUpload || 0).toFixed(2)),
        latency_ms: Number(parseFloat(s.latencyIdle || s.latencyLoaded || 0).toFixed(2)),
        jitter_ms: Number(parseFloat(s.jitterIdle || s.jitterLoaded || 0).toFixed(2)),
        packet_loss_pct: Number(parseFloat(s.packetLoss || 0).toFixed(3)),
        tests_count: 0,
        // Global comparison values
        global_download_mbps: global.download ?? null,
        global_upload_mbps: global.upload ?? null,
        global_latency_ms: global.latency ?? null,
        global_jitter_ms: global.jitter ?? null,
      });
    }

    if (metrics.length) {
      await insertMetrics(metrics);
    }

    const latest = metrics[0];
    if (latest) {
      console.log(`[Speed] ${metrics.length} days loaded. Latest: ${latest.download_speed_mbps} Mbps down (global: ${latest.global_download_mbps}), ${latest.latency_ms} ms latency (global: ${latest.global_latency_ms})`);
    }
    return metrics;
  } catch (err) {
    console.error('[Speed] Collection error:', err.message);
    return [];
  }
}
