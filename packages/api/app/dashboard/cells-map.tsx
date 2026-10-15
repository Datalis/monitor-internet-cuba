'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap, GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { speedColor, type ProvinceData } from './cuba-map';

const CUBA_BOUNDS: [number, number, number, number] = [-85.0, 19.8, -74.1, 23.3];
// Por debajo de este zoom las torres cercanas se agrupan en clusters
const CLUSTER_MAX_ZOOM = 11;
// A partir de este zoom las torres se ven sueltas y emiten la onda de alcance
const WAVE_MIN_ZOOM = 12;
const WAVE_PERIOD_MS = 2800;
// Solo emiten onda las torres mas cercanas al centro de la vista: en La Habana
// hay cientos y todas a la vez forman una mancha
const WAVE_MAX_TOWERS = 6;
// Onda sin borde, de un solo color y casi transparente: insinua el alcance sin tapar el mapa
const WAVE_COLOR = '#e2e8f0';
const WAVE_MAX_OPACITY = 0.05;

// range_m: alcance tipico ilustrativo en zona urbana/suburbana. El real depende
// de la banda, la altura del mastil, la potencia y el terreno.
const RADIOS = [
  { id: 'LTE', label: '4G', color: '#e879f9', range_m: 1500 },
  { id: 'UMTS', label: '3G', color: '#22d3ee', range_m: 2000 },
  { id: 'GSM', label: '2G', color: '#f8fafc', range_m: 3500 },
] as const;
type RadioId = (typeof RADIOS)[number]['id'];
const RADIO_BY_ID = Object.fromEntries(RADIOS.map(r => [r.id, r])) as Record<RadioId, (typeof RADIOS)[number]>;

interface ProvinceFeature {
  type: 'Feature';
  properties: { id: string; name: string; color?: string };
  geometry: GeoJSON.Geometry;
}

interface Site {
  radio: RadioId;
  area: number;
  enb: number | null;
  cell: number | null;
  cells: number;
  samples: number;
  range_m: number;
  updated: string;
}

type Tower = GeoJSON.Feature<GeoJSON.Point, { id: number; techs: RadioId[]; sites: Site[] }>;

interface TowersResponse {
  type: 'FeatureCollection';
  fetched_at: string | null;
  cell_count: number;
  features: Tower[];
}

function colorProvinces(features: ProvinceFeature[], data: ProvinceData[]): GeoJSON.FeatureCollection {
  const byId = new Map(data.map(d => [d.province_id, d]));
  return {
    type: 'FeatureCollection',
    features: features.map(f => ({
      ...f,
      properties: { ...f.properties, color: speedColor(byId.get(f.properties.id)?.avg_download) },
    })),
  };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

function iconKey(techs: RadioId[]) {
  return `tower-${techs.join('-')}`;
}

// Todas las combinaciones de tecnologias, en el orden de RADIOS
function techCombos(): RadioId[][] {
  const ids = RADIOS.map(r => r.id);
  const out: RadioId[][] = [];
  for (let mask = 1; mask < 1 << ids.length; mask++) out.push(ids.filter((_, i) => mask & (1 << i)));
  return out;
}

// Mastil con antena y ondas, centrado en (x, y) y escalado por k
function drawMast(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, color: string, waves: boolean) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.lineWidth = 3 * k;
  ctx.beginPath();
  ctx.moveTo(x - 7 * k, y + 15 * k);
  ctx.lineTo(x, y - 4 * k);
  ctx.lineTo(x + 7 * k, y + 15 * k);
  ctx.moveTo(x - 4 * k, y + 7 * k);
  ctx.lineTo(x + 4 * k, y + 7 * k);
  ctx.stroke();

  const top = y - 7 * k;
  ctx.beginPath();
  ctx.arc(x, top, 3.5 * k, 0, Math.PI * 2);
  ctx.fill();

  if (!waves) return;
  ctx.lineWidth = 2.5 * k;
  for (const r of [8, 13]) {
    ctx.beginPath();
    ctx.arc(x, top, r * k, -Math.PI / 4, Math.PI / 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, top, r * k, (3 * Math.PI) / 4, (5 * Math.PI) / 4);
    ctx.stroke();
  }
}

// Icono de torre dibujado en canvas a 2x. Una tecnologia: un mastil con ondas en
// su color. Varias: una placa mas ancha con un mastil por tecnologia.
function towerIcon(techs: RadioId[]): ImageData {
  const multi = techs.length > 1;
  const h = 56;
  const w = multi ? 28 + techs.length * 24 : 56;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const r = 25;
  ctx.beginPath();
  ctx.moveTo(r + 3, 3);
  ctx.arcTo(w - 3, 3, w - 3, h - 3, r);
  ctx.arcTo(w - 3, h - 3, 3, h - 3, r);
  ctx.arcTo(3, h - 3, 3, 3, r);
  ctx.arcTo(3, 3, w - 3, 3, r);
  ctx.closePath();
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = multi ? '#cbd5e1' : RADIO_BY_ID[techs[0]].color;
  ctx.stroke();

  if (!multi) {
    drawMast(ctx, w / 2, h / 2, 1, RADIO_BY_ID[techs[0]].color, true);
  } else {
    const step = (w - 26) / techs.length;
    techs.forEach((t, i) => drawMast(ctx, 13 + step * (i + 0.5), h / 2 + 1, 0.95, RADIO_BY_ID[t].color, false));
  }
  return ctx.getImageData(0, 0, w, h);
}

function towerPopup(sites: Site[]) {
  const techs = RADIOS.filter(r => sites.some(s => s.radio === r.id));
  const MAX_ROWS = 8;
  const rows = sites.slice(0, MAX_ROWS).map(s => {
    const r = RADIO_BY_ID[s.radio];
    const dot = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${r.color};margin-right:6px"></span>`;
    const id = s.radio === 'LTE' && s.enb != null
      ? `eNB ${s.enb} · ${s.cells} ${s.cells === 1 ? 'sector' : 'sectores'}`
      : `Cell ID ${s.cell}`;
    return `${dot}<strong>${r.label}</strong> · ${id} · ${s.samples} med.`;
  });
  if (sites.length > MAX_ROWS) rows.push(`<span style="color:#64748b">y ${sites.length - MAX_ROWS} antenas más</span>`);
  const lastSeen = sites.reduce((m, s) => (s.updated > m ? s.updated : m), sites[0].updated);
  const title = sites.length === 1 ? 'Antena' : `Torre con ${sites.length} antenas`;
  return `<div style="font-weight:600;margin-bottom:4px">${title} · ${techs.map(t => t.label).join(' + ')}</div>`
    + rows.join('<br>')
    + `<div style="color:#64748b;margin-top:4px">Visto: ${fmtDate(lastSeen)}</div>`;
}

// Torres visibles segun el filtro: el icono refleja solo las tecnologias activas
function visibleTowers(towers: Tower[], radios: string[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const t of towers) {
    const techs = t.properties.techs.filter(r => radios.includes(r));
    if (!techs.length) continue;
    features.push({ type: 'Feature', geometry: t.geometry, properties: { id: t.properties.id, icon: iconKey(techs) } });
  }
  return { type: 'FeatureCollection', features };
}

// Las torres (con alguna tecnologia activa) mas cercanas a un punto
function nearestTowers(towers: Tower[], radios: string[], center: { lng: number; lat: number }, n: number) {
  const kx = Math.cos((center.lat * Math.PI) / 180);
  return towers
    .filter(t => t.properties.techs.some(r => radios.includes(r)))
    .map(t => {
      const [lng, lat] = t.geometry.coordinates;
      return { t, d: Math.hypot((lng - center.lng) * kx, lat - center.lat) };
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map(x => x.t);
}

// Un punto por torre y tecnologia para la onda. px12 es el alcance en pixeles a
// zoom 12 en esa latitud; la capa lo escala con el zoom.
function waveFeatures(towers: Tower[], radios: string[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const t of towers) {
    const [, lat] = t.geometry.coordinates;
    const metersPerPx12 = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** 12);
    for (const tech of t.properties.techs) {
      if (!radios.includes(tech)) continue;
      const r = RADIO_BY_ID[tech];
      features.push({
        type: 'Feature',
        geometry: t.geometry,
        properties: { px12: r.range_m / metersPerPx12 },
      });
    }
  }
  // Las ondas mas grandes (2G) debajo de las pequenas
  features.sort((a, b) => (b.properties!.px12 as number) - (a.properties!.px12 as number));
  return { type: 'FeatureCollection', features };
}

function waveRadius(phase: number) {
  // Escala exponencial base 2: el radio en pixeles se duplica con cada nivel de zoom
  return ['interpolate', ['exponential', 2], ['zoom'],
    0, ['*', ['get', 'px12'], phase / 4096],
    22, ['*', ['get', 'px12'], phase * 1024],
  ] as unknown as number;
}

export default function CellsMap({ data }: { data: ProvinceData[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const provincesRef = useRef<ProvinceFeature[] | null>(null);
  const towersRef = useRef<Tower[] | null>(null);
  const dataRef = useRef(data);
  const radiosRef = useRef<string[]>(RADIOS.map(r => r.id));
  const [radios, setRadios] = useState<string[]>(RADIOS.map(r => r.id));
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [meta, setMeta] = useState<{ fetchedAt: string | null; cells: number; towers: number } | null>(null);
  const [hover, setHover] = useState<{ name: string; d?: ProvinceData } | null>(null);
  const [wavesOn, setWavesOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  dataRef.current = data;
  radiosRef.current = radios;

  // Recalcula que torres emiten onda segun el centro de la vista
  function refreshWaves() {
    const map = mapRef.current;
    const towers = towersRef.current;
    const src = map?.getSource('waves') as GeoJSONSource | undefined;
    if (!map || !towers || !src) return;
    const near = map.getZoom() >= WAVE_MIN_ZOOM
      ? nearestTowers(towers, radiosRef.current, map.getCenter(), WAVE_MAX_TOWERS)
      : [];
    src.setData(waveFeatures(near, radiosRef.current));
  }

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    let frame = 0;

    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      if (cancelled || !containerRef.current) return;

      map = new maplibregl.Map({
        container: containerRef.current,
        style: 'https://tiles.openfreemap.org/styles/dark',
        bounds: CUBA_BOUNDS,
        fitBoundsOptions: { padding: containerRef.current.clientWidth < 500 ? 2 : 12 },
        // Los creditos completos van debajo del mapa; aqui solo el boton (i)
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        // Rueda/un dedo siguen haciendo scroll de la pagina; zoom con Ctrl/Cmd o dos dedos
        cooperativeGestures: true,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

      const [provinces, towers] = await Promise.all([
        fetch('/geo/cuba-provinces.geojson').then(r => r.json()),
        fetch('/api/cells').then(r => r.json() as Promise<TowersResponse>),
        new Promise<void>(resolve => map!.once('load', () => resolve())),
      ]).catch(err => {
        if (!cancelled) setError('No se pudieron cargar las antenas');
        throw err;
      });
      if (cancelled) return;

      // MapLibre abre la atribucion compacta al cargar; la dejamos plegada
      containerRef.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');

      provincesRef.current = provinces.features;
      towersRef.current = towers.features;
      setMeta({ fetchedAt: towers.fetched_at, cells: towers.cell_count, towers: towers.features.length });
      const c: Record<string, number> = {};
      for (const t of towers.features) for (const s of t.properties.sites) c[s.radio] = (c[s.radio] || 0) + 1;
      setCounts(c);

      for (const combo of techCombos()) map.addImage(iconKey(combo), towerIcon(combo), { pixelRatio: 2 });

      map.addSource('provinces', { type: 'geojson', data: colorProvinces(provinces.features, dataRef.current) });
      map.addLayer({
        id: 'provinces-fill',
        type: 'fill',
        source: 'provinces',
        // Los poligonos estan simplificados (~400 m): al acercarse se desvanecen
        // para que no tapen el mapa base con bordes toscos.
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.35, 11, 0.12],
        },
      });
      map.addLayer({
        id: 'provinces-line',
        type: 'line',
        source: 'provinces',
        paint: {
          'line-color': '#ffffff',
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 11, 0.15],
          'line-width': 1,
        },
      });

      // Onda expansiva: dos anillos desfasados medio periodo por torre y tecnologia
      map.addSource('waves', { type: 'geojson', data: waveFeatures([], RADIOS.map(r => r.id)) });
      for (const id of ['wave-a', 'wave-b']) {
        map.addLayer({
          id,
          type: 'circle',
          source: 'waves',
          minzoom: WAVE_MIN_ZOOM,
          paint: {
            'circle-radius': waveRadius(1),
            'circle-color': WAVE_COLOR,
            'circle-opacity': 0,
            'circle-pitch-alignment': 'map',
          },
        });
      }

      map.addSource('towers', {
        type: 'geojson',
        data: visibleTowers(towers.features, RADIOS.map(r => r.id)),
        cluster: true,
        clusterMaxZoom: CLUSTER_MAX_ZOOM,
        clusterRadius: 40,
      });
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'towers',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#0f172a',
          'circle-opacity': 0.9,
          'circle-stroke-color': '#cbd5e1',
          'circle-stroke-width': 1.5,
          'circle-radius': ['step', ['get', 'point_count'], 13, 10, 16, 50, 20, 150, 25],
        },
      });
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'towers',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#e2e8f0' },
      });
      map.addLayer({
        id: 'towers',
        type: 'symbol',
        source: 'towers',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 0.6, 12, 0.85, 15, 1],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });

      map.on('click', 'clusters', async (e: MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f) return;
        const src = map!.getSource('towers') as GeoJSONSource;
        const zoom = await src.getClusterExpansionZoom(f.properties.cluster_id);
        map!.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
      });
      map.on('click', 'towers', (e: MapLayerMouseEvent) => {
        const f = e.features?.[0];
        const tower = towersRef.current?.find(t => t.properties.id === f?.properties.id);
        if (!f || !tower) return;
        new maplibregl.Popup({ closeButton: false, maxWidth: '300px' })
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(towerPopup(tower.properties.sites))
          .addTo(map!);
      });
      for (const layer of ['clusters', 'towers']) {
        map.on('mouseenter', layer, () => { map!.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { map!.getCanvas().style.cursor = ''; });
      }

      // Hover en escritorio, toque en movil
      const showProvince = (e: MapLayerMouseEvent) => {
        const p = e.features?.[0]?.properties as { id: string; name: string } | undefined;
        if (p) setHover({ name: p.name, d: dataRef.current.find(d => d.province_id === p.id) });
      };
      map.on('mousemove', 'provinces-fill', showProvince);
      map.on('click', 'provinces-fill', showProvince);
      map.on('mouseleave', 'provinces-fill', () => setHover(null));

      const onMoveEnd = () => {
        setWavesOn(map!.getZoom() >= WAVE_MIN_ZOOM);
        refreshWaves();
      };
      map.on('moveend', onMoveEnd);
      onMoveEnd();

      // Con movimiento reducido el alcance se muestra como un anillo fijo
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        map.setPaintProperty('wave-a', 'circle-opacity', WAVE_MAX_OPACITY);
        return;
      }
      const animate = (now: number) => {
        frame = requestAnimationFrame(animate);
        if (!map || map.getZoom() < WAVE_MIN_ZOOM) return;
        const base = (now % WAVE_PERIOD_MS) / WAVE_PERIOD_MS;
        [['wave-a', base], ['wave-b', (base + 0.5) % 1]].forEach(([id, t]) => {
          const phase = t as number;
          // Crece rapido al principio y frena al llegar al alcance (ease-out)
          const eased = 1 - (1 - phase) ** 2;
          map!.setPaintProperty(id as string, 'circle-radius', waveRadius(eased));
          map!.setPaintProperty(id as string, 'circle-opacity', WAVE_MAX_OPACITY * (1 - phase));
        });
      };
      frame = requestAnimationFrame(animate);
    })().catch(err => console.error('Cells map failed:', err));

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Recolorear las provincias cuando el dashboard refresca los datos
  useEffect(() => {
    const src = mapRef.current?.getSource('provinces') as GeoJSONSource | undefined;
    if (src && provincesRef.current) src.setData(colorProvinces(provincesRef.current, data));
  }, [data]);

  // El filtro va sobre los datos (no sobre la capa) para que los clusters se recalculen
  useEffect(() => {
    const map = mapRef.current;
    const towers = towersRef.current;
    if (!map || !towers) return;
    (map.getSource('towers') as GeoJSONSource | undefined)?.setData(visibleTowers(towers, radios));
    refreshWaves();
  }, [radios]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleRadio(id: string) {
    setRadios(rs => (rs.includes(id) ? rs.filter(r => r !== id) : [...rs, id]));
  }

  const hoverBox = hover && (
    <>
      <div style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: 4 }}>{hover.name}</div>
      {hover.d ? (
        <>
          <div style={{ color: '#94a3b8' }}>Descarga: <span style={{ color: '#e2e8f0' }}>{hover.d.avg_download.toFixed(1)} Mbps</span></div>
          <div style={{ color: '#64748b', marginTop: 4 }}>{hover.d.test_count} tests</div>
        </>
      ) : (
        <div style={{ color: '#64748b' }}>Sin datos de velocidad</div>
      )}
    </>
  );

  const linkStyle = { color: '#94a3b8' };

  return (
    <div>
      <style>{`
        .cells-map .maplibregl-popup-content { background: #0f172a; color: #e2e8f0; font-size: 12px; line-height: 1.5; border-radius: 8px; padding: 8px 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
        .cells-map .maplibregl-popup-tip { border-top-color: #0f172a; border-bottom-color: #0f172a; }
        .cells-map .maplibregl-ctrl-attrib { background: rgba(15,23,42,0.8); color: #94a3b8; }
        .cells-map .maplibregl-ctrl-attrib a { color: #cbd5e1; }
        .cells-map-canvas { width: 100%; height: clamp(300px, 45vw, 480px); border-radius: 8px; overflow: hidden; }
        .cells-hover-inline { display: none; }
        @media (max-width: 640px) {
          /* En movil el mapa ocupa casi todo el ancho de la tarjeta */
          .cells-map { margin: 0 -12px; }
          .cells-map-canvas { height: 320px; border-radius: 4px; }
          .cells-hover-overlay { display: none; }
          .cells-hover-inline { display: block; }
        }
      `}</style>
      <div className="cells-map" style={{ position: 'relative' }}>
        <div ref={containerRef} className="cells-map-canvas" />
        {hover && (
          <div className="cells-hover-overlay" style={{
            position: 'absolute', top: 8, right: 8, background: '#0f172a',
            borderRadius: 8, padding: '8px 12px', fontSize: 12, pointerEvents: 'none',
          }}>
            {hoverBox}
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>{error}</div>
        )}
      </div>
      {hover && (
        <div className="cells-hover-inline" style={{ background: '#0f172a', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginTop: 8 }}>
          {hoverBox}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8, fontSize: 11 }}>
        {RADIOS.map(r => {
          const on = radios.includes(r.id);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => toggleRadio(r.id)}
              aria-pressed={on}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999,
                border: '1px solid #334155', background: on ? '#0f172a' : 'transparent',
                color: on ? '#e2e8f0' : '#64748b', cursor: 'pointer', fontSize: 11,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, opacity: on ? 1 : 0.3 }} />
              {r.label} ({counts[r.id] ?? 0})
            </button>
          );
        })}
      </div>
      <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 8 }}>
        {wavesOn
          ? <>Ondas: alcance típico simulado de las torres más cercanas al centro del mapa · {RADIOS.map(r => `${r.label} ~${(r.range_m / 1000).toLocaleString('es')} km`).join(' · ')}</>
          : <>Acércate a una zona para ver el alcance simulado de las antenas cercanas.</>}
      </div>
      <div style={{ color: '#64748b', fontSize: 10, marginTop: 6, lineHeight: 1.5 }}>
        {meta ? `${meta.towers} torres (${meta.cells} celdas)` : 'Torres'} de ETECSA observadas por colaboradores de OpenCelliD.
        Cada icono agrupa las antenas a menos de 100 m; los iconos con varios mástiles combinan tecnologías.
        La posición es estimada a partir de mediciones, no es la ubicación real de la antena, y la cobertura es
        incompleta (muy concentrada en La Habana). El alcance de las ondas es ilustrativo: el real depende de la banda,
        la altura de la antena y el terreno.
        {meta?.fetchedAt && <> Actualizado: {fmtDate(meta.fetchedAt)}.</>}
        <br />
        Celdas © <a href="https://opencellid.org" target="_blank" rel="noopener" style={linkStyle}>OpenCelliD</a> (CC BY-SA 4.0)
        · Provincias © <a href="https://www.geoboundaries.org" target="_blank" rel="noopener" style={linkStyle}>geoBoundaries</a>
        · Mapa © <a href="https://openfreemap.org" target="_blank" rel="noopener" style={linkStyle}>OpenFreeMap</a>,
        {' '}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" style={linkStyle}>OpenStreetMap</a>
      </div>
    </div>
  );
}
