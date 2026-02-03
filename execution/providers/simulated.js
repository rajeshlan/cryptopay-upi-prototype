async function executeSimulatedPayout({ transactionId, amount, upi }) {
  console.log(
    `💸 [SIMULATED PAYOUT] tx=${transactionId} upi=${upi} amount=${amount}`
  );

  return {
    provider: "SIMULATED",
    reference_id: `SIM-${transactionId}`,
    status: "SUCCESS",
  };
}

module.exports = { executeSimulatedPayout };
