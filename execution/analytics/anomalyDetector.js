const pool = require("../../config/db");
const { getExecutionDuration } = require("./executionMetrics");

const SLA_TOTAL_MS = 2000;          // demo SLA
const SLA_PAYOUT_MS = 1000;

async function detectAnomalies(transactionId) {
  const anomalies = [];

  // 1️⃣ Duration-based anomalies
  const metrics = await getExecutionDuration(transactionId);

  if (metrics.totalMs > SLA_TOTAL_MS) {
    anomalies.push({
      type: "SLOW_EXECUTION",
      severity: "WARN",
      details: {
        totalMs: metrics.totalMs,
        slaMs: SLA_TOTAL_MS,
      },
    });
  }

  if (
    metrics.perStateMs?.PAYOUT_PENDING &&
    metrics.perStateMs.PAYOUT_PENDING > SLA_PAYOUT_MS
  ) {
    anomalies.push({
      type: "SLOW_PAYOUT",
      severity: "CRITICAL",
      details: {
        payoutMs: metrics.perStateMs.PAYOUT_PENDING,
        slaMs: SLA_PAYOUT_MS,
      },
    });
  }

  // 2️⃣ Retry / watchdog pressure
  const { rows } = await pool.query(
    `
    SELECT COUNT(*)::int AS attempts
    FROM execution_timeline
    WHERE transaction_id = $1
      AND from_state IS NULL
    `,
    [transactionId]
  );

  if (rows[0].attempts > 1) {
    anomalies.push({
      type: "MULTIPLE_EXECUTION_ATTEMPTS",
      severity: "INFO",
      details: {
        attempts: rows[0].attempts,
      },
    });
  }

  // 3️⃣ Persist anomalies
  for (const a of anomalies) {
    await pool.query(
      `
      INSERT INTO execution_anomalies
        (transaction_id, anomaly_type, severity, details)
      VALUES ($1, $2, $3, $4)
      `,
      [transactionId, a.type, a.severity, a.details]
    );
  }

  return anomalies;
}

module.exports = { detectAnomalies };
