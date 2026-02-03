// execution/audit/executionTimeline.js

const pool = require("../../config/db");

// 🔍 PROVE FILE LOAD
console.log("✅ executionTimeline.js LOADED");

async function recordTransition({
  transactionId,
  fromState,
  toState,
  reason,
}) {
  // 🔍 PROVE FUNCTION EXECUTION
  console.log(
    "✍️ recordTransition:",
    transactionId,
    fromState,
    "→",
    toState,
    "| reason:",
    reason
  );

  // 1️⃣ Append-only audit log (immutable timeline)
  await pool.query(
    `
    INSERT INTO execution_timeline (
      transaction_id,
      from_state,
      to_state,
      reason
    )
    VALUES ($1, $2, $3, $4)
    `,
    [transactionId, fromState, toState, reason]
  );

  // 2️⃣ SINGLE SOURCE OF TRUTH
  //    - execution_state = current state
  //    - last_progress_at = liveness signal for watchdog
  await pool.query(
    `
    UPDATE transactions
    SET
      execution_state = $2,
      last_progress_at = NOW()
    WHERE id = $1
    `,
    [transactionId, toState]
  );
}

module.exports = { recordTransition };
