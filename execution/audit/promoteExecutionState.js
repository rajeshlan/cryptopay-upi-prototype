// execution/audit/promoteExecutionState.js
const pool = require("../../config/db");

/**
 * Promote terminal execution state on transactions table.
 * Idempotent & safe.
 */
async function promoteExecutionState(transactionId, newState) {
  await pool.query(
    `
    UPDATE transactions
    SET execution_state = $2,
        last_progress_at = NOW()
    WHERE id = $1
      AND execution_state IS DISTINCT FROM $2
    `,
    [transactionId, newState]
  );
}

module.exports = { promoteExecutionState };
