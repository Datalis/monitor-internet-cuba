import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/cuba_monitor';
let client: MongoClient;
let db: Db;

export async function getDb(): Promise<Db> {
  if (!db) {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('cuba_monitor');
  }
  return db;
}
