import { getDb } from './mongodb';

const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes per rule

interface AlertCheck {
  rule_id: string;
  message: string;
  current_value: number;
  threshold: number;
}

export async function checkAndSendAlerts(checks: AlertCheck[]) {
  const db = await getDb();
  const alertsCol = db.collection('alerts');

  for (const check of checks) {
    // Check cooldown
    const recent = await alertsCol.findOne({
      rule_id: check.rule_id,
      triggered_at: { $gte: new Date(Date.now() - COOLDOWN_MS) },
    });

    if (recent) continue;

    const alert = {
      rule_id: check.rule_id,
      triggered_at: new Date(),
      message: check.message,
      current_value: check.current_value,
      threshold: check.threshold,
    };

    await alertsCol.insertOne(alert);

    console.log(`Alert triggered: ${check.rule_id}`);
  }
}
