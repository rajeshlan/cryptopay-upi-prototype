// execution/payoutAdapter.js

const { executeSimulatedPayout } = require("./providers/simulated");
const { executeCashfreePayout } = require("./providers/cashfree");
// const { executeRazorpayXPayout } = require("./providers/razorpayx"); // future

/**
 * Canonical payout adapter
 *
 * Engine calls this once.
 * This function decides HOW the payout happens.
 */
async function executePayout({ transactionId, amount, upi }) {
  const mode = process.env.PAYOUT_MODE || "SIMULATION";
  const provider = process.env.PAYOUT_PROVIDER || "SIMULATED";

  // ─────────────────────────────────────────────
  // 🧪 SIMULATION MODE (DEFAULT & SAFE)
  // ─────────────────────────────────────────────
  if (mode === "SIMULATION") {
    return executeSimulatedPayout({
      transactionId,
      amount,
      upi,
    });
  }

  // ─────────────────────────────────────────────
  // 🧾 REAL SANDBOX MODE
  // ─────────────────────────────────────────────
  if (mode === "SANDBOX") {
    if (provider === "CASHFREE") {
      return executeCashfreePayout({
        transactionId,
        amount,
        upi,
      });
    }

    // if (provider === "RAZORPAYX") {
    //   return executeRazorpayXPayout({
    //     transactionId,
    //     amount,
    //     upi,
    //   });
    // }

    throw new Error("UNSUPPORTED_PAYOUT_PROVIDER");
  }

  // ─────────────────────────────────────────────
  // ❌ INVALID MODE
  // ─────────────────────────────────────────────
  throw new Error("UNSUPPORTED_PAYOUT_MODE");
}

module.exports = {
  executePayout,
};
