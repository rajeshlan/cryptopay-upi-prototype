const { recordTransition } = require("../audit/executionTimeline");

async function executeSimulatedPayout({ transactionId, amount, upi }) {
  console.log(
    `💸 [SIMULATED PAYOUT] tx=${transactionId} upi=${upi} amount=${amount}`
  );

  await recordTransition({
    transactionId,
    fromState: "PAYOUT_PENDING",
    toState: "PAYOUT_SUCCESS",
    reason: "Simulated payout success",
  });

  return { success: true };
}

module.exports = { executeSimulatedPayout };
