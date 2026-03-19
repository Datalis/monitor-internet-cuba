import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/cuba_monitor';
const client = new MongoClient(uri);
let db;

export async function getDb() {
  if (!db) {
    await client.connect();
    db = client.db('cuba_monitor');
    console.log('Connected to MongoDB');
  }
  return db;
}

export async function insertMetrics(metrics) {
  if (!metrics.length) return;
  const database = await getDb();
  const col = database.collection('metrics');

  // Deduplicate: check which timestamps already exist for each source
  const sources = [...new Set(metrics.map(m => m.metadata?.source))];
  const timestamps = metrics.map(m => m.timestamp);
  const existing = await col.find({
    'metadata.source': { $in: sources },
    timestamp: { $in: timestamps },
  }).project({ timestamp: 1, 'metadata.source': 1 }).toArray();

  const existingKeys = new Set(
    existing.map(e => `${e.timestamp.toISOString()}|${e.metadata?.source}`)
  );

  // For cloudflare-alert duplicates, update end_date if the new record has one
  const duplicateAlerts = metrics.filter(m => {
    const key = `${m.timestamp.toISOString()}|${m.metadata?.source}`;
    return existingKeys.has(key) && m.metadata?.source === 'cloudflare-alert' && m.end_date;
  });

  if (duplicateAlerts.length) {
    const bulkOps = duplicateAlerts.map(m => ({
      updateOne: {
        filter: { timestamp: m.timestamp, 'metadata.source': 'cloudflare-alert' },
        update: { $set: { end_date: m.end_date, ...(m.outage_cause ? { outage_cause: m.outage_cause } : {}), ...(m.outage_type ? { outage_type: m.outage_type } : {}) } },
      },
    }));
    const result = await col.bulkWrite(bulkOps, { ordered: false });
    console.log(`Updated ${result.modifiedCount} cloudflare-alert records with end_date`);
  }

  // For mlab duplicates missing global data, delete old and re-insert with global fields
  const duplicateMlab = metrics.filter(m => {
    const key = `${m.timestamp.toISOString()}|${m.metadata?.source}`;
    return existingKeys.has(key) && m.metadata?.source === 'mlab' && m.global_download_mbps != null;
  });

  if (duplicateMlab.length) {
    const mlabTimestamps = duplicateMlab.map(m => m.timestamp);
    await col.deleteMany({ 'metadata.source': 'mlab', timestamp: { $in: mlabTimestamps } });
    await col.insertMany(duplicateMlab, { ordered: false });
    console.log(`Replaced ${duplicateMlab.length} mlab records with global data`);
  }

  const newMetrics = metrics.filter(m => {
    const key = `${m.timestamp.toISOString()}|${m.metadata?.source}`;
    return !existingKeys.has(key);
  });

  if (!newMetrics.length) {
    console.log(`Skipped ${metrics.length} duplicate metrics`);
    return;
  }

  try {
    await col.insertMany(newMetrics, { ordered: false });
    console.log(`Inserted ${newMetrics.length} metrics (${metrics.length - newMetrics.length} duplicates skipped)`);
  } catch (err) {
    if (err.code === 11000) {
      console.log('Some duplicate metrics skipped');
    } else {
      throw err;
    }
  }
}
