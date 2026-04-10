import cron from 'node-cron';
import { getDb } from './db.js';
import { collectRipeStat } from './collectors/ripe-stat.js';
import { collectIoda } from './collectors/ioda.js';
import { collectOoni } from './collectors/ooni.js';
import { collectCloudflare } from './collectors/cloudflare.js';
import { collectOokla } from './collectors/ookla.js';
import { collectMlab } from './collectors/mlab.js';
import { collectSpeedtestIndex } from './collectors/speedtest-index.js';
import { generateWeeklyNote, checkAndReportOutage } from './collectors/ai-notes.js';

async function main() {
  console.log('Cuba Internet Monitor ETL starting...');
  await getDb();

  // Initial collection on startup
  console.log('Running initial collection...');
  await runSafe('RIPE Stat', collectRipeStat);
  await runSafe('IODA', collectIoda);
  await runSafe('OONI', collectOoni);
  await runSafe('Cloudflare', collectCloudflare);
  await runSafe('M-Lab', collectMlab);
  await runSafe('Speedtest Index', collectSpeedtestIndex);

  // RIPE Stat: every 5 minutes (most critical for outage detection)
  cron.schedule('*/5 * * * *', () => runSafe('RIPE Stat', collectRipeStat));

  // IODA: every 15 minutes
  cron.schedule('*/15 * * * *', () => runSafe('IODA', collectIoda));

  // OONI: every 30 minutes
  cron.schedule('*/30 * * * *', () => runSafe('OONI', collectOoni));

  // Cloudflare: every 15 minutes
  cron.schedule('7,22,37,52 * * * *', () => runSafe('Cloudflare', collectCloudflare));

  // Ookla: daily at 3am (checks for new quarterly data)
  cron.schedule('0 3 * * *', () => runSafe('Ookla', collectOokla));

  // Speedtest Global Index: daily at 4am (monthly data, rarely changes)
  cron.schedule('0 4 * * *', () => runSafe('Speedtest Index', collectSpeedtestIndex));

  // Speed/Latency (Cloudflare Radar): every 6 hours
  cron.schedule('0 */6 * * *', () => runSafe('Speed', collectMlab));

  // AI Notes: weekly summary every Monday at 9am Cuba time (13:00 UTC = 9am UTC-4 summer)
  cron.schedule('0 13 * * 1', () => runSafe('AI Weekly Note', generateWeeklyNote));

  // AI Notes: check for outages every 15 minutes and report if new
  cron.schedule('3,18,33,48 * * * *', () => runSafe('AI Outage Check', checkAndReportOutage));

  console.log('ETL scheduler running. Cron jobs registered.');
}

async function runSafe(name, fn) {
  try {
    await fn();
  } catch (err) {
    console.error(`[${name}] Collection failed:`, err.message);
  }
}

main().catch(err => {
  console.error('ETL fatal error:', err);
  process.exit(1);
});
