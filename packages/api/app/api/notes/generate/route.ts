import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { Db, ObjectId } from 'mongodb';

const OPENAI_API = 'https://api.openai.com/v1/chat/completions';
const SLACK_POST_MESSAGE = 'https://slack.com/api/chat.postMessage';

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get('type') || 'weekly';

  if (type !== 'weekly' && type !== 'outage') {
    return NextResponse.json({ error: 'type must be "weekly" or "outage"' }, { status: 400 });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  }

  const db = await getDb();

  try {
    const data = await gatherData(db, type);
    const prompt = type === 'outage'
      ? buildOutagePrompt(data)
      : buildWeeklyPrompt(data);

    const openaiRes = await fetch(OPENAI_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
        messages: [
          { role: 'developer', content: getSystemPrompt() },
          { role: 'user', content: prompt },
        ],
        max_completion_tokens: 1500,
      }),
    });

    const openaiJson = await openaiRes.json();
    const rawContent = openaiJson?.choices?.[0]?.message?.content;

    if (!rawContent) {
      return NextResponse.json({
        error: 'No content from OpenAI',
        detail: openaiJson?.error || openaiJson,
      }, { status: 502 });
    }

    // Fix markdown **bold** → Slack *bold*
    const content = rawContent.replace(/\*\*([^*]+)\*\*/g, '*$1*');

    const note = {
      type,
      content,
      generated_at: new Date(),
      data_summary: {
        period_hours: type === 'outage' ? 24 : 168,
        has_outages: data.outages.length > 0,
        avg_download: data.speedAvg?.download ?? null,
        avg_latency: data.speedAvg?.latency ?? null,
        test_count: data.crowdTestCount,
        apertura_index: data.aperturaIndex,
        apertura_status: data.aperturaStatus,
      },
      sent_to_slack: false,
    };

    const result = await db.collection('notes').insertOne(note);
    const savedNote = { ...note, _id: result.insertedId };

    // Send to Slack
    const slackResult = await sendToSlack(savedNote, db);

    return NextResponse.json({
      ok: true,
      note: savedNote,
      slack: slackResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// --- Slack ---

async function sendToSlack(note: Record<string, unknown> & { _id: ObjectId }, db: Db) {
  const botToken = process.env.SLACK_BOT_TOKEN;
  const channelId = process.env.SLACK_CHANNEL_ID;
  if (!botToken || !channelId) return { sent: false, reason: 'no credentials' };

  const icon = note.type === 'outage' ? ':rotating_light:' : ':bar_chart:';
  const prefix = note.type === 'outage' ? '*ALERTA DE INTERRUPCION*\n\n' : '*RESUMEN SEMANAL*\n\n';

  const res = await fetch(SLACK_POST_MESSAGE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: channelId,
      text: `${icon} ${prefix}${note.content}`,
      unfurl_links: false,
      unfurl_media: false,
    }),
  });

  const data = await res.json();
  if (data?.ok) {
    await db.collection('notes').updateOne(
      { _id: note._id },
      { $set: { sent_to_slack: true, slack_ts: data.ts } },
    );
    return { sent: true, ts: data.ts };
  }
  return { sent: false, error: data?.error };
}

// --- Data gathering (mirrors ETL logic) ---

interface DataResult {
  period: number;
  traffic: { avg: number | null; min: number | null; count: number };
  speedAvg: { download: number | null; upload: number | null; latency: number | null; globalDownload: number | null; globalLatency: number | null } | null;
  outages: Record<string, unknown>[];
  bgp: { avg: number | null; min: number | null };
  ioda: { max: number | null };
  ooni: { ok: number; confirmed: number; anomaly: number };
  crowdTestCount: number;
  crowdAvg: { download: number | null; upload: number | null; latency: number | null } | null;
  crowdByProvince: { province: string; avg_download: number; avg_latency: number; test_count: number }[];
  aperturaIndex: number;
  aperturaStatus: string;
}

async function gatherData(db: Db, type: string): Promise<DataResult> {
  const col = db.collection('metrics');
  const hours = type === 'outage' ? 24 : 168;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const [traffic, speed, outages, ooni, ripe, ioda, crowdTests] = await Promise.all([
    col.find({ 'metadata.source': 'cloudflare', timestamp: { $gte: since } }).sort({ timestamp: -1 }).limit(200).toArray(),
    col.find({ 'metadata.source': 'mlab', timestamp: { $gte: since } }).sort({ timestamp: -1 }).limit(14).toArray(),
    col.find({ 'metadata.source': 'cloudflare-alert', timestamp: { $gte: since } }).sort({ timestamp: -1 }).toArray(),
    col.find({ 'metadata.source': 'ooni', timestamp: { $gte: since } }).sort({ timestamp: -1 }).limit(30).toArray(),
    col.find({ 'metadata.source': 'ripe-stat', timestamp: { $gte: since } }).sort({ timestamp: -1 }).limit(50).toArray(),
    col.find({ 'metadata.source': 'ioda', timestamp: { $gte: since } }).sort({ timestamp: -1 }).limit(50).toArray(),
    col.find({ 'metadata.source': 'crowdsourced', timestamp: { $gte: since } }).sort({ timestamp: -1 }).toArray(),
  ]);

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const speedAvg = speed.length > 0 ? {
    download: avg(speed.map(s => s.download_speed_mbps as number)),
    upload: avg(speed.map(s => s.upload_speed_mbps as number)),
    latency: avg(speed.map(s => s.latency_ms as number)),
    globalDownload: avg(speed.filter(s => s.global_download_mbps).map(s => s.global_download_mbps as number)),
    globalLatency: avg(speed.filter(s => s.global_latency_ms).map(s => s.global_latency_ms as number)),
  } : null;

  const trafficAvg = traffic.length > 0 ? avg(traffic.map(t => t.traffic_score as number)) : null;
  const trafficMin = traffic.length > 0 ? Math.min(...traffic.map(t => t.traffic_score as number)) : null;
  const bgpAvg = ripe.length > 0 ? avg(ripe.map(r => r.bgp_visibility_pct as number)) : null;
  const bgpMin = ripe.length > 0 ? Math.min(...ripe.map(r => r.bgp_visibility_pct as number)) : null;
  const iodaMax = ioda.length > 0 ? Math.max(...ioda.map(i => i.outage_score as number)) : null;

  const ooniTotals = ooni.reduce((acc, d) => {
    acc.ok += (d.ok_count as number) || 0;
    acc.confirmed += (d.confirmed_count as number) || 0;
    acc.anomaly += (d.anomaly_count as number) || 0;
    return acc;
  }, { ok: 0, confirmed: 0, anomaly: 0 });

  const crowdTestCount = crowdTests.length;
  const crowdAvg = crowdTests.length > 0 ? {
    download: avg(crowdTests.map(t => t.download_mbps as number).filter(Boolean)),
    upload: avg(crowdTests.map(t => t.upload_mbps as number).filter(Boolean)),
    latency: avg(crowdTests.map(t => t.latency_ms as number).filter(Boolean)),
  } : null;

  // Province breakdown from crowdsourced tests
  const byProvince = await col.aggregate([
    { $match: { 'metadata.source': 'crowdsourced', timestamp: { $gte: since }, 'metadata.province_id': { $ne: null } } },
    { $group: {
      _id: '$metadata.province_id',
      avg_download: { $avg: '$download_mbps' },
      avg_latency: { $avg: '$latency_ms' },
      test_count: { $sum: 1 },
    }},
    { $sort: { avg_download: -1 } },
  ]).toArray();

  const PROVINCE_NAMES: Record<string, string> = {
    PRI: 'Pinar del Río', ART: 'Artemisa', HAB: 'La Habana', MAY: 'Mayabeque',
    MAT: 'Matanzas', CFG: 'Cienfuegos', VCL: 'Villa Clara', SSP: 'Sancti Spíritus',
    CAV: 'Ciego de Ávila', CMG: 'Camagüey', LTU: 'Las Tunas', HOL: 'Holguín',
    GRA: 'Granma', SCU: 'Santiago de Cuba', GTM: 'Guantánamo', IJV: 'Isla de la Juventud',
  };

  const crowdByProvince = byProvince.map(p => ({
    province: PROVINCE_NAMES[p._id as string] || p._id,
    avg_download: p.avg_download as number,
    avg_latency: p.avg_latency as number,
    test_count: p.test_count as number,
  }));

  // Indice de Apertura
  const iodaScore = (1 - (ioda.length > 0 ? (ioda[0].outage_score as number) : 0)) * 100;
  const bgpScore = (ripe.length > 0 ? (ripe[0].bgp_visibility_pct as number) : 1) * 100;
  const recentTraffic = traffic.slice(0, 6);
  const trafficScoreIdx = recentTraffic.length > 0
    ? recentTraffic.reduce((sum, d) => sum + ((d.traffic_score as number) || 0), 0) / recentTraffic.length
    : 50;
  const latestOoni = ooni[ooni.length - 1];
  const blockingRate = (latestOoni?.blocking_rate as number) ?? 0;
  const ooniScoreIdx = (1 - blockingRate) * 100;

  let crowdScoreIdx = 50;
  if (crowdTests.length > 0 && crowdAvg?.download != null) {
    const spdScore = Math.min(100, (crowdAvg.download / 5) * 100);
    const latPenalty = crowdAvg.latency != null ? Math.min(20, Math.max(0, (crowdAvg.latency - 200) / 15)) : 0;
    crowdScoreIdx = Math.max(0, spdScore - latPenalty);
  }
  const hasCrowd = crowdTests.length > 0;
  const hasCfOutage = outages.some(o => o.alert_type === 'outage' && !o.end_date);
  const cfOutageScore = hasCfOutage ? 0 : 100;

  const wIoda = hasCfOutage ? 0.15 : hasCrowd ? 0.25 : 0.30;
  const wBgp = hasCfOutage ? 0.10 : hasCrowd ? 0.20 : 0.25;
  const wTraffic = hasCfOutage ? 0.20 : hasCrowd ? 0.20 : 0.25;
  const wOoni = hasCfOutage ? 0.10 : hasCrowd ? 0.15 : 0.20;
  const wCrowd = hasCrowd ? (hasCfOutage ? 0.10 : 0.20) : 0;
  const wCfOutage = hasCfOutage ? 0.35 : 0;

  let composite = iodaScore * wIoda + bgpScore * wBgp + trafficScoreIdx * wTraffic
    + ooniScoreIdx * wOoni + crowdScoreIdx * wCrowd + cfOutageScore * wCfOutage;

  const dl = speed[0]?.download_speed_mbps as number | undefined;
  const lat = speed[0]?.latency_ms as number | undefined;
  let penalty = 0;
  if (dl != null && dl < 1) penalty += 3;
  if (lat != null && lat > 500) penalty += 2;
  composite = Math.max(0, Math.min(100, composite - penalty));

  const aperturaIndex = Math.round(composite);
  const aperturaStatus = aperturaIndex >= 70 ? 'OPERATIVO' : aperturaIndex >= 40 ? 'DEGRADADO' : 'BLOQUEADO';

  return {
    period: hours, traffic: { avg: trafficAvg, min: trafficMin, count: traffic.length },
    speedAvg, outages, bgp: { avg: bgpAvg, min: bgpMin }, ioda: { max: iodaMax },
    ooni: ooniTotals, crowdTestCount, crowdAvg, crowdByProvince, aperturaIndex, aperturaStatus,
  };
}

// --- Prompt building ---

function getSystemPrompt() {
  return `Eres un periodista de *elTOQUE* (eltoque.com) que cubre tecnología y telecomunicaciones en Cuba. Escribes notas para publicar en las redes sociales de *elTOQUE*, dirigidas al pueblo cubano.

Tu audiencia son cubanos de a pie: gente que usa Nauta, datos móviles, WiFi de ETECSA. No son técnicos. Quieren saber si el internet les va a funcionar, por qué está lento, o qué pasó con el apagón.

REGLAS EDITORIALES DE *elTOQUE*:
- Escribe en español correcto con todas las tildes (aún, más, qué, sí, también, está, conexión)
- Usa signos de apertura ¿? y ¡! siempre
- Cifras en formato numérico, miles separados con espacio (1 000, 10 000)
- Porcentajes con espacio: 70 %, no 70%
- Unidades sin punto ni plural: 6 Mbps, 147 ms
- *elTOQUE* siempre en cursiva/negrita, nunca "eltoque" ni "El Toque"
- Cargos en minúscula (el presidente, el ministro)
- Días y meses en minúscula
- Extranjerismos en cursiva cuando no hay equivalente

REGLAS DE CONTENIDO:
- Escribe en español cubano natural, como si le explicaras a un amigo que no sabe de tecnología
- En vez de "latencia de 147 ms" di "la conexión tarda casi el doble que en el resto del mundo"
- En vez de "visibilidad BGP" di "la red de Cuba se ve normal desde afuera" o "Cuba se desconectó parcialmente del internet mundial"
- El "tráfico HTTP" de Cloudflare es un valor relativo (0-100) que mide el volumen de tráfico de Cuba comparado con su propio máximo reciente. 100 = pico normal, 50 = la mitad del tráfico habitual, 25 = muy poco tráfico. NUNCA lo presentes como "68/100" ni como una calificación. Tradúcelo: un promedio de 68 significa "el tráfico estuvo al 68 % de lo habitual, bastante normal". Un mínimo de 39 significa "en el peor momento, el tráfico cayó a menos de la mitad de lo normal, probablemente por un corte eléctrico o una interrupción"
- En vez de "OONI detectó 97 bloqueos" di "se confirmaron casi 100 páginas web bloqueadas dentro de Cuba"
- Usa comparaciones con el promedio mundial para que la gente entienda ("mientras en el mundo la descarga promedio es de X Mbps, en Cuba apenas llega a Y")
- Sé directo y conciso (3-4 párrafos máximo)
- SIEMPRE abre con nuestro *Índice de Apertura de Internet* (de 0 a 100) y explica qué significa en lenguaje sencillo: 70+ = "internet funciona razonablemente", 40-69 = "internet está degradado, vas a tener problemas", menos de 40 = "internet está prácticamente caído"
- Si hubo apagones eléctricos o cortes, conéctalo con el impacto en la vida diaria (transferencias por Transfermóvil, WhatsApp, trabajo remoto, clases online, etc.)
- Título corto y llamativo para redes sociales
- FORMATO: texto plano para Slack. Para negrita usa UN solo asterisco: *texto* (NO uses **texto** que es Markdown y no funciona en Slack). Para cursiva usa _texto_. NUNCA uses doble asterisco **.
- Firma al final: "— Cuba Internet Monitor (internet.cubapk.com) | *elTOQUE*"
- No uses hashtags ni emojis excesivos, máximo 1-2 al inicio`;
}

function buildWeeklyPrompt(data: DataResult) {
  let p = `Genera un resumen semanal del estado de internet en Cuba basado en estos datos de los ultimos 7 dias:\n\n`;
  p += `*INDICE DE APERTURA DE INTERNET:* ${data.aperturaIndex}/100 — Estado: ${data.aperturaStatus}\n`;
  p += `(Indice compuesto: trafico HTTP, visibilidad BGP, IODA, censura OONI, velocidad crowdsourced. 70+=OPERATIVO, 40-69=DEGRADADO, <40=BLOQUEADO)\n\n`;

  if (data.speedAvg) {
    p += `*Velocidad (Cloudflare Radar):*\n`;
    p += `- Descarga Cuba: ${data.speedAvg.download?.toFixed(1)} Mbps (global: ${data.speedAvg.globalDownload?.toFixed(1)} Mbps)\n`;
    p += `- Subida Cuba: ${data.speedAvg.upload?.toFixed(1)} Mbps\n`;
    p += `- Latencia Cuba: ${data.speedAvg.latency?.toFixed(0)} ms (global: ${data.speedAvg.globalLatency?.toFixed(0)} ms)\n\n`;
  }
  p += `*Trafico HTTP (volumen relativo de Cuba, donde 100 = pico normal y por debajo de 25 es critico):* promedio ${data.traffic.avg?.toFixed(1) ?? 'N/A'}, minimo ${data.traffic.min?.toFixed(1) ?? 'N/A'}\n`;
  p += `*BGP (ETECSA AS27725):* visibilidad ${data.bgp.avg != null ? (data.bgp.avg * 100).toFixed(1) : 'N/A'}%, min ${data.bgp.min != null ? (data.bgp.min * 100).toFixed(1) : 'N/A'}%\n`;
  p += `*IODA:* score max interrupcion ${data.ioda.max?.toFixed(3) ?? 'N/A'} (0=normal, 1=apagon)\n`;
  p += `*Interrupciones:* ${data.outages.length}\n`;
  if (data.outages.length > 0) {
    for (const o of data.outages.slice(0, 5)) {
      p += `  - ${o.alert_type}: ${o.description || o.outage_cause || o.event_type || 'Sin desc'} (${o.start_date}${o.end_date ? ` — ${o.end_date}` : ', activa'})\n`;
    }
  }
  p += `*OONI:* OK=${data.ooni.ok}, Bloq=${data.ooni.confirmed}, Anom=${data.ooni.anomaly}\n`;
  if (data.crowdTestCount > 0 && data.crowdAvg) {
    p += `\n*Datos reportados por usuarios desde Cuba (${data.crowdTestCount} tests de velocidad esta semana):*\n`;
    p += `- Descarga promedio: ${data.crowdAvg.download?.toFixed(1)} Mbps, Subida: ${data.crowdAvg.upload?.toFixed(1)} Mbps, Latencia: ${data.crowdAvg.latency?.toFixed(0)} ms\n`;
    if (data.crowdByProvince.length > 0) {
      const best = data.crowdByProvince[0];
      const worst = data.crowdByProvince[data.crowdByProvince.length - 1];
      p += `- Mejor provincia: ${best.province} (${best.avg_download.toFixed(1)} Mbps, ${best.test_count} tests)\n`;
      if (worst.province !== best.province) {
        p += `- Peor provincia: ${worst.province} (${worst.avg_download.toFixed(1)} Mbps, ${worst.test_count} tests)\n`;
      }
    }
    p += `- IMPORTANTE: Invita a los lectores a hacer su propio test en https://internet.cubapk.com/speedtest para tener datos mas completos de cada provincia\n`;
  } else {
    p += `\n*Datos crowdsourced:* No hubo tests de velocidad esta semana. Invita a los lectores a hacer su propio test en https://internet.cubapk.com/speedtest\n`;
  }
  return p;
}

function buildOutagePrompt(data: DataResult) {
  let p = `URGENTE: Interrupcion de internet en Cuba. Nota breve sobre la situacion actual.\n\n`;
  p += `*INDICE DE APERTURA:* ${data.aperturaIndex}/100 — ${data.aperturaStatus}\n\n`;
  if (data.speedAvg) {
    p += `Descarga: ${data.speedAvg.download?.toFixed(1)} Mbps (global: ${data.speedAvg.globalDownload?.toFixed(1)}), Latencia: ${data.speedAvg.latency?.toFixed(0)} ms (global: ${data.speedAvg.globalLatency?.toFixed(0)})\n`;
  }
  p += `Trafico HTTP (volumen relativo, 100=pico normal, <25=critico): ${data.traffic.avg?.toFixed(1) ?? 'N/A'}, BGP: ${data.bgp.avg != null ? (data.bgp.avg * 100).toFixed(1) : 'N/A'}%\n`;
  return p;
}
