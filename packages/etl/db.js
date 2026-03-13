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
  try {
    await col.insertMany(metrics, { ordered: false });
    console.log(`Inserted ${metrics.length} metrics`);
  } catch (err) {
    if (err.code === 11000) {
      console.log('Some duplicate metrics skipped');
    } else {
      throw err;
    }
  }
}
