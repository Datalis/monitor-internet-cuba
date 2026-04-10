import { request } from 'undici';
import { insertMetrics } from '../db.js';
import { getDb } from '../db.js';

// Scrapes Speedtest Global Index page for Cuba to get Ookla's
// aggregated speed data (fixed broadband + mobile, monthly)
// Cuba currently has no mobile data on the index.

const PAGE_URL = 'https://www.speedtest.net/global-index/cuba';
const INDEX_URL = 'https://www.speedtest.net/global-index';

async function fetchHtml(url) {
  const res = await request(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (res.statusCode >= 400) {
    throw new Error(`HTTP ${res.statusCode} from ${url}`);
  }

  return await res.body.text();
}

// Extract named arrays like "fixedMean":[...], "mobileMedian":[...] from HTML
function extractNamedArrays(html) {
  const result = {};
  const names = ['fixedMean', 'fixedMedian', 'mobileMean', 'mobileMedian'];

  for (const name of names) {
    const pattern = `"${name}":[`;
    const start = html.indexOf(pattern);
    if (start === -1) {
      result[name] = [];
      continue;
    }

    // Find the matching closing bracket
    const arrStart = start + pattern.length - 1;
    let depth = 0;
    let end = arrStart;
    for (let i = arrStart; i < html.length; i++) {
      if (html[i] === '[') depth++;
      else if (html[i] === ']') {
        depth--;
        if (depth === 0) { end = i + 1; break; }
      }
    }

    try {
      result[name] = JSON.parse(html.slice(arrStart, end));
    } catch {
      result[name] = [];
    }
  }

  return result;
}

// Count total countries from the global index page
async function fetchTotalCountries() {
  try {
    const html = await fetchHtml(INDEX_URL);
    const ranks = html.match(/"rank":(\d+)/g) || [];
    let max = 0;
    for (const m of ranks) {
      const n = parseInt(m.split(':')[1]);
      if (n > max) max = n;
    }
    return max || null;
  } catch {
    return null;
  }
}

function buildMetrics(entries, type) {
  return entries
    .filter(e => e.global_index_date && e.download_mbps)
    .map(entry => {
      const date = new Date(entry.global_index_date);
      date.setUTCHours(12, 0, 0, 0);
      return {
        timestamp: date,
        metadata: {
          source: 'speedtest-index',
          type,
          country: 'CU',
          country_id: entry.country_id,
        },
        download_speed_mbps: parseFloat(entry.download_mbps),
        upload_speed_mbps: parseFloat(entry.upload_mbps),
        latency_ms: entry.latency_ms,
        jitter_ms: entry.jitter || null,
        global_rank: entry.rank,
        month: entry.month,
      };
    });
}

export async function collectSpeedtestIndex() {
  console.log('[Speedtest Index] Fetching Cuba data from speedtest.net/global-index');

  try {
    const html = await fetchHtml(PAGE_URL);
    const arrays = extractNamedArrays(html);

    const fixedMedian = arrays.fixedMedian || [];
    const fixedMean = arrays.fixedMean || [];
    const mobileMedian = arrays.mobileMedian || [];
    const mobileMean = arrays.mobileMean || [];

    console.log(`[Speedtest Index] fixedMedian=${fixedMedian.length}, fixedMean=${fixedMean.length}, mobileMedian=${mobileMedian.length}, mobileMean=${mobileMean.length}`);

    if (fixedMedian.length === 0 && mobileMedian.length === 0) {
      console.warn('[Speedtest Index] No data found');
      return [];
    }

    // Delete old incorrectly classified data
    const db = await getDb();
    await db.collection('metrics').deleteMany({ 'metadata.source': 'speedtest-index' });

    const metrics = [
      ...buildMetrics(fixedMedian, 'fixed_median'),
      ...buildMetrics(fixedMean, 'fixed_mean'),
      ...buildMetrics(mobileMedian, 'mobile_median'),
      ...buildMetrics(mobileMean, 'mobile_mean'),
    ];

    // Fetch and store total countries count
    const totalCountries = await fetchTotalCountries();
    if (totalCountries) {
      for (const m of metrics) {
        m.total_countries = totalCountries;
      }
    }

    if (metrics.length) {
      await insertMetrics(metrics);
    }

    // Log latest
    const latestFixed = fixedMedian[fixedMedian.length - 1];
    const latestMobile = mobileMedian[mobileMedian.length - 1];
    if (latestFixed) {
      console.log(`[Speedtest Index] Fixed median: ${latestFixed.download_mbps} Mbps down, ${latestFixed.upload_mbps} up, ${latestFixed.latency_ms} ms, rank #${latestFixed.rank}${totalCountries ? '/' + totalCountries : ''} (${latestFixed.month})`);
    }
    if (latestMobile) {
      console.log(`[Speedtest Index] Mobile median: ${latestMobile.download_mbps} Mbps down, ${latestMobile.upload_mbps} up, ${latestMobile.latency_ms} ms, rank #${latestMobile.rank}${totalCountries ? '/' + totalCountries : ''} (${latestMobile.month})`);
    } else {
      console.log('[Speedtest Index] No mobile data available for Cuba');
    }

    return metrics;
  } catch (err) {
    console.error('[Speedtest Index] Collection error:', err.message);
    return [];
  }
}
