import { getDb } from '../db.js';
import { fetchJson } from '../http.js';

const OPENAI_API = 'https://api.openai.com/v1/chat/completions';
const NOTES_COLLECTION = 'notes';

/**
 * Gathers dashboard data for the given time range and generates an AI note.
 * type: 'weekly' | 'outage'
 */
export async function generateNote(type = 'weekly', outageContext = null) {
  const token = process.env.OPENAI_API_KEY;
  if (!token) {
    console.warn('[AI Notes] No OPENAI_API_KEY configured, skipping');
    return null;
  }

  const db = await getDb();

  try {
    const data = await gatherData(db, type);

    const prompt = type === 'outage'
      ? buildOutagePrompt(data, outageContext)
      : buildWeeklyPrompt(data);

    console.log(`[AI Notes] Generating ${type} note...`);

    const response = await fetchJson(OPENAI_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
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

    const rawContent = response?.choices?.[0]?.message?.content;
    if (!rawContent) {
      console.warn('[AI Notes] No content in OpenAI response');
      return null;
    }

    // Fix markdown **bold** → Slack *bold*
    const content = rawContent.replace(/\*\*([^*]+)\*\*/g, '*$1*');

    // Store note in DB
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

    await db.collection(NOTES_COLLECTION).insertOne(note);
    console.log(`[AI Notes] ${type} note saved to DB`);

    // Send to Slack
    await sendToSlack(note);

    return note;
  } catch (err) {
    console.error(`[AI Notes] Error generating ${type} note:`, err.message);
    return null;
  }
}

/**
 * Check for new outages and generate an immediate note if found.
 * Called frequently (e.g. every 15 min) — only triggers if there's a new outage
 * that hasn't been reported yet.
 */
export async function checkAndReportOutage() {
  const db = await getDb();
  const col = db.collection('metrics');

  // Look for cloudflare-alert outages in the last hour that we haven't reported
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentOutages = await col.find({
    'metadata.source': 'cloudflare-alert',
    alert_type: 'outage',
    timestamp: { $gte: oneHourAgo },
  }).sort({ timestamp: -1 }).toArray();

  if (recentOutages.length === 0) return null;

  // Check if we already generated a note for this outage
  const notesCol = db.collection(NOTES_COLLECTION);
  const latestOutageNote = await notesCol.findOne(
    { type: 'outage' },
    { sort: { generated_at: -1 } },
  );

  // Don't generate another outage note within 2 hours of the last one
  if (latestOutageNote) {
    const hoursSinceLastNote = (Date.now() - latestOutageNote.generated_at.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastNote < 2) {
      return null;
    }
  }

  // Also check IODA for outage detection
  const latestIoda = await col.findOne(
    { 'metadata.source': 'ioda' },
    { sort: { timestamp: -1 } },
  );
  const iodaDetected = latestIoda?.outage_detected === true;

  // Also check BGP visibility
  const latestRipe = await col.findOne(
    { 'metadata.source': 'ripe-stat' },
    { sort: { timestamp: -1 } },
  );
  const lowVisibility = (latestRipe?.bgp_visibility_pct ?? 1) < 0.7;

  if (!recentOutages.length && !iodaDetected && !lowVisibility) return null;

  const outage = recentOutages[0];
  const context = {
    alert_type: outage?.alert_type,
    outage_cause: outage?.outage_cause,
    outage_type: outage?.outage_type,
    description: outage?.description,
    start_date: outage?.start_date,
    ioda_detected: iodaDetected,
    ioda_score: latestIoda?.outage_score,
    bgp_visibility: latestRipe?.bgp_visibility_pct,
    low_visibility: lowVisibility,
  };

  console.log('[AI Notes] New outage detected, generating note...');
  return generateNote('outage', context);
}

/**
 * Generate weekly summary note. Called once a week.
 */
export async function generateWeeklyNote() {
  return generateNote('weekly');
}

// --- Data gathering ---

async function gatherData(db, type) {
  const col = db.collection('metrics');
  const hours = type === 'outage' ? 24 : 168; // 1 day for outage, 7 days for weekly
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  // Gather all relevant data in parallel
  const [traffic, speed, outages, ooni, ripe, ioda, crowdTests] = await Promise.all([
    // Cloudflare traffic scores
    col.find({ 'metadata.source': 'cloudflare', timestamp: { $gte: since } })
      .sort({ timestamp: -1 }).limit(200).toArray(),

    // Speed/latency data (Cuba + global)
    col.find({ 'metadata.source': 'mlab', timestamp: { $gte: since } })
      .sort({ timestamp: -1 }).limit(14).toArray(),

    // Cloudflare alerts
    col.find({ 'metadata.source': 'cloudflare-alert', timestamp: { $gte: since } })
      .sort({ timestamp: -1 }).toArray(),

    // OONI blocking data
    col.find({ 'metadata.source': 'ooni', timestamp: { $gte: since } })
      .sort({ timestamp: -1 }).limit(30).toArray(),

    // RIPE BGP
    col.find({ 'metadata.source': 'ripe-stat', timestamp: { $gte: since } })
      .sort({ timestamp: -1 }).limit(50).toArray(),

    // IODA
    col.find({ 'metadata.source': 'ioda', timestamp: { $gte: since } })
      .sort({ timestamp: -1 }).limit(50).toArray(),

    // Crowdsourced speed tests
    col.find({ 'metadata.source': 'crowdsourced', timestamp: { $gte: since } })
      .sort({ timestamp: -1 }).toArray(),
  ]);

  // Compute averages
  const speedAvg = speed.length > 0 ? {
    download: avg(speed.map(s => s.download_speed_mbps)),
    upload: avg(speed.map(s => s.upload_speed_mbps)),
    latency: avg(speed.map(s => s.latency_ms)),
    globalDownload: avg(speed.filter(s => s.global_download_mbps).map(s => s.global_download_mbps)),
    globalLatency: avg(speed.filter(s => s.global_latency_ms).map(s => s.global_latency_ms)),
  } : null;

  const trafficAvg = traffic.length > 0 ? avg(traffic.map(t => t.traffic_score)) : null;
  const trafficMin = traffic.length > 0 ? Math.min(...traffic.map(t => t.traffic_score)) : null;

  const bgpAvg = ripe.length > 0 ? avg(ripe.map(r => r.bgp_visibility_pct)) : null;
  const bgpMin = ripe.length > 0 ? Math.min(...ripe.map(r => r.bgp_visibility_pct)) : null;

  const iodaMax = ioda.length > 0 ? Math.max(...ioda.map(i => i.outage_score)) : null;

  // OONI blocking stats
  const ooniTotals = ooni.reduce((acc, d) => {
    acc.ok += d.ok_count || 0;
    acc.confirmed += d.confirmed_count || 0;
    acc.anomaly += d.anomaly_count || 0;
    return acc;
  }, { ok: 0, confirmed: 0, anomaly: 0 });

  // Crowdsourced stats
  const crowdTestCount = crowdTests.length;
  const crowdAvg = crowdTests.length > 0 ? {
    download: avg(crowdTests.map(t => t.download_mbps).filter(Boolean)),
    upload: avg(crowdTests.map(t => t.upload_mbps).filter(Boolean)),
    latency: avg(crowdTests.map(t => t.latency_ms).filter(Boolean)),
  } : null;

  // Province breakdown from crowdsourced tests
  const PROVINCE_NAMES = {
    PRI: 'Pinar del Río', ART: 'Artemisa', HAB: 'La Habana', MAY: 'Mayabeque',
    MAT: 'Matanzas', CFG: 'Cienfuegos', VCL: 'Villa Clara', SSP: 'Sancti Spíritus',
    CAV: 'Ciego de Ávila', CMG: 'Camagüey', LTU: 'Las Tunas', HOL: 'Holguín',
    GRA: 'Granma', SCU: 'Santiago de Cuba', GTM: 'Guantánamo', IJV: 'Isla de la Juventud',
  };
  const byProvinceRaw = await col.aggregate([
    { $match: { 'metadata.source': 'crowdsourced', timestamp: { $gte: since }, 'metadata.province_id': { $ne: null } } },
    { $group: { _id: '$metadata.province_id', avg_download: { $avg: '$download_mbps' }, avg_latency: { $avg: '$latency_ms' }, test_count: { $sum: 1 } } },
    { $sort: { avg_download: -1 } },
  ]).toArray();
  const crowdByProvince = byProvinceRaw.map(p => ({
    province: PROVINCE_NAMES[p._id] || p._id,
    avg_download: p.avg_download,
    avg_latency: p.avg_latency,
    test_count: p.test_count,
  }));

  // --- Compute Indice de Apertura de Internet (mirrors frontend logic) ---
  const iodaScore = (1 - (ioda.length > 0 ? ioda[0].outage_score : 0)) * 100;
  const bgpScore = (ripe.length > 0 ? ripe[0].bgp_visibility_pct : 1) * 100;

  const recentTraffic = traffic.slice(0, 6);
  const trafficScoreIdx = recentTraffic.length > 0
    ? recentTraffic.reduce((sum, d) => sum + (d.traffic_score || 0), 0) / recentTraffic.length
    : 50;

  const latestOoni = ooni[ooni.length - 1];
  const blockingRate = latestOoni?.blocking_rate ?? 0;
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

  const dl = speed[0]?.download_speed_mbps;
  const lat = speed[0]?.latency_ms;
  let penalty = 0;
  if (dl != null && dl < 1) penalty += 3;
  if (lat != null && lat > 500) penalty += 2;
  composite = Math.max(0, Math.min(100, composite - penalty));

  const aperturaIndex = Math.round(composite);
  const aperturaStatus = aperturaIndex >= 70 ? 'OPERATIVO' : aperturaIndex >= 40 ? 'DEGRADADO' : 'BLOQUEADO';

  return {
    period: hours,
    traffic: { avg: trafficAvg, min: trafficMin, count: traffic.length },
    speedAvg,
    outages,
    bgp: { avg: bgpAvg, min: bgpMin },
    ioda: { max: iodaMax },
    ooni: ooniTotals,
    crowdTestCount,
    crowdAvg,
    crowdByProvince,
    aperturaIndex,
    aperturaStatus,
  };
}

function avg(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
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
- Escribe en español, entendible para un cubano, con explicaciones para alguien que no sabe de tecnología
- En vez de "latencia de 147 ms" di "la conexión tarda casi el doble que en el resto del mundo"
- En vez de "visibilidad BGP" di "la red de Cuba se ve normal desde afuera" o "Cuba se desconectó parcialmente del internet mundial" sin mencionar las Siglas BGP ni IODA
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

function buildWeeklyPrompt(data) {
  let prompt = `Genera un resumen semanal del estado de internet en Cuba basado en estos datos de los ultimos 7 dias:\n\n`;

  prompt += `*INDICE DE APERTURA DE INTERNET:* ${data.aperturaIndex}/100 — Estado: ${data.aperturaStatus}\n`;
  prompt += `(Este indice compuesto combina trafico HTTP, visibilidad BGP, deteccion de interrupciones IODA, censura OONI y velocidad crowdsourced. 70+ = OPERATIVO, 40-69 = DEGRADADO, <40 = BLOQUEADO)\n\n`;

  if (data.speedAvg) {
    prompt += `*Velocidad (Cloudflare Radar):*\n`;
    prompt += `- Descarga Cuba: ${data.speedAvg.download?.toFixed(1)} Mbps (global: ${data.speedAvg.globalDownload?.toFixed(1)} Mbps)\n`;
    prompt += `- Subida Cuba: ${data.speedAvg.upload?.toFixed(1)} Mbps\n`;
    prompt += `- Latencia Cuba: ${data.speedAvg.latency?.toFixed(0)} ms (global: ${data.speedAvg.globalLatency?.toFixed(0)} ms)\n\n`;
  }

  prompt += `*Trafico HTTP (volumen relativo de Cuba, donde 100 = pico normal y por debajo de 25 es critico):*\n`;
  prompt += `- Promedio: ${data.traffic.avg?.toFixed(1) ?? 'N/A'}\n`;
  prompt += `- Minimo: ${data.traffic.min?.toFixed(1) ?? 'N/A'}\n\n`;

  prompt += `*Conectividad BGP (ETECSA AS27725):*\n`;
  prompt += `- Visibilidad promedio: ${data.bgp.avg != null ? (data.bgp.avg * 100).toFixed(1) : 'N/A'}%\n`;
  prompt += `- Visibilidad minima: ${data.bgp.min != null ? (data.bgp.min * 100).toFixed(1) : 'N/A'}%\n\n`;

  prompt += `*IODA (deteccion de interrupciones):*\n`;
  prompt += `- Score maximo de interrupcion: ${data.ioda.max?.toFixed(3) ?? 'N/A'} (0=normal, 1=apagon)\n\n`;

  if (data.outages.length > 0) {
    prompt += `*Interrupciones/anomalias detectadas:* ${data.outages.length}\n`;
    for (const o of data.outages.slice(0, 5)) {
      prompt += `- ${o.alert_type}: ${o.description || o.outage_cause || o.event_type || 'Sin descripcion'} (${o.start_date}${o.end_date ? ` — ${o.end_date}` : ', aun activa'})\n`;
    }
    prompt += '\n';
  } else {
    prompt += `*Interrupciones detectadas:* 0\n\n`;
  }

  prompt += `*Censura web (OONI):*\n`;
  prompt += `- Tests OK: ${data.ooni.ok}, Bloqueados: ${data.ooni.confirmed}, Anomalias: ${data.ooni.anomaly}\n\n`;

  if (data.crowdTestCount > 0 && data.crowdAvg) {
    prompt += `*Datos reportados por usuarios desde Cuba (${data.crowdTestCount} tests de velocidad esta semana):*\n`;
    prompt += `- Descarga promedio: ${data.crowdAvg.download?.toFixed(1)} Mbps, Subida: ${data.crowdAvg.upload?.toFixed(1)} Mbps, Latencia: ${data.crowdAvg.latency?.toFixed(0)} ms\n`;
    if (data.crowdByProvince.length > 0) {
      const best = data.crowdByProvince[0];
      const worst = data.crowdByProvince[data.crowdByProvince.length - 1];
      prompt += `- Mejor provincia: ${best.province} (${best.avg_download.toFixed(1)} Mbps, ${best.test_count} tests)\n`;
      if (worst.province !== best.province) {
        prompt += `- Peor provincia: ${worst.province} (${worst.avg_download.toFixed(1)} Mbps, ${worst.test_count} tests)\n`;
      }
    }
    prompt += `- IMPORTANTE: Invita a los lectores a hacer su propio test en https://internet.cubapk.com/speedtest para tener datos mas completos de cada provincia\n\n`;
  } else {
    prompt += `*Datos crowdsourced:* No hubo tests de velocidad esta semana. Invita a los lectores a hacer su propio test en https://internet.cubapk.com/speedtest\n\n`;
  }

  return prompt;
}

function buildOutagePrompt(data, context) {
  let prompt = `URGENTE: Se ha detectado una interrupcion de internet en Cuba. Genera una nota breve informando sobre la situacion actual.\n\n`;

  prompt += `*INDICE DE APERTURA DE INTERNET:* ${data.aperturaIndex}/100 — Estado: ${data.aperturaStatus}\n\n`;

  if (context) {
    prompt += `*Detalles de la alerta:*\n`;
    if (context.description) prompt += `- Descripcion: ${context.description}\n`;
    if (context.outage_cause) prompt += `- Causa: ${context.outage_cause}\n`;
    if (context.outage_type) prompt += `- Alcance: ${context.outage_type}\n`;
    if (context.start_date) prompt += `- Inicio: ${context.start_date}\n`;
    if (context.ioda_detected) prompt += `- IODA confirma interrupcion (score: ${context.ioda_score?.toFixed(3)})\n`;
    if (context.low_visibility) prompt += `- Visibilidad BGP degradada: ${(context.bgp_visibility * 100).toFixed(1)}%\n`;
    prompt += '\n';
  }

  if (data.speedAvg) {
    prompt += `*Ultimos datos de velocidad:*\n`;
    prompt += `- Descarga: ${data.speedAvg.download?.toFixed(1)} Mbps (global: ${data.speedAvg.globalDownload?.toFixed(1)} Mbps)\n`;
    prompt += `- Latencia: ${data.speedAvg.latency?.toFixed(0)} ms (global: ${data.speedAvg.globalLatency?.toFixed(0)} ms)\n\n`;
  }

  prompt += `*Trafico HTTP (volumen relativo, 100=pico normal, <25=critico):* ${data.traffic.avg?.toFixed(1) ?? 'N/A'}\n`;
  prompt += `*Conectividad internacional:* Visibilidad ${data.bgp.avg != null ? (data.bgp.avg * 100).toFixed(1) : 'N/A'}%\n\n`;

  return prompt;
}

// --- Slack delivery via Bot API ---

const SLACK_POST_MESSAGE = 'https://slack.com/api/chat.postMessage';

async function sendToSlack(note) {
  const botToken = process.env.SLACK_BOT_TOKEN;
  const channelId = process.env.SLACK_CHANNEL_ID;
  if (!botToken || !channelId) {
    console.warn('[AI Notes] No SLACK_BOT_TOKEN or SLACK_CHANNEL_ID configured, skipping Slack notification');
    return;
  }

  try {
    const icon = note.type === 'outage' ? ':rotating_light:' : ':bar_chart:';
    const prefix = note.type === 'outage' ? '*ALERTA DE INTERRUPCION*\n\n' : '*RESUMEN SEMANAL*\n\n';

    const payload = {
      channel: channelId,
      text: `${icon} ${prefix}${note.content}`,
      unfurl_links: false,
      unfurl_media: false,
    };

    const result = await fetchJson(SLACK_POST_MESSAGE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!result?.ok) {
      console.error(`[AI Notes] Slack API error: ${result?.error || 'unknown'}`);
      return;
    }

    // Mark as sent
    const db = await getDb();
    await db.collection(NOTES_COLLECTION).updateOne(
      { _id: note._id },
      { $set: { sent_to_slack: true, slack_ts: result.ts } },
    );

    console.log(`[AI Notes] Note sent to Slack channel ${channelId} successfully`);
  } catch (err) {
    console.error(`[AI Notes] Failed to send to Slack:`, err.message);
  }
}
