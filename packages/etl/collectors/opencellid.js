import { request } from 'undici';
import { gunzipSync } from 'node:zlib';
import { getDb } from '../db.js';

// Celdas de ETECSA (MCC 368) observadas por los colaboradores de OpenCelliD.
// Licencia CC BY-SA 4.0: cualquier vista que use estos datos debe acreditar a
// OpenCelliD. Las posiciones son estimadas a partir de mediciones (no son la
// ubicacion real de la torre) y la cobertura esta muy sesgada hacia La Habana.
const MCC = 368;
const DOWNLOAD_URL = 'https://opencellid.org/ocid/downloads';
// OpenCelliD limita las descargas diarias por token; el archivo se regenera
// una vez al dia, asi que no tiene sentido bajarlo mas a menudo (ni en cada
// reinicio del ETL).
const MIN_INTERVAL_MS = 20 * 60 * 60 * 1000;

const COLUMNS = ['radio', 'mcc', 'net', 'area', 'cell', 'unit', 'lon', 'lat', 'range', 'samples', 'changeable', 'created', 'updated', 'averageSignal'];

function parseRow(line) {
  const v = line.split(',');
  if (v.length < COLUMNS.length || v[0] === 'radio') return null;
  const row = Object.fromEntries(COLUMNS.map((c, i) => [c, v[i]]));
  const lon = Number(row.lon);
  const lat = Number(row.lat);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  const cell = Number(row.cell);
  return {
    radio: row.radio,
    mcc: Number(row.mcc),
    net: Number(row.net),
    area: Number(row.area),
    cell,
    // En LTE el ECI es eNB * 256 + sector: agrupa las celdas de una misma radiobase
    enb: row.radio === 'LTE' ? Math.floor(cell / 256) : null,
    lon,
    lat,
    range_m: Number(row.range),
    samples: Number(row.samples),
    created: new Date(Number(row.created) * 1000),
    updated: new Date(Number(row.updated) * 1000),
  };
}

export async function collectOpenCellid() {
  const token = process.env.OPENCELLID_TOKEN;
  if (!token) {
    console.log('[OpenCelliD] OPENCELLID_TOKEN not set, skipping');
    return;
  }

  const db = await getDb();
  const col = db.collection('cells');
  const last = await col.find().sort({ fetched_at: -1 }).limit(1).project({ fetched_at: 1 }).next();
  if (last && Date.now() - last.fetched_at.getTime() < MIN_INTERVAL_MS) {
    console.log(`[OpenCelliD] Last download at ${last.fetched_at.toISOString()}, skipping`);
    return;
  }

  const url = `${DOWNLOAD_URL}?token=${encodeURIComponent(token)}&type=mcc&file=${MCC}.csv.gz`;
  const res = await request(url, { signal: AbortSignal.timeout(60000) });
  const body = Buffer.from(await res.body.arrayBuffer());
  if (res.statusCode >= 400) throw new Error(`HTTP ${res.statusCode}`);
  // Si el token es invalido o se agoto el limite, responde 200 con un mensaje de texto
  if (body[0] !== 0x1f || body[1] !== 0x8b) {
    throw new Error(`Unexpected response: ${body.toString('utf8', 0, 200)}`);
  }

  const cells = gunzipSync(body).toString('utf8').split('\n').map(parseRow).filter(Boolean);
  if (!cells.length) throw new Error('Empty dump');

  const fetchedAt = new Date();
  const ops = cells.map(c => ({
    updateOne: {
      filter: { radio: c.radio, mcc: c.mcc, net: c.net, area: c.area, cell: c.cell },
      update: { $set: { ...c, fetched_at: fetchedAt } },
      upsert: true,
    },
  }));
  await col.createIndex({ radio: 1, mcc: 1, net: 1, area: 1, cell: 1 }, { unique: true });
  await col.createIndex({ fetched_at: -1 });
  const result = await col.bulkWrite(ops, { ordered: false });
  console.log(`[OpenCelliD] ${cells.length} cells (${result.upsertedCount} new, ${result.modifiedCount} updated)`);
}
