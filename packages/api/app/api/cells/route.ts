import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

// OpenCelliD solo publica celdas vistas en los ultimos 18 meses; aplicamos el
// mismo corte para que las celdas que dejan de aparecer en el dump se caigan.
const MAX_AGE_MS = 548 * 24 * 60 * 60 * 1000;

interface CellDoc {
  radio: string;
  area: number;
  cell: number;
  enb: number | null;
  lon: number;
  lat: number;
  range_m: number;
  samples: number;
  updated: Date;
  fetched_at: Date;
}

// Una "torre" por radiobase: en LTE las celdas (sectores) de un mismo eNB se
// agrupan y su posicion es la media ponderada por mediciones. En 3G/2G el
// dump no permite saber que celdas comparten emplazamiento, asi que cada celda
// es su propio punto.
function toSites(cells: CellDoc[]) {
  const groups = new Map<string, CellDoc[]>();
  for (const c of cells) {
    const key = c.radio === 'LTE' && c.enb != null ? `LTE:${c.enb}` : `${c.radio}:${c.area}:${c.cell}`;
    const g = groups.get(key);
    if (g) g.push(c); else groups.set(key, [c]);
  }

  return [...groups.values()].map(g => {
    const weight = g.reduce((s, c) => s + Math.max(c.samples, 1), 0);
    const first = g[0];
    return {
      lon: g.reduce((s, c) => s + c.lon * Math.max(c.samples, 1), 0) / weight,
      lat: g.reduce((s, c) => s + c.lat * Math.max(c.samples, 1), 0) / weight,
      radio: first.radio,
      area: first.area,
      enb: first.radio === 'LTE' ? first.enb : null,
      cell: g.length === 1 ? first.cell : null,
      cells: g.length,
      samples: g.reduce((s, c) => s + c.samples, 0),
      range_m: Math.max(...g.map(c => c.range_m)),
      updated: new Date(Math.max(...g.map(c => c.updated.getTime()))),
    };
  });
}

type Site = ReturnType<typeof toSites>[number];

// Radio de agrupacion: 2G, 3G y 4G suelen compartir mastil, y los sectores 3G
// de una misma torre aparecen como celdas separadas. Todo lo que cae a menos de
// esta distancia se muestra como una sola torre.
const TOWER_RADIUS_M = 100;

function distanceM(a: { lon: number; lat: number }, b: { lon: number; lat: number }) {
  const kx = 111320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot((a.lon - b.lon) * kx, (a.lat - b.lat) * 110540);
}

// Agrupacion voraz: las antenas con mas mediciones (posicion mas fiable) hacen
// de ancla y las demas se suman a la torre mas cercana dentro del radio.
function toTowers(sites: Site[]) {
  const towers: { anchor: Site; sites: Site[] }[] = [];
  for (const s of [...sites].sort((a, b) => b.samples - a.samples)) {
    let best: (typeof towers)[number] | null = null;
    let bestD = TOWER_RADIUS_M;
    for (const t of towers) {
      const d = distanceM(t.anchor, s);
      if (d <= bestD) { best = t; bestD = d; }
    }
    if (best) best.sites.push(s); else towers.push({ anchor: s, sites: [s] });
  }

  const order = ['LTE', 'UMTS', 'GSM'];
  return towers.map((t, i) => {
    const weight = t.sites.reduce((s, x) => s + Math.max(x.samples, 1), 0);
    const lon = t.sites.reduce((s, x) => s + x.lon * Math.max(x.samples, 1), 0) / weight;
    const lat = t.sites.reduce((s, x) => s + x.lat * Math.max(x.samples, 1), 0) / weight;
    const techs = order.filter(r => t.sites.some(s => s.radio === r));
    return {
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5] },
      properties: {
        id: i,
        techs,
        sites: t.sites
          .sort((a, b) => order.indexOf(a.radio) - order.indexOf(b.radio) || b.samples - a.samples)
          .map(({ lon: _lon, lat: _lat, ...rest }) => rest),
      },
    };
  });
}

export async function GET() {
  const db = await getDb();
  const since = new Date(Date.now() - MAX_AGE_MS);

  const cells = await db.collection<CellDoc>('cells')
    .find({ mcc: 368, updated: { $gte: since } })
    .project<CellDoc>({ _id: 0, radio: 1, area: 1, cell: 1, enb: 1, lon: 1, lat: 1, range_m: 1, samples: 1, updated: 1, fetched_at: 1 })
    .toArray();

  const fetchedAt = cells.reduce<Date | null>((max, c) => (!max || c.fetched_at > max ? c.fetched_at : max), null);

  return NextResponse.json({
    type: 'FeatureCollection',
    fetched_at: fetchedAt,
    cell_count: cells.length,
    features: toTowers(toSites(cells)),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
