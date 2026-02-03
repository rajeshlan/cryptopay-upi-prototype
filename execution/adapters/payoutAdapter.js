// execution/adapters/payoutAdapter.js
const { simulatePayout } = require("../sandbox/payoutSandbox");

async function realPayout() {
  // 🔒 Placeholder for RazorpayX / Cashfree / Bank API
  return true;
}

async function payout() {
  const mode = process.env.EXECUTION_MODE || "sandbox";

  if (mode === "real") {
    return realPayout();
  }

  return simulatePayout();
}

module.exports = { payout };
