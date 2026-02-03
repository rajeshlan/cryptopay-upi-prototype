// execution/audit/readTimeline.js
const pool = require("../../config/db");

/**
 * Read-only execution timeline fetcher.
 * NEVER mutates state.
 */
async function getTimeline(transactionId) {
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
  getTimeline,
};
