const pool = require("../../config/db");

/**
 * Rebuilds execution state from append-only timeline.
 *
 * Returns:
 * {
 *   terminal_state: string | null,
 *   resume_state: string | null
 * }
 *
 * Rules:
 * - Pure read
 * - Deterministic
 * - No mutation
 * - Retry only from SAFE points
 */
async function rebuildStateFromTimeline(transactionId) {
  const { rows } = await pool.query(
    `
    SELECT from_state, to_state
    FROM execution_timeline
    WHERE transaction_id = $1
    ORDER BY created_at ASC
    `,
    [transactionId]
  );

  if (!rows.length) {
    return {
      terminal_state: null,
      resume_state: null,
    };
  }

  const terminalState = rows[rows.length - 1].to_state;

  // ⛔ Successful executions are never retried
  if (terminalState === "PAYOUT_SUCCESS") {
    return {
      terminal_state: terminalState,
      resume_state: null,
    };
  }

  // 🔁 Safe retry rules
  if (terminalState === "EXCHANGE_FAILED") {
    return {
      terminal_state: terminalState,
      resume_state: "RATE_LOCKED",
    };
  }

  if (terminalState === "PAYOUT_FAILED") {
    return {
      terminal_state: terminalState,
      resume_state: "CONVERSION_CONFIRMED",
    };
  }

  // ❌ Unknown or unsafe failure — no retry
  if (terminalState && terminalState.endsWith("FAILED")) {
    return {
      terminal_state: terminalState,
      resume_state: null,
    };
  }

  // Default: still in progress
  return {
    terminal_state: terminalState,
    resume_state: terminalState,
  };
}

module.exports = {
  rebuildStateFromTimeline,
};
