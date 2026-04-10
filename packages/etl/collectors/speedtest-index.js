import { request } from 'undici';
import { insertMetrics } from '../db.js';

// Scrapes Speedtest Global Index page for Cuba to get Ookla's
// aggregated speed data (mobile + fixed broadband, monthly medians)

const URL = 'https://www.speedtest.net/global-index/cuba';

async function fetchPage() {
  const res = await request(URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (res.statusCode >= 400) {
    throw new Error(`HTTP ${res.statusCode} from speedtest.net`);
  }

  return await res.body.text();
}

function extractJsonObjects(html) {
  // Extract all JSON objects that contain download_mbps (speed data entries)
  const regex = /\{[^{}]*"download_mbps":"[\d.]+"[^{}]*\}/g;
  const matches = html.match(regex) || [];
  return matches.map(m => {
    try { return JSON.parse(m); } catch { return null; }
  }).filter(Boolean);
}

function classifyEntries(entries) {
  // The page embeds two series: fixedMean (mobile*) and fixedMedian (fixed broadband)
  // Mobile speeds are significantly higher (>10 Mbps) than fixed (~3-4 Mbps)
  // Entries with rank_change are summary entries, not historical
  const historical = entries.filter(e => e.global_index_date && !('rank_change' in e));

  // Split by speed range: mobile has download > 8 Mbps, fixed < 8 Mbps
  // More reliable: they appear in order in the HTML — first batch is mobile, second is fixed
  const half = Math.floor(historical.length / 2);
  const mobile = historical.slice(0, half);
  const fixed = historical.slice(half);

  // Also extract the summary entries (current rank + rank_change)
  const summaries = entries.filter(e => 'rank_change' in e);

  return { mobile, fixed, summaries };
}

export async function collectSpeedtestIndex() {
  console.log('[Speedtest Index] Fetching Cuba data from speedtest.net/global-index');

  try {
    const html = await fetchPage();
    const entries = extractJsonObjects(html);

    if (entries.length === 0) {
      console.warn('[Speedtest Index] No data found in page');
      return [];
    }

    const { mobile, fixed, summaries } = classifyEntries(entries);
    console.log(`[Speedtest Index] Found ${mobile.length} mobile + ${fixed.length} fixed entries, ${summaries.length} summaries`);

    const metrics = [];

    // Process mobile entries
    for (const entry of mobile) {
      const date = new Date(entry.global_index_date);
      date.setUTCHours(12, 0, 0, 0);

      metrics.push({
        timestamp: date,
        metadata: {
          source: 'speedtest-index',
          type: 'mobile',
          country: 'CU',
          country_id: entry.country_id,
        },
        download_speed_mbps: parseFloat(entry.download_mbps),
        upload_speed_mbps: parseFloat(entry.upload_mbps),
        latency_ms: entry.latency_ms,
        jitter_ms: entry.jitter || null,
        global_rank: entry.rank,
        month: entry.month,
      });
    }

    // Process fixed broadband entries
    for (const entry of fixed) {
      const date = new Date(entry.global_index_date);
      date.setUTCHours(12, 0, 0, 0);

      metrics.push({
        timestamp: date,
        metadata: {
          source: 'speedtest-index',
          type: 'fixed',
          country: 'CU',
          country_id: entry.country_id,
        },
        download_speed_mbps: parseFloat(entry.download_mbps),
        upload_speed_mbps: parseFloat(entry.upload_mbps),
        latency_ms: entry.latency_ms,
        jitter_ms: entry.jitter || null,
        global_rank: entry.rank,
        month: entry.month,
      });
    }

    if (metrics.length) {
      await insertMetrics(metrics);
    }

    // Log latest values
    const latestMobile = mobile[mobile.length - 1];
    const latestFixed = fixed[fixed.length - 1];
    if (latestMobile) {
      console.log(`[Speedtest Index] Mobile: ${latestMobile.download_mbps} Mbps down, ${latestMobile.upload_mbps} up, ${latestMobile.latency_ms} ms, rank #${latestMobile.rank} (${latestMobile.month})`);
    }
    if (latestFixed) {
      console.log(`[Speedtest Index] Fixed:  ${latestFixed.download_mbps} Mbps down, ${latestFixed.upload_mbps} up, ${latestFixed.latency_ms} ms, rank #${latestFixed.rank} (${latestFixed.month})`);
    }

    return metrics;
  } catch (err) {
    console.error('[Speedtest Index] Collection error:', err.message);
    return [];
  }
}
