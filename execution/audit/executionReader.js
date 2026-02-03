// execution/audit/executionReader.js
const pool = require("../../config/db");

/**
 * Read-only execution audit timeline.
 *
 * Guarantees:
 * - Immutable history (append-only)
 * - Ordered by execution time
 * - Safe for UI, observability, audits
 *
 * @param {string} transactionId
 * @returns {Array} execution timeline rows
 */
async function getExecutionTimeline(transactionId) {
  if (!transactionId) {
    throw new Error("executionReader: transactionId is required");
  }

  const { rows } = await pool.query(
    `
    SELECT
      from_state,
      to_state,
      reason,
      meta,
      created_at
    FROM execution_timeline
    WHERE transaction_id = $1
    ORDER BY created_at ASC
    `,
    [transactionId]
  );

  return rows;
}

module.exports = {
  getExecutionTimeline, // ✅ canonical, aligned with routes
};
