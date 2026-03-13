db = db.getSiblingDB('cuba_monitor');

db.createCollection('metrics', {
  timeseries: {
    timeField: 'timestamp',
    metaField: 'metadata',
    granularity: 'minutes',
  },
  expireAfterSeconds: 60 * 60 * 24 * 90, // 90 days
});

db.metrics.createIndex({ 'metadata.source': 1, timestamp: -1 });
db.metrics.createIndex({ 'metadata.province_id': 1, timestamp: -1 });

db.createCollection('alerts');
db.alerts.createIndex({ rule_id: 1, triggered_at: -1 });
db.alerts.createIndex({ triggered_at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

print('Cuba Monitor DB initialized');
