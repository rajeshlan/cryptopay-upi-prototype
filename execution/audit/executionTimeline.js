// execution/audit/executionTimeline.js
const pool = require("../../config/db");
const { STATE_GRAPH } = require("../states");

// 🔍 PROVE FILE LOAD
console.log("✅ executionTimeline.js LOADED");

/**
 * Guard illegal state transitions
 */
function assertTransition(from, to) {
  if (!from) return; // initial transition is allowed

  const allowed = STATE_GRAPH[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid transition: ${from} → ${to}`);
  }
}

/**
 * Record execution state transition
 * - Immutable audit log (execution_timeline)
 * - Mutable source of truth (transactions.execution_state)
 */
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

  // 1️⃣ Guard illegal transitions (CRITICAL)
  assertTransition(fromState, toState);

  // 2️⃣ Append-only audit log
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

  // 3️⃣ 🔑 SINGLE SOURCE OF TRUTH
  //     - execution_state drives engine + watchdog
  //     - last_progress_at is watchdog liveness signal
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
