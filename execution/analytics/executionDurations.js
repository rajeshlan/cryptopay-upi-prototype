// execution/analytics/executionDurations.js
const pool = require("../../config/db");

/**
 * Returns per-state and total execution duration for a transaction
 */
async function getExecutionDurations(transactionId) {
  const { rows } = await pool.query(
    `
    SELECT
      from_state,
      to_state,
      created_at
    FROM execution_timeline
    WHERE transaction_id = $1
    ORDER BY created_at ASC
    `,
    [transactionId]
  );

  if (rows.length < 2) {
    return {
      transactionId,
      totalMs: 0,
      states: {},
    };
  }

  const states = {};
  let totalMs = 0;

  for (let i = 0; i < rows.length - 1; i++) {
    const current = rows[i];
    const next = rows[i + 1];

    const durationMs =
      new Date(next.created_at) - new Date(current.created_at);

    const stateName = current.to_state || "CREATED";

    states[stateName] =
      (states[stateName] || 0) + durationMs;

    totalMs += durationMs;
  }

  return {
    transactionId,
    totalMs,
    states,
  };
}

module.exports = {
  getExecutionDurations,
};
