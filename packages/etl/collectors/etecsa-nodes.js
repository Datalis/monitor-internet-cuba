import { request } from 'undici';
import { insertMetrics } from '../db.js';

// Nodos LibreSpeed publicos de ETECSA (http://speedtest.cd.etecsa.cu/).
// Solo sirven HTTP y sin CORS, asi que no se pueden usar desde el navegador;
// los medimos desde el servidor: disponibilidad + latencia + capacidad de la
// ruta internacional hacia cada nodo. No forma parte del Indice de Apertura.
export const ETECSA_NODES = [
  { id: 'lh', name: 'La Habana', province_id: 'HAB', host: 'speedtest-lh.cd.etecsa.cu' },
  { id: 'sj', name: 'Mayabeque', province_id: 'MAY', host: 'speedtest-sj.cd.etecsa.cu' },
  { id: 'lt', name: 'Las Tunas', province_id: 'LTU', host: 'speedtest-lt.cd.etecsa.cu' },
];

const PING_COUNT = 4;
const PING_TIMEOUT = 8000;
// 4 MB por nodo y medicion: suficiente para salir de TCP slow start con ~175 ms
// de RTT sin cargar demasiado unos servidores que no son nuestros.
const DOWNLOAD_CHUNKS = 4;
const DOWNLOAD_TIMEOUT = 60000;

async function timedGet(url, timeout) {
  const start = performance.now();
  const res = await request(url, {
    method: 'GET',
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(timeout),
  });
  const ttfb = performance.now() - start;
  let bytes = 0;
  for await (const chunk of res.body) bytes += chunk.length;
  const total = performance.now() - start;
  if (res.statusCode >= 400) throw new Error(`HTTP ${res.statusCode}`);
  return { ttfb, total, bytes };
}

async function measurePing(node) {
  const base = `http://${node.host}/backend/empty.php`;
  const samples = [];
  let lastError = null;
  // La primera peticion abre la conexion (TCP); las siguientes la reutilizan,
  // asi el TTFB aproxima un RTT HTTP como hace LibreSpeed.
  for (let i = 0; i <= PING_COUNT; i++) {
    try {
      const { ttfb } = await timedGet(`${base}?r=${Date.now()}${i}`, PING_TIMEOUT);
      if (i > 0) samples.push(ttfb);
    } catch (err) {
      lastError = err.message;
    }
  }
  samples.sort((a, b) => a - b);
  const median = samples.length ? samples[Math.floor(samples.length / 2)] : null;
  return {
    up: samples.length > 0,
    latency_ms: median != null ? Math.round(median) : null,
    ping_loss_pct: Math.round(((PING_COUNT - samples.length) / PING_COUNT) * 100),
    error: samples.length ? null : lastError,
  };
}

async function measureDownload(node) {
  const url = `http://${node.host}/backend/garbage.php?ckSize=${DOWNLOAD_CHUNKS}&r=${Date.now()}`;
  const { ttfb, total, bytes } = await timedGet(url, DOWNLOAD_TIMEOUT);
  // Desde el primer byte: aisla el throughput de la latencia de establecimiento
  const seconds = (total - ttfb) / 1000;
  if (seconds <= 0 || bytes === 0) return null;
  return Math.round(((bytes * 8) / seconds / 1e6) * 100) / 100;
}

export async function collectEtecsaNodes({ throughput = false } = {}) {
  console.log(`[ETECSA] Probing ${ETECSA_NODES.length} nodes${throughput ? ' (with download)' : ''}`);
  const now = new Date();

  const metrics = await Promise.all(ETECSA_NODES.map(async node => {
    const ping = await measurePing(node);
    let download_mbps = null;
    if (throughput && ping.up) {
      download_mbps = await measureDownload(node).catch(err => {
        console.warn(`[ETECSA] ${node.id} download failed: ${err.message}`);
        return null;
      });
    }
    return {
      timestamp: now,
      metadata: { source: 'etecsa-node', province_id: node.province_id, country: 'CU', node: node.id },
      up: ping.up,
      latency_ms: ping.latency_ms,
      ping_loss_pct: ping.ping_loss_pct,
      download_mbps,
      error: ping.error,
    };
  }));

  await insertMetrics(metrics);
  for (const m of metrics) {
    console.log(`[ETECSA] ${m.metadata.node}: up=${m.up} latency=${m.latency_ms}ms loss=${m.ping_loss_pct}%${m.download_mbps != null ? ` dl=${m.download_mbps}Mbps` : ''}`);
  }
  return metrics;
}
