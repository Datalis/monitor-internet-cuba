import { fetchJson } from '../http.js';
import { insertMetrics } from '../db.js';

const BASE = 'https://stat.ripe.net/data';
const ASN = 'AS27725';

export async function collectRipeStat() {
  console.log('[RIPE Stat] Collecting BGP data for', ASN);

  const [prefixes, visibility] = await Promise.all([
    fetchJson(`${BASE}/announced-prefixes/data.json?resource=${ASN}`).catch(err => {
      console.error('[RIPE Stat] announced-prefixes error:', err.message);
      return null;
    }),
    fetchJson(`${BASE}/visibility/data.json?resource=${ASN}`).catch(err => {
      console.error('[RIPE Stat] visibility error:', err.message);
      return null;
    }),
  ]);

  const now = new Date();
  const prefixCount = prefixes?.data?.prefixes?.length ?? null;

  // Calculate visibility: ratio of probes seeing the ASN vs total full-table peers
  let visibilityPct = null;
  if (visibility?.data?.visibilities) {
    let totalPeers = 0;
    let seeingPeers = 0;
    for (const probe of visibility.data.visibilities) {
      const fullTable = probe.ipv4_full_table_peer_count || 0;
      const notSeeing = probe.ipv4_full_table_peers_not_seeing?.length || 0;
      totalPeers += fullTable;
      seeingPeers += (fullTable - notSeeing);
    }
    if (totalPeers > 0) {
      visibilityPct = seeingPeers / totalPeers;
    }
  }

  const metric = {
    timestamp: now,
    metadata: { source: 'ripe-stat', province_id: null, country: 'CU' },
    bgp_prefix_count: prefixCount,
    bgp_visibility_pct: visibilityPct,
  };

  await insertMetrics([metric]);
  console.log(`[RIPE Stat] prefixes=${prefixCount}, visibility=${visibilityPct?.toFixed(4) ?? null}`);
  return metric;
}
