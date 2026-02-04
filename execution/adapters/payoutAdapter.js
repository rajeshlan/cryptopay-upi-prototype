// execution/adapters/payoutAdapter.js
const { recordTransition } = require("../audit/executionTimeline");
const { STATE } = require("../states");

/**
 * Simulated payout adapter
 * Sandbox-only — immediately finalizes payout
 */
async function executePayout({ transactionId, upi, amount }) {
  console.log(
    `💸 [SIMULATED PAYOUT] tx=${transactionId} upi=${upi} amount=${amount}`
  );

  // 🔥 THIS WAS MISSING — advance execution state
  await recordTransition({
    transactionId,
    fromState: STATE.PAYOUT_PENDING,
    toState: STATE.PAYOUT_SUCCESS,
    reason: "Simulated payout completed",
  });

  return {
    success: true,
    provider_ref: "SIMULATED_OK",
  };
}

module.exports = { executePayout };
