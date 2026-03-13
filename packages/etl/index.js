import cron from 'node-cron';
import { getDb } from './db.js';
import { collectRipeStat } from './collectors/ripe-stat.js';
import { collectIoda } from './collectors/ioda.js';
import { collectOoni } from './collectors/ooni.js';
import { collectCloudflare } from './collectors/cloudflare.js';
import { collectOokla } from './collectors/ookla.js';
import { collectMlab } from './collectors/mlab.js';

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

  // Speed/Latency (Cloudflare Radar): every 6 hours
  cron.schedule('0 */6 * * *', () => runSafe('Speed', collectMlab));

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
