import { fetchJson } from '../http.js';
import { insertMetrics } from '../db.js';

const BASE = 'https://api.ioda.inetintel.cc.gatech.edu/v2';

// IODA solo emite alertas en los cambios de estado de cada fuente (critical /
// warning al empezar, normal al recuperarse), asi que miramos lo bastante atras
// como para encontrar siempre la ultima alerta de cada una.
const ALERT_LOOKBACK_S = 7 * 24 * 60 * 60;
const SIGNAL_LOOKBACK_S = 2 * 60 * 60;
// Si la senal ya volvio a este nivel respecto a su linea base, damos la caida
// por terminada aunque IODA aun no haya emitido la alerta "normal".
const RECOVERED_RATIO = 0.9;

// Ultimo valor no nulo de una senal cruda de IODA para Cuba
async function latestSignalValue(datasource, from, until) {
  const res = await fetchJson(
    `${BASE}/signals/raw/country/CU?from=${from}&until=${until}&datasource=${datasource}`
  ).catch(err => {
    console.warn(`[IODA] signal ${datasource} error:`, err.message);
    return null;
  });
  const series = res?.data?.flat().find(s => s.datasource === datasource);
  const values = series?.values || [];
  for (let i = values.length - 1; i >= 0; i--) {
    if (typeof values[i] === 'number') return values[i];
  }
  return null;
}

// `now` (segundos) permite reevaluar un instante pasado; por defecto, ahora
export async function collectIoda({ now = Math.floor(Date.now() / 1000) } = {}) {
  console.log('[IODA] Collecting outage data for Cuba');

  const alertsRes = await fetchJson(
    `${BASE}/outages/alerts?from=${now - ALERT_LOOKBACK_S}&until=${now}&entityType=country&entityCode=CU&limit=500`
  );
  const alerts = (alertsRes?.data || []).sort((a, b) => a.time - b.time);

  // Ultima alerta por fuente y, si sigue en caida, cuando empezo el episodio
  const byDatasource = new Map();
  for (const a of alerts) {
    const prev = byDatasource.get(a.datasource);
    const episodeStart = a.level === 'normal' ? null : (prev?.episodeStart ?? a.time);
    byDatasource.set(a.datasource, { alert: a, episodeStart });
  }

  const signals = [];
  for (const [datasource, { alert, episodeStart }] of byDatasource) {
    if (alert.level === 'normal') continue;
    const baseline = alert.historyValue;
    const current = await latestSignalValue(datasource, now - SIGNAL_LOOKBACK_S, now) ?? alert.value;
    const ratio = baseline > 0 ? current / baseline : null;
    if (ratio != null && ratio >= RECOVERED_RATIO) continue;
    signals.push({
      datasource,
      level: alert.level,
      since: new Date(episodeStart * 1000),
      value: current,
      baseline,
      // Magnitud de la caida: 0 = senal normal, 1 = ninguna respuesta
      drop: ratio != null ? Math.round(Math.min(Math.max(1 - ratio, 0), 1) * 1000) / 1000 : 1,
    });
  }

  const hasOutage = signals.length > 0;
  const outageScore = hasOutage ? Math.max(...signals.map(s => s.drop)) : 0;

  const metric = {
    timestamp: new Date(now * 1000),
    metadata: { source: 'ioda', province_id: null, country: 'CU' },
    outage_score: outageScore,
    outage_detected: hasOutage,
    outage_since: hasOutage ? new Date(Math.min(...signals.map(s => s.since.getTime()))) : null,
    signals,
  };

  await insertMetrics([metric]);
  console.log(`[IODA] outage_detected=${hasOutage}, score=${outageScore.toFixed(3)}${hasOutage ? ` (${signals.map(s => `${s.datasource} ${s.level} ${s.value}/${s.baseline}`).join(', ')})` : ''}`);
  return metric;
}
