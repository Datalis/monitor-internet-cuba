db = db.getSiblingDB('cuba_monitor');

// No TTL: los datos historicos se conservan indefinidamente. Un TTL aqui borra
// silenciosamente los tests crowdsourced, que no se pueden recuperar de ninguna
// fuente externa. Ver mongo/README.md antes de reintroducir cualquier expiracion.
db.createCollection('metrics', {
  timeseries: {
    timeField: 'timestamp',
    metaField: 'metadata',
    granularity: 'minutes',
  },
});

db.metrics.createIndex({ 'metadata.source': 1, timestamp: -1 });
db.metrics.createIndex({ 'metadata.province_id': 1, timestamp: -1 });
db.metrics.createIndex({ 'metadata.source': 1, 'metadata.province_id': 1, timestamp: -1 });

db.createCollection('alerts');
db.alerts.createIndex({ rule_id: 1, triggered_at: -1 });
db.alerts.createIndex({ triggered_at: 1 });

print('Cuba Monitor DB initialized');
